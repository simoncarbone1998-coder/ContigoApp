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

interface Questionnaire {
  date_of_birth?: string
  biological_sex?: string
  conditions?: string[]
  hospitalized_last_12m?: boolean
  hospitalization_reason?: string
  active_treatment?: boolean
  regular_medications?: boolean
  medications_detail?: string
  smoking_status?: string
  has_eps?: boolean
  // Simulator shortcut: age instead of date_of_birth
  age?: number
}

function calcAge(dob: string | undefined, age: number | undefined): number | null {
  if (age !== undefined) return age
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let a = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--
  return a
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json() as {
      questionnaire: Questionnaire
      rulebook_id?: string
      simulate?: boolean
    }

    const { questionnaire, rulebook_id, simulate } = body

    // ── Fetch rulebook ──────────────────────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let rulebookQuery = supabase.from('underwriting_rulebooks').select('*')
    if (rulebook_id) {
      rulebookQuery = rulebookQuery.eq('id', rulebook_id)
    } else {
      rulebookQuery = rulebookQuery.eq('is_active', true)
    }
    const { data: rulebooks, error: rbError } = await rulebookQuery.limit(1)

    if (rbError || !rulebooks?.length) {
      return json({ error: 'No active rulebook found' }, 404)
    }

    const rb = rulebooks[0]
    const incomeQuarter = rb.monthly_income_usd * 3

    // ── Build prompt ────────────────────────────────────────────────────────
    const age = calcAge(questionnaire.date_of_birth, questionnaire.age)
    const conditionsList = (questionnaire.conditions ?? []).join(', ') || 'Ninguna'

    const patientProfile = `
PERFIL DEL PACIENTE:
- Edad: ${age !== null ? `${age} años` : 'No indicada'}
- Sexo biológico: ${questionnaire.biological_sex ?? 'No indicado'}
- Condiciones médicas: ${conditionsList}
- Hospitalizado en los últimos 12 meses: ${questionnaire.hospitalized_last_12m ? `Sí${questionnaire.hospitalization_reason ? ` (${questionnaire.hospitalization_reason})` : ''}` : 'No'}
- En tratamiento médico activo: ${questionnaire.active_treatment ? 'Sí' : 'No'}
- Toma medicamentos regularmente: ${questionnaire.regular_medications ? `Sí${questionnaire.medications_detail ? ` (${questionnaire.medications_detail})` : ''}` : 'No'}
- Estado tabáquico: ${questionnaire.smoking_status ?? 'No indicado'}
- EPS activa: ${questionnaire.has_eps ? 'Sí' : 'No'}
`

    const systemPrompt = `Eres un actuario de salud especializado en medicina prepagada colombiana. Tu objetivo es estimar la probabilidad de que este paciente genere costos superiores al ingreso que genera en un trimestre.

MODELO DE COSTOS:
- Costo por consulta médica: $${rb.cost_per_consultation_usd} USD
- Costo promedio por medicamentos (mensual): $${rb.cost_per_medication_usd} USD
- Costo promedio por examen diagnóstico: $${rb.cost_per_exam_usd} USD
- Ingreso mensual por paciente: $${rb.monthly_income_usd} USD
- Ingreso trimestral: $${incomeQuarter} USD

UMBRALES DE DECISIÓN:
- Ratio costo/ingreso < ${rb.threshold_review}: recomendar aprobación
- Ratio entre ${rb.threshold_review} y ${rb.threshold_reject}: recomendar revisión manual
- Ratio > ${rb.threshold_reject}: recomendar rechazo

INSTRUCCIONES ADICIONALES:
${rb.ai_instructions}

Analiza el perfil del paciente y estima:
1. ¿Cuántas consultas médicas necesitará por trimestre?
2. ¿Cuántos medicamentos por mes (costo en USD)?
3. ¿Cuántos exámenes diagnósticos por trimestre?
4. Costo total esperado trimestral
5. Ratio costo/ingreso
6. Análisis de sensibilidad

Responde ÚNICAMENTE con este JSON válido (sin texto adicional, sin markdown, sin bloques de código):
{
  "recommendation": "approve",
  "probability_high_cost": 0.15,
  "cost_breakdown": {
    "consultations_per_quarter": 1,
    "consultations_cost": 40,
    "medications_per_month": 0,
    "medications_cost": 0,
    "exams_per_quarter": 1,
    "exams_cost": 12,
    "total_expected_cost_usd": 52
  },
  "income_quarter_usd": ${incomeQuarter},
  "ratio": 0.91,
  "risk_level": "bajo",
  "drivers": [
    {
      "factor": "nombre del factor",
      "impact_usd": 40,
      "explanation": "explicación breve"
    }
  ],
  "sensitivity_analysis": {
    "breakeven_consultations_per_quarter": 1,
    "breakeven_ratio_explanation": "explicación del punto de equilibrio",
    "scenarios": [
      {
        "name": "Uso mínimo (1 consulta/trimestre)",
        "cost_usd": 40,
        "ratio": 0.70,
        "viable": true
      },
      {
        "name": "Uso promedio (1 consulta/mes)",
        "cost_usd": 120,
        "ratio": 2.11,
        "viable": false
      },
      {
        "name": "Uso alto (2 consultas/mes)",
        "cost_usd": 240,
        "ratio": 4.21,
        "viable": false
      }
    ]
  },
  "reasoning": "Explicación detallada en español (3-5 líneas)"
}`

    // ── Call Claude ─────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: patientProfile }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    let aiResult: Record<string, unknown>
    try {
      aiResult = JSON.parse(raw)
    } catch {
      // Try to extract JSON if wrapped in markdown
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Claude did not return valid JSON')
      aiResult = JSON.parse(match[0])
    }

    return json({
      ...aiResult,
      rulebook: {
        id: rb.id,
        version: rb.version,
        name: rb.name,
      },
      simulate: simulate ?? false,
    })
  } catch (err) {
    console.error('underwrite-patient error:', err)
    return json({ error: String(err) }, 500)
  }
})
