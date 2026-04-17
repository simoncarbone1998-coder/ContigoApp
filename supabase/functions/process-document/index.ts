import { createClient } from 'npm:@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function chunkText(text: string, size = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    const chunk = text.slice(i, i + size).trim()
    if (chunk.length > 20) chunks.push(chunk)
    i += size - overlap
  }
  return chunks
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  try {
    // Use pdf-parse core module to avoid Deno test-file loading issue
    const pdfParse = (await import('npm:pdf-parse/lib/pdf-parse.js')).default
    const result = await pdfParse(Buffer.from(buffer))
    return result.text ?? ''
  } catch (e) {
    console.error('PDF parse error:', e)
    return ''
  }
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = (await import('npm:mammoth')).default
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value ?? ''
  } catch (e) {
    console.error('DOCX parse error:', e)
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { document_id } = await req.json() as { document_id: string }
    if (!document_id) return json({ error: 'document_id required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch document record
    const { data: doc, error: docErr } = await supabase
      .from('chat_documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docErr || !doc) return json({ error: 'Document not found' }, 404)

    // Download file from Storage using service role
    const { data: fileBlob, error: fileErr } = await supabase.storage
      .from('chat-documents')
      .download(doc.file_url)

    if (fileErr || !fileBlob) {
      await supabase.from('chat_documents').update({ status: 'error' }).eq('id', document_id)
      return json({ error: 'Failed to download file' }, 500)
    }

    // Extract text based on file type
    let text = ''
    const ft = (doc.file_type ?? '').toLowerCase()

    if (ft === 'txt') {
      text = await fileBlob.text()
    } else if (ft === 'pdf') {
      const buf = await fileBlob.arrayBuffer()
      text = await extractTextFromPdf(buf)
    } else if (ft === 'docx') {
      const buf = await fileBlob.arrayBuffer()
      text = await extractTextFromDocx(buf)
    } else {
      // Fallback: try as text
      try { text = await fileBlob.text() } catch { /* empty */ }
    }

    if (!text.trim()) {
      await supabase.from('chat_documents').update({ status: 'error' }).eq('id', document_id)
      return json({ error: 'No text could be extracted from file' }, 422)
    }

    // Normalise whitespace
    text = text.replace(/\s+/g, ' ').trim()

    // Chunk
    const chunks = chunkText(text)

    // Delete existing chunks (idempotent retry)
    await supabase.from('chat_document_chunks').delete().eq('document_id', document_id)

    // Insert chunks
    if (chunks.length > 0) {
      await supabase.from('chat_document_chunks').insert(
        chunks.map((content, idx) => ({ document_id, chunk_index: idx, content }))
      )
    }

    // Update document to ready
    await supabase.from('chat_documents').update({
      status: 'ready',
      content_text: text.slice(0, 10000),
      chunk_count: chunks.length,
    }).eq('id', document_id)

    return json({ success: true, chunks: chunks.length })

  } catch (err) {
    console.error('process-document error:', err)
    return json({ error: String(err) }, 500)
  }
})
