import Anthropic from 'npm:@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { transcript } = await req.json() as { transcript?: string }

    // Empty transcript — return empty fields
    if (!transcript?.trim()) {
      return json({ resumen: '', medicamentos: [], examenes: [], referencias: [], control: { recommended: false, months: null, note: '' } })
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `Eres un asistente médico. Analiza esta transcripción de una consulta médica en español colombiano y genera un resumen estructurado.

Responde ÚNICAMENTE con este JSON válido (sin texto adicional, sin markdown, sin bloques de código):
{
  "resumen": "2-3 líneas describiendo el motivo de consulta y lo discutido",
  "medicamentos": [
    {
      "medicine_name": "nombre del medicamento",
      "dose": "dosis",
      "instructions": "instrucciones de uso"
    }
  ],
  "examenes": [
    {
      "exam_type": "nombre del examen diagnóstico",
      "notes": "instrucciones adicionales para el examen"
    }
  ],
  "referencias": [
    {
      "specialty": "valor de especialidad en snake_case (pediatria|ginecologia|cardiologia|dermatologia|psicologia|ortopedia)",
      "reason": "motivo de la referencia",
      "urgency": "rutinaria|prioritaria"
    }
  ],
  "control": {
    "recommended": false,
    "months": null,
    "note": ""
  }
}

Si no se mencionaron medicamentos, usa un array vacío: "medicamentos": []
Si no se mencionaron exámenes diagnósticos, usa un array vacío: "examenes": []
Si no se mencionaron referencias a especialistas, usa un array vacío: "referencias": []
Si no se mencionó control de seguimiento, usa: "control": {"recommended": false, "months": null, "note": ""}
Para "control.months" usa solo los valores: 1, 2, 3, 6, o 12.
Si la transcripción es insuficiente, genera un resumen genérico breve.`,
      messages: [{ role: 'user', content: transcript }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''

    // Strip potential markdown code fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let result: {
      resumen: string
      medicamentos: { medicine_name: string; dose: string; instructions: string }[]
      examenes: { exam_type: string; notes: string }[]
      referencias: { specialty: string; reason: string; urgency: string }[]
      control: { recommended: boolean; months: number | null; note: string }
    }

    try {
      result = JSON.parse(cleaned)
    } catch {
      return json({
        resumen: '',
        medicamentos: [],
        examenes: [],
        referencias: [],
        control: { recommended: false, months: null, note: '' },
        warning: 'No se pudo parsear la respuesta de IA.',
      })
    }

    return json({
      resumen:      result.resumen      ?? '',
      medicamentos: result.medicamentos ?? [],
      examenes:     result.examenes     ?? [],
      referencias:  result.referencias  ?? [],
      control:      result.control      ?? { recommended: false, months: null, note: '' },
    })
  } catch (err) {
    return json({ error: String(err), resumen: '', medicamentos: [], examenes: [], referencias: [], control: { recommended: false, months: null, note: '' } }, 500)
  }
})
