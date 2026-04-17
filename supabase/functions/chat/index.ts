import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
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

// Simple in-memory rate limiter (resets on cold start — good enough for MVP)
const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

const STOP_WORDS = new Set([
  'de','la','el','en','que','y','a','los','las','un','una','es','se','no','con',
  'por','su','para','al','del','the','is','in','and','of','to','a','an','it',
  'me','my','do','i','what','how','can','will',
])

function scoreChunk(content: string, keywords: string[]): number {
  const lower = content.toLowerCase()
  return keywords.reduce((s, kw) => {
    const hits = (lower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
    return s + hits
  }, 0)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('cf-connecting-ip')
      ?? 'unknown'

    if (!checkRateLimit(ip)) {
      return json({ error: 'Rate limit exceeded. Please try again in a minute.' }, 429)
    }

    const body = await req.json() as {
      message: string
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
      custom_system_prompt?: string
    }

    const { message, conversation_history = [], custom_system_prompt } = body

    if (!message?.trim()) return json({ error: 'message is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch active chat config (unless a custom prompt is provided for simulation)
    let systemPrompt = custom_system_prompt ?? ''
    if (!systemPrompt) {
      const { data: cfg } = await supabase
        .from('chat_config')
        .select('system_prompt')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      systemPrompt = cfg?.system_prompt ?? 'Eres un asistente de Contigo.'
    }

    // Fetch all chunks
    const { data: chunks } = await supabase
      .from('chat_document_chunks')
      .select('content')

    let contextText = ''
    if (chunks && chunks.length > 0) {
      const keywords = message.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))

      const scored = keywords.length > 0
        ? [...chunks].sort((a, b) => scoreChunk(b.content, keywords) - scoreChunk(a.content, keywords))
        : chunks

      contextText = scored.slice(0, 5).map(c => c.content).join('\n\n')
    }

    const fullSystem = contextText
      ? `${systemPrompt}\n\nINFORMACIÓN DEL PLAN (usa solo esta información):\n---\n${contextText}\n---\n\nResponde la siguiente pregunta del usuario basándote ÚNICAMENTE en la información anterior.`
      : `${systemPrompt}\n\nNota: No hay documentos disponibles en este momento. Indica amablemente que no tienes información disponible y recomienda contactar a un asesor.`

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: fullSystem,
      messages: [
        ...conversation_history.slice(-10),
        { role: 'user', content: message },
      ],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return json({ reply })

  } catch (err) {
    console.error('chat error:', err)
    return json({ error: String(err) }, 500)
  }
})
