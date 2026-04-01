import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FROM = 'Contigo <noreply@contigomedicina.com>'

const SPECIALTY_LABELS: Record<string, string> = {
  medicina_general: 'Medicina General',
  pediatria:        'Pediatría',
  cardiologia:      'Cardiología',
  dermatologia:     'Dermatología',
  ginecologia:      'Ginecología',
  ortopedia:        'Ortopedia',
  psicologia:       'Psicología',
}

function specialtyLabel(s: string | null | undefined) {
  return s ? (SPECIALTY_LABELS[s] ?? s) : '—'
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

// ── Email HTML builder ──────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Contigo</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">contigo</p>
              <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Plataforma de Salud · Colombia</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © 2026 Contigo &nbsp;·&nbsp;
                <a href="https://contigomedicina.com" style="color:#94a3b8;text-decoration:none;">contigomedicina.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function appointmentCard(fecha: string, hora: string, extra: { label: string; value: string }[]) {
  const rows = extra.map(({ label, value }) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:14px;">${label}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="color:#0f172a;font-size:14px;font-weight:600;">${value}</span>
      </td>
    </tr>`).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin:20px 0;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;font-size:14px;">📅 Fecha</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="color:#0f172a;font-size:14px;font-weight:600;">${fecha}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;font-size:14px;">⏰ Hora</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="color:#0f172a;font-size:14px;font-weight:600;">${hora}</span>
        </td>
      </tr>
      ${rows}
    </table>`
}

// ── Reminder email templates ────────────────────────────────────────────────

interface ApptData {
  fecha: string
  hora: string
  doctorName: string
  patientName: string
  specialty: string
}

function reminderPatientHtml({ fecha, hora, doctorName, specialty }: ApptData, patientName: string) {
  const card = appointmentCard(fecha, hora, [
    { label: '👨‍⚕️ Doctor',         value: `Dr(a). ${doctorName}` },
    { label: '🏥 Especialidad',    value: specialty },
  ])
  return emailWrapper(`
    <p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">⏰ Tu cita es mañana</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${patientName},</p>
    <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">
      Te recordamos que mañana tienes una cita médica con Contigo.
    </p>
    ${card}
    <p style="margin:16px 0 4px;color:#334155;font-size:14px;line-height:1.6;">
      Tu consulta será por <strong>videollamada</strong>. El botón para unirte aparecerá
      <strong>5 minutos antes</strong> en tu calendario:
    </p>
    <p style="margin:0 0 24px;">
      <a href="https://contigomedicina.com/paciente/calendario"
        style="color:#1e3a5f;font-weight:600;font-size:14px;">
        contigomedicina.com/paciente/calendario
      </a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>
  `)
}

function reminderDoctorHtml({ fecha, hora, patientName, specialty }: ApptData, doctorName: string) {
  const card = appointmentCard(fecha, hora, [
    { label: '👤 Paciente',        value: patientName },
    { label: '🏥 Especialidad',    value: specialty },
  ])
  return emailWrapper(`
    <p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">⏰ Cita mañana con ${patientName}</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola Dr(a). ${doctorName},</p>
    <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">
      Te recordamos que mañana tienes una cita agendada con un paciente.
    </p>
    ${card}
    <p style="margin:16px 0 24px;">
      <a href="https://contigomedicina.com/doctor/agenda"
        style="color:#1e3a5f;font-weight:600;font-size:14px;">
        Ver en tu agenda → contigomedicina.com/doctor/agenda
      </a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>
  `)
}

// ── Resend helper ───────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  return res.json()
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const nowMs = Date.now()

  // ── 1. Auto-close past appointments ────────────────────────────────────────
  const { data: openAppts } = await supabase
    .from('appointments')
    .select('id, slot:slot_id(date, start_time)')
    .eq('status', 'confirmed')
    .eq('completed', false)

  const toClose = (openAppts ?? []).filter((a: any) => {
    if (!a.slot?.date || !a.slot?.start_time) return false
    return new Date(`${a.slot.date}T${a.slot.start_time}`).getTime() < nowMs
  })

  for (const a of toClose) {
    const completedAt = new Date(`${(a as any).slot.date}T${(a as any).slot.start_time}`).toISOString()
    await supabase.from('appointments').update({
      completed:    true,
      completed_at: completedAt,
      summary:      'Cita no atendida - cerrada automáticamente',
    }).eq('id', (a as any).id)
  }
  console.log(`Auto-closed ${toClose.length} past appointments.`)

  // ── 2. Send 24-hour reminders ───────────────────────────────────────────────
  // Fetch all confirmed, not-completed, not-reminded appointments with their slots + profiles
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      reason,
      slot:slot_id(date, start_time, end_time),
      patient:patient_id(full_name, email),
      doctor:doctor_id(full_name, email, specialty)
    `)
    .eq('status', 'confirmed')
    .eq('completed', false)
    .eq('reminder_sent', false)

  if (error) {
    console.error('Failed to fetch appointments:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }

  // Filter to appointments whose slot is ~24 hours from now (±30 min)
  const now = Date.now()
  const windowStart = now + 23.5 * 60 * 60 * 1000
  const windowEnd   = now + 24.5 * 60 * 60 * 1000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toRemind = (appointments ?? []).filter((appt: any) => {
    if (!appt.slot?.date || !appt.slot?.start_time) return false
    const apptTime = new Date(`${appt.slot.date}T${appt.slot.start_time}`).getTime()
    return apptTime >= windowStart && apptTime <= windowEnd
  })

  console.log(`Found ${toRemind.length} appointments to remind.`)

  let sent = 0
  let failed = 0

  for (const appt of toRemind) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = appt as any
    const fecha     = formatDate(a.slot.date)
    const hora      = `${formatTime(a.slot.start_time)} – ${formatTime(a.slot.end_time)}`
    const specialty = specialtyLabel(a.doctor?.specialty)
    const patientName = a.patient?.full_name ?? 'Paciente'
    const doctorName  = a.doctor?.full_name  ?? 'Doctor'
    const patientEmail = a.patient?.email
    const doctorEmail  = a.doctor?.email

    const apptData: ApptData = { fecha, hora, doctorName, patientName, specialty }

    try {
      const emailJobs: Promise<unknown>[] = []

      if (patientEmail) {
        emailJobs.push(sendEmail(
          patientEmail,
          '⏰ Recordatorio: Tu cita es mañana — Contigo',
          reminderPatientHtml(apptData, patientName),
        ))
      }

      if (doctorEmail) {
        emailJobs.push(sendEmail(
          doctorEmail,
          `⏰ Recordatorio: Cita mañana con ${patientName}`,
          reminderDoctorHtml(apptData, doctorName),
        ))
      }

      await Promise.all(emailJobs)

      // Mark as reminded
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', a.id)

      if (updateErr) {
        console.error(`Failed to mark reminder_sent for ${a.id}:`, updateErr)
      } else {
        sent++
      }
    } catch (err) {
      console.error(`Failed to send reminder for appointment ${a.id}:`, err)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ processed: toRemind.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
