import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import MiniCalendar from '../../components/MiniCalendar'
import { SPECIALTIES, specialtyLabel } from '../../lib/types'
import type { AvailabilitySlot, Specialty } from '../../lib/types'

// ── Email helpers ───────────────────────────────────────────────────────────

function fmtDate(d: string) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
function fmtTime(t: string) { return t.slice(0, 5) }

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:28px 32px;">
          <p style="margin:0;color:#fff;font-size:24px;font-weight:700;">contigo</p>
          <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Plataforma de Salud · Colombia</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;">${content}</td></tr>
        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 Contigo &nbsp;·&nbsp; <a href="https://contigomedicina.com" style="color:#94a3b8;text-decoration:none;">contigomedicina.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function apptCard(rows: { icon: string; label: string; value: string }[]) {
  const trs = rows.map(({ icon, label, value }) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">${icon} ${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${value}</td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin:20px 0;border:1px solid #e2e8f0;">${trs}</table>`
}

function confirmationPatientHtml(opts: {
  patientName: string; doctorName: string; specialty: string
  fecha: string; hora: string; reason: string | null
}) {
  const card = apptCard([
    { icon: '📅', label: 'Fecha',              value: opts.fecha },
    { icon: '⏰', label: 'Hora',               value: opts.hora },
    { icon: '👨‍⚕️', label: 'Doctor',            value: `Dr(a). ${opts.doctorName}` },
    { icon: '🏥', label: 'Especialidad',        value: opts.specialty },
    { icon: '📝', label: 'Motivo',             value: opts.reason || 'No especificado' },
  ])
  return emailWrapper(`
    <p style="margin:0 0 6px;color:#16a34a;font-size:22px;font-weight:700;">✅ Cita confirmada</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${opts.patientName},</p>
    <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">Tu cita ha sido confirmada exitosamente.</p>
    ${card}
    <p style="margin:16px 0 4px;color:#334155;font-size:14px;line-height:1.6;">
      Tu consulta será por <strong>videollamada</strong>. Recibirás un recordatorio 24 horas antes.<br>
      Si necesitas cancelar, puedes hacerlo desde tu calendario:
    </p>
    <p style="margin:0 0 24px;">
      <a href="https://contigomedicina.com/paciente/calendario" style="color:#1e3a5f;font-weight:600;font-size:14px;">contigomedicina.com/paciente/calendario</a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>
  `)
}

function confirmationDoctorHtml(opts: {
  doctorName: string; patientName: string; specialty: string
  fecha: string; hora: string; reason: string | null
}) {
  const card = apptCard([
    { icon: '📅', label: 'Fecha',              value: opts.fecha },
    { icon: '⏰', label: 'Hora',               value: opts.hora },
    { icon: '👤', label: 'Paciente',           value: opts.patientName },
    { icon: '🏥', label: 'Especialidad',        value: opts.specialty },
    { icon: '📝', label: 'Motivo de consulta', value: opts.reason || 'No especificado' },
  ])
  return emailWrapper(`
    <p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Nueva cita agendada</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola Dr(a). ${opts.doctorName},</p>
    <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">Tienes una nueva cita agendada.</p>
    ${card}
    <p style="margin:16px 0 24px;">
      <a href="https://contigomedicina.com/doctor/agenda" style="color:#1e3a5f;font-weight:600;font-size:14px;">Ver en tu agenda → contigomedicina.com/doctor/agenda</a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>
  `)
}

async function sendConfirmationEmails(opts: {
  patientEmail: string; patientName: string
  doctorEmail: string | null | undefined; doctorName: string; specialty: string
  fecha: string; hora: string; reason: string | null
}) {
  try {
    const jobs: Promise<unknown>[] = []

    jobs.push(supabase.functions.invoke('send-email', {
      body: {
        to: opts.patientEmail,
        subject: '✅ Tu cita médica está confirmada — Contigo',
        html: confirmationPatientHtml(opts),
      },
    }))

    if (opts.doctorEmail) {
      jobs.push(supabase.functions.invoke('send-email', {
        body: {
          to: opts.doctorEmail,
          subject: `📅 Nueva cita agendada — ${opts.patientName}`,
          html: confirmationDoctorHtml(opts),
        },
      }))
    }

    await Promise.all(jobs)
  } catch (err) {
    console.error('Confirmation email error (non-blocking):', err)
  }
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

export default function PatientAgendarPage() {
  const { profile } = useAuth()

  // Step state
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | ''>('')
  const [slots, setSlots]       = useState<AvailabilitySlot[]>([])
  const [loading, setLoading]   = useState(false)

  // Calendar
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Booking modal
  const [bookingSlot, setBookingSlot] = useState<AvailabilitySlot | null>(null)
  const [reason, setReason]           = useState('')
  const [submitting, setSubmitting]   = useState(false)

  // Feedback
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Active appointments per specialty (to block double-booking)
  const [activeSpecialties, setActiveSpecialties] = useState<Set<string>>(new Set())

  const fetchActiveSpecialties = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('appointments')
      .select('id, slot:slot_id(specialty, date, start_time), doctor:doctor_id(specialty)')
      .eq('patient_id', profile.id)
      .eq('status', 'confirmed')
      .eq('completed', false)
    const nowMs = Date.now()
    const set = new Set<string>()
    ;(data ?? []).forEach((a: any) => {
      // Skip appointments whose slot has already passed — don't block new bookings
      if (a.slot?.date && a.slot?.start_time) {
        const slotMs = new Date(`${a.slot.date}T${a.slot.start_time}`).getTime()
        if (slotMs < nowMs) return
      }
      const spec = a.slot?.specialty ?? a.doctor?.specialty
      if (spec) set.add(spec)
    })
    setActiveSpecialties(set)
  }, [profile])

  const fetchSlots = useCallback(async (specialty: Specialty) => {
    setLoading(true)
    setError(null)
    setSelectedDate(null)
    const todayStr = new Date().toISOString().slice(0, 10)
    const { data, error: err } = await supabase
      .from('availability_slots')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url)')
      .eq('is_booked', false)
      .gte('date', todayStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (err) {
      setError('No se pudieron cargar los horarios.')
      setSlots([])
    } else {
      const now = Date.now()
      // Filter by matching specialty, only keep slots at :00 or :30 starts, and exclude past slots
      const filtered = ((data ?? []) as AvailabilitySlot[]).filter(
        (s) =>
          (s.specialty === specialty || s.doctor?.specialty === specialty) &&
          (s.start_time.slice(3, 5) === '00' || s.start_time.slice(3, 5) === '30') &&
          new Date(`${s.date}T${s.start_time}`).getTime() > now
      )
      setSlots(filtered)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActiveSpecialties() }, [fetchActiveSpecialties])

  async function handleSpecialtyChange(spec: Specialty | '') {
    setSelectedSpecialty(spec)
    setSelectedDate(null)
    setBookingSlot(null)
    setSuccess(null)
    setError(null)
    if (spec) await fetchSlots(spec)
    else setSlots([])
  }

  async function handleBook() {
    if (!bookingSlot || !profile) return
    setSubmitting(true)
    setError(null)

    const { error: err } = await supabase.from('appointments').insert({
      patient_id: profile.id,
      doctor_id:  bookingSlot.doctor_id,
      slot_id:    bookingSlot.id,
      status:     'confirmed',
      reason:     reason.trim() || null,
    })

    if (err) {
      setError('No se pudo reservar la cita. Intenta con otro horario.')
    } else {
      setSuccess(
        `¡Cita confirmada con ${bookingSlot.doctor?.full_name ?? 'el doctor'} el ${formatDate(bookingSlot.date)} · ${formatTime(bookingSlot.start_time)}.`
      )

      // Fire-and-forget confirmation emails (non-blocking)
      if (profile.email) {
        const fecha = fmtDate(bookingSlot.date)
        const hora  = `${fmtTime(bookingSlot.start_time)} – ${fmtTime(bookingSlot.end_time)}`
        sendConfirmationEmails({
          patientEmail: profile.email,
          patientName:  profile.full_name ?? 'Paciente',
          doctorEmail:  bookingSlot.doctor?.email,
          doctorName:   bookingSlot.doctor?.full_name ?? 'Doctor',
          specialty:    specialtyLabel(bookingSlot.doctor?.specialty ?? selectedSpecialty as Specialty),
          fecha,
          hora,
          reason: reason.trim() || null,
        })
      }

      setBookingSlot(null)
      setReason('')
      setSelectedDate(null)
      await fetchSlots(selectedSpecialty as Specialty)
      await fetchActiveSpecialties()
    }
    setSubmitting(false)
  }

  // Build dot map: days with available slots
  const dotMap: Record<string, 'available'> = {}
  slots.forEach((s) => { dotMap[s.date] = 'available' })

  const daySlots = selectedDate
    ? slots.filter((s) => s.date === selectedDate).sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []

  const isBlocked = selectedSpecialty !== '' && activeSpecialties.has(selectedSpecialty)

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agendar Cita</h1>
          <p className="text-slate-500 text-sm mt-1">Elige especialidad, fecha y horario disponible.</p>
        </div>

        {/* Feedback banners */}
        {success && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <svg className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">¡Cita reservada!</p>
              <p className="text-emerald-700 mt-0.5">{success}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-5 h-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Step 1 — Specialty */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge n={1} active={true} />
            <h2 className="text-sm font-bold text-slate-900">Selecciona la especialidad</h2>
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => handleSpecialtyChange(e.target.value as Specialty | '')}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors bg-white"
          >
            <option value="">— Elige una especialidad —</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {isBlocked && (
            <div className="mt-3 flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Ya tienes una cita activa en {specialtyLabel(selectedSpecialty as Specialty)}. Cancela la cita actual antes de agendar una nueva.
            </div>
          )}
        </div>

        {/* Step 2 — Calendar (visible after specialty selected) */}
        {selectedSpecialty !== '' && !isBlocked && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <StepBadge n={2} active={true} />
              <h2 className="text-sm font-bold text-slate-900">Elige una fecha disponible</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 font-medium text-sm">No hay horarios disponibles para {specialtyLabel(selectedSpecialty as Specialty)}</p>
                <p className="text-slate-400 text-sm mt-1">Vuelve más tarde para ver nuevos horarios.</p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <MiniCalendar
                  year={calYear} month={calMonth}
                  dots={dotMap}
                  selected={selectedDate ?? undefined}
                  onSelectDate={(d) => {
                    setSelectedDate(d === selectedDate ? null : d)
                    setBookingSlot(null)
                  }}
                  onPrev={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
                    else setCalMonth(m => m - 1)
                  }}
                  onNext={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
                    else setCalMonth(m => m + 1)
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Time slots for selected day */}
        {selectedDate && daySlots.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <StepBadge n={3} active={true} />
              <h2 className="text-sm font-bold text-slate-900">
                Horarios disponibles · {formatDate(selectedDate)}
              </h2>
            </div>

            {/* Doctor info */}
            {daySlots[0]?.doctor && (
              <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-sm">
                    {(daySlots[0].doctor.full_name ?? 'D')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Dr(a). {daySlots[0].doctor.full_name}</p>
                  <p className="text-xs text-slate-500">{specialtyLabel(daySlots[0].doctor.specialty)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {daySlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => { setBookingSlot(slot); setReason(''); setSuccess(null) }}
                  className={`p-3 rounded-xl border text-center transition-colors ${
                    bookingSlot?.id === slot.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <p className="text-sm font-bold">{formatTime(slot.start_time)}</p>
                  <p className={`text-xs mt-0.5 ${bookingSlot?.id === slot.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    – {formatTime(slot.end_time)}
                  </p>
                </button>
              ))}
            </div>

            {bookingSlot && (
              <div className="mt-5 pt-5 border-t border-slate-100"
                style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <StepBadge n={4} active={true} />
                  <h3 className="text-sm font-bold text-slate-900">Motivo de consulta</h3>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Describe brevemente el motivo de tu consulta..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                />
                <div className="flex justify-between items-center mt-1.5 mb-3">
                  <p className="text-xs text-slate-400">
                    {reason.trim().length < 10
                      ? 'Por favor describe el motivo de tu consulta (mínimo 10 caracteres)'
                      : ''}
                  </p>
                  <p className={`text-xs shrink-0 ml-2 ${reason.trim().length >= 10 ? 'text-green-600' : 'text-slate-400'}`}>
                    {reason.trim().length}/10 caracteres mínimo
                  </p>
                </div>
                <button
                  onClick={handleBook}
                  disabled={submitting || reason.trim().length < 10}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-100"
                >
                  {submitting ? 'Reservando...' : `Confirmar cita · ${formatTime(bookingSlot.start_time)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {selectedDate && daySlots.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center py-8"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <p className="text-slate-500 text-sm">No hay horarios disponibles para este día.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
      {n}
    </span>
  )
}
