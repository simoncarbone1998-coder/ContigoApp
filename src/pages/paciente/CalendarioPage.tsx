import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import MiniCalendar from '../../components/MiniCalendar'
import PatientVideoCall from '../../components/PatientVideoCall'
import { specialtyLabel } from '../../lib/types'
import { createDailyRoom, createDailyToken } from '../../services/dailyService'
import type { Appointment, AvailabilitySlot } from '../../lib/types'
import FeedbackModal from '../../components/FeedbackModal'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

/** Returns minutes until slot starts (negative = already started) */
function minutesUntil(slotDate: string, slotStartTime: string): number {
  const slotMs = new Date(`${slotDate}T${slotStartTime}`).getTime()
  return (slotMs - Date.now()) / 60000
}

export default function PatientCalendarioPage() {
  const { profile } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Appointment modal
  const [modalAppt, setModalAppt]         = useState<Appointment | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling]       = useState(false)
  const [cancelError, setCancelError]     = useState<string | null>(null)

  // Video call
  const [videoAppt,    setVideoAppt]    = useState<Appointment | null>(null)
  const [videoToken,   setVideoToken]   = useState<string | null>(null)
  const [joiningVideo, setJoiningVideo] = useState(false)
  const [videoError,   setVideoError]   = useState<string | null>(null)

  // Reschedule
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null)
  const [rscSlots,         setRscSlots]         = useState<AvailabilitySlot[]>([])
  const [rscLoading,       setRscLoading]       = useState(false)
  const [rscYear,          setRscYear]          = useState(today.getFullYear())
  const [rscMonth,         setRscMonth]         = useState(today.getMonth())
  const [rscDate,          setRscDate]          = useState<string | null>(null)
  const [rscSlot,          setRscSlot]          = useState<AvailabilitySlot | null>(null)
  const [rscStep,          setRscStep]          = useState<'picker' | 'confirming'>('picker')
  const [rscSaving,        setRscSaving]        = useState(false)
  const [rscError,         setRscError]         = useState<string | null>(null)
  const [calSuccess,       setCalSuccess]       = useState<string | null>(null)

  // Feedback
  const [feedbackAppt,   setFeedbackAppt]   = useState<Appointment | null>(null)
  const [feedbackToast,  setFeedbackToast]  = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('appointments')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url), slot:slot_id(*)')
      .eq('patient_id', profile.id)
      .eq('status', 'confirmed')
      .eq('completed', false)
      .order('created_at', { ascending: false })
    if (err) setError('No se pudieron cargar las citas.')
    else setAppointments((data ?? []) as Appointment[])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const checkFeedbackNeeded = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('appointments')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('*, doctor:doctor_id(id, full_name, specialty), slot:slot_id(date, start_time)')
      .eq('patient_id', profile.id)
      .eq('completed', true)
      .eq('status', 'confirmed')
      .order('completed_at', { ascending: false })
      .limit(10)
    if (!data?.length) return
    const apptIds = data.map((a: any) => a.id)
    const { data: existing } = await supabase
      .from('appointment_feedback')
      .select('appointment_id')
      .in('appointment_id', apptIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingIds = new Set((existing ?? []).map((f: any) => f.appointment_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const appt of data as any[]) {
      if (existingIds.has(appt.id)) continue
      const key = `feedback_shown_${appt.id}`
      if (sessionStorage.getItem(key)) continue
      sessionStorage.setItem(key, '1')
      setFeedbackAppt(appt as Appointment)
      break
    }
  }, [profile])

  useEffect(() => { checkFeedbackNeeded() }, [checkFeedbackNeeded])

  // Auto-create Daily rooms for appointments within 10 minutes
  useEffect(() => {
    if (appointments.length === 0) return
    for (const appt of appointments) {
      if (!appt.slot || appt.daily_room_url) continue
      const mins = minutesUntil(appt.slot.date, appt.slot.start_time)
      if (mins <= 10 && mins > -60) {
        createDailyRoom(appt.id)
          .then(({ name, url }) =>
            supabase.from('appointments').update({
              daily_room_name: name,
              daily_room_url: url,
              room_created_at: new Date().toISOString(),
            }).eq('id', appt.id)
          )
          .then(() => {
            setAppointments((prev) =>
              prev.map((a) =>
                a.id === appt.id
                  ? { ...a, daily_room_name: `consulta-${appt.id}`, daily_room_url: appt.daily_room_url ?? '' }
                  : a
              )
            )
            fetchAppointments()
          })
          .catch(() => { /* silently skip */ })
      }
    }
  }, [appointments, fetchAppointments])

  async function handleCancel() {
    if (!modalAppt) return
    setCancelling(true)
    setCancelError(null)
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', modalAppt.id)
    if (err) {
      setCancelError('No se pudo cancelar la cita. Intenta de nuevo.')
      setCancelling(false)
      return
    }
    setModalAppt(null)
    setConfirmCancel(false)
    await fetchAppointments()
    setCancelling(false)
  }

  async function handleStartReschedule(appt: Appointment) {
    setModalAppt(null)
    const now = new Date()
    setRscYear(now.getFullYear())
    setRscMonth(now.getMonth())
    setRscDate(null)
    setRscSlot(null)
    setRscStep('picker')
    setRscError(null)
    setRscLoading(true)
    setReschedulingAppt(appt)

    const specialty = appt.doctor?.specialty
    if (!specialty) { setRscLoading(false); return }

    const { data } = await supabase
      .from('availability_slots')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url)')
      .eq('is_booked', false)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    const nowMs = Date.now()
    const filtered = ((data ?? []) as AvailabilitySlot[]).filter(
      (s) =>
        s.id !== appt.slot_id &&
        (s.specialty === specialty || s.doctor?.specialty === specialty) &&
        (s.start_time.slice(3, 5) === '00' || s.start_time.slice(3, 5) === '30') &&
        new Date(`${s.date}T${s.start_time}`).getTime() > nowMs
    )

    setRscSlots(filtered)
    setRscLoading(false)
  }

  async function handleConfirmReschedule() {
    if (!reschedulingAppt || !rscSlot || !profile) return
    setRscSaving(true)
    setRscError(null)

    // Insert new appointment first → trigger books the new slot atomically
    const { error: insertErr } = await supabase.from('appointments').insert({
      patient_id: profile.id,
      doctor_id:  rscSlot.doctor_id,
      slot_id:    rscSlot.id,
      status:     'confirmed',
      reason:     reschedulingAppt.reason,
    })

    if (insertErr) {
      setRscError('No se pudo cambiar la cita. El horario puede no estar disponible. Intenta de nuevo.')
      setRscSaving(false)
      return
    }

    // Cancel old appointment → trigger frees the old slot
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', reschedulingAppt.id)

    // Fire-and-forget emails
    if (profile.email) {
      sendRescheduleEmails({
        patientEmail: profile.email,
        patientName:  profile.full_name ?? 'Paciente',
        doctorEmail:  rscSlot.doctor?.email,
        doctorName:   rscSlot.doctor?.full_name ?? 'Doctor',
        specialty:    specialtyLabel(rscSlot.doctor?.specialty),
        fecha:        formatDate(rscSlot.date),
        hora:         `${formatTime(rscSlot.start_time)} – ${formatTime(rscSlot.end_time)}`,
      })
    }

    setReschedulingAppt(null)
    setRscSaving(false)
    setCalSuccess('✅ Tu cita ha sido cambiada exitosamente')
    await fetchAppointments()
    setTimeout(() => setCalSuccess(null), 5000)
  }

  function sendRescheduleEmails(opts: {
    patientEmail: string; patientName: string
    doctorEmail: string | null | undefined; doctorName: string
    specialty: string; fecha: string; hora: string
  }) {
    const card = `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin:20px 0;border:1px solid #e2e8f0;"><tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">📅 Fecha</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${opts.fecha}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">⏰ Hora</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${opts.hora}</td></tr><tr><td style="padding:10px 0;color:#64748b;font-size:14px;">🏥 Especialidad</td><td style="padding:10px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${opts.specialty}</td></tr></table>`
    const wrap = (c: string) => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:28px 32px;"><p style="margin:0;color:#fff;font-size:24px;font-weight:700;">contigo</p><p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Plataforma de Salud · Colombia</p></td></tr><tr><td style="background:#fff;padding:32px;">${c}</td></tr><tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 Contigo · <a href="https://contigomedicina.com" style="color:#94a3b8;text-decoration:none;">contigomedicina.com</a></p></td></tr></table></td></tr></table></body></html>`

    const jobs: Promise<unknown>[] = [
      supabase.functions.invoke('send-email', {
        body: {
          to: opts.patientEmail,
          subject: '📅 Tu cita ha sido reprogramada — Contigo',
          html: wrap(`<p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Cita reprogramada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${opts.patientName},</p><p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">Tu cita ha sido reprogramada exitosamente.</p>${card}<p style="margin:8px 0 4px;color:#334155;font-size:14px;line-height:1.6;">Tu consulta será por <strong>videollamada</strong>. El botón para unirte aparecerá 5 minutos antes en tu <a href="https://contigomedicina.com/paciente/calendario" style="color:#1e3a5f;font-weight:600;">calendario</a>.</p><p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`),
        },
      }),
    ]
    if (opts.doctorEmail) {
      jobs.push(supabase.functions.invoke('send-email', {
        body: {
          to: opts.doctorEmail,
          subject: `📅 Cita reprogramada — ${opts.patientName}`,
          html: wrap(`<p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Cita reprogramada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola Dr(a). ${opts.doctorName},</p><p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.6;">El paciente <strong>${opts.patientName}</strong> ha reprogramado su cita.</p>${card}<p style="margin:16px 0 24px;"><a href="https://contigomedicina.com/doctor/agenda" style="color:#1e3a5f;font-weight:600;font-size:14px;">Ver en tu agenda → contigomedicina.com/doctor/agenda</a></p><p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`),
        },
      }))
    }
    Promise.all(jobs).catch((err) => console.error('Reschedule email error (non-blocking):', err))
  }

  async function handleJoinVideo(appt: Appointment) {
    if (!appt.slot) return
    setJoiningVideo(true)
    setVideoError(null)
    try {
      let roomName = appt.daily_room_name
      let roomUrl  = appt.daily_room_url

      if (!roomUrl) {
        const room = await createDailyRoom(appt.id)
        roomName = room.name
        roomUrl  = room.url
        await supabase.from('appointments').update({
          daily_room_name: roomName,
          daily_room_url:  roomUrl,
          room_created_at: new Date().toISOString(),
        }).eq('id', appt.id)
      }

      const token = await createDailyToken(roomName!, false)
      setVideoAppt({ ...appt, daily_room_url: roomUrl, daily_room_name: roomName })
      setVideoToken(token)
      setModalAppt(null)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'No se pudo crear la sala de video. Intenta de nuevo.')
    }
    setJoiningVideo(false)
  }

  function openModal(appt: Appointment) {
    setModalAppt(appt)
    setConfirmCancel(false)
    setCancelError(null)
    setVideoError(null)
  }

  const dotMap: Record<string, 'booked'> = {}
  appointments.forEach((a) => { if (a.slot?.date) dotMap[a.slot.date] = 'booked' })

  const dayAppointments = selectedDate
    ? appointments.filter((a) => a.slot?.date === selectedDate)
    : []

  // If in a video call, render the video call full screen
  if (videoAppt && videoToken && videoAppt.daily_room_url) {
    return (
      <PatientVideoCall
        roomUrl={videoAppt.daily_room_url}
        token={videoToken}
        onLeave={() => { setVideoAppt(null); setVideoToken(null); fetchAppointments(); checkFeedbackNeeded() }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Calendario</h1>
          <p className="text-slate-500 text-sm mt-1">Tus citas confirmadas pendientes.</p>
        </div>

        {calSuccess && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <svg className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {calSuccess}
          </div>
        )}

        {feedbackToast && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            {feedbackToast}
          </div>
        )}

        {error && (
          <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <MiniCalendar
                year={year} month={month}
                dots={dotMap}
                selected={selectedDate ?? undefined}
                onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
                onPrev={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
                onNext={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
              />
            )}
          </div>

          {/* Day detail */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium text-sm">Selecciona un día</p>
                <p className="text-slate-400 text-sm mt-1">Haz clic en una fecha marcada para ver tus citas.</p>
                {appointments.length === 0 && !loading && (
                  <p className="text-slate-400 text-xs mt-3">No tienes citas programadas.</p>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  Citas del {formatDate(selectedDate)}
                </h2>
                {dayAppointments.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">No tienes citas este día.</p>
                ) : (
                  <ul className="space-y-3">
                    {dayAppointments.map((appt) => {
                      const mins = appt.slot ? minutesUntil(appt.slot.date, appt.slot.start_time) : Infinity
                      const canJoin = mins <= 5 && mins > -60
                      const isExpired = appt.slot
                        ? new Date(`${appt.slot.date}T${appt.slot.start_time}`).getTime() < Date.now()
                        : false

                      return (
                        <li key={appt.id}>
                          {isExpired ? (
                            /* ── Expired: gray, no actions ── */
                            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1">
                                  <p className="text-sm font-semibold text-slate-500">
                                    Dr(a). {appt.doctor?.full_name ?? '—'}
                                  </p>
                                  {appt.slot && (
                                    <p className="text-xs text-slate-400">
                                      {formatTime(appt.slot.start_time)} – {formatTime(appt.slot.end_time)}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-400">
                                    {specialtyLabel(appt.doctor?.specialty)}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                  No atendida
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* ── Active: green, with video join ── */
                            <div className="p-4 rounded-xl border bg-emerald-50/60 border-emerald-200 space-y-3">
                              <button
                                onClick={() => openModal(appt)}
                                className="w-full text-left"
                              >
                                <div className="flex flex-col gap-1">
                                  <p className="text-sm font-semibold text-slate-900">
                                    Dr(a). {appt.doctor?.full_name ?? '—'}
                                  </p>
                                  {appt.slot && (
                                    <p className="text-xs text-slate-500">
                                      {formatTime(appt.slot.start_time)} – {formatTime(appt.slot.end_time)}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-400">
                                    {specialtyLabel(appt.doctor?.specialty)}
                                  </p>
                                </div>
                              </button>

                              {/* Join video button */}
                              <div className="pt-1 border-t border-emerald-200">
                                <button
                                  onClick={() => handleJoinVideo(appt)}
                                  disabled={!canJoin || joiningVideo}
                                  title={
                                    !canJoin && mins > 5
                                      ? `La consulta comenzará en ${Math.ceil(mins)} minutos`
                                      : undefined
                                  }
                                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                                    canJoin
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                  }`}
                                >
                                  📹
                                  {joiningVideo
                                    ? 'Conectando...'
                                    : canJoin
                                    ? 'Unirse a la consulta'
                                    : `Disponible en ${Math.ceil(mins)} min`}
                                </button>
                                {videoError && (
                                  <p className="text-xs text-red-600 mt-1.5 text-center">{videoError}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Appointment modal */}
      {modalAppt && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !cancelling) { setModalAppt(null); setConfirmCancel(false) } }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}
          >
            {!confirmCancel ? (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Detalle de cita</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {modalAppt.slot
                        ? `${formatDate(modalAppt.slot.date)} · ${formatTime(modalAppt.slot.start_time)} – ${formatTime(modalAppt.slot.end_time)}`
                        : '—'}
                    </p>
                  </div>
                  <button onClick={() => setModalAppt(null)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <InfoRow label="Médico" value={`Dr(a). ${modalAppt.doctor?.full_name ?? '—'}`} />
                  <InfoRow label="Especialización" value={specialtyLabel(modalAppt.doctor?.specialty)} />
                  {modalAppt.reason && <InfoRow label="Motivo de consulta" value={modalAppt.reason} />}
                </div>

                {cancelError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {cancelError}
                  </div>
                )}

                {(() => {
                  const isExp = !!(modalAppt.slot && new Date(`${modalAppt.slot.date}T${modalAppt.slot.start_time}`).getTime() < Date.now())
                  return (
                    <div className="space-y-2.5">
                      {!isExp && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartReschedule(modalAppt)}
                            className="flex-1 py-3 rounded-xl border-2 border-blue-200 text-sm font-semibold text-blue-600 bg-white hover:bg-blue-50 transition-colors"
                          >
                            Cambiar fecha
                          </button>
                          <button
                            onClick={() => setConfirmCancel(true)}
                            className="flex-1 py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-colors"
                          >
                            Cancelar cita
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => setModalAppt(null)}
                        className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-2xl mx-auto mb-5">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 text-center mb-2">¿Cancelar esta cita?</h2>
                <p className="text-sm text-slate-500 text-center mb-1">
                  Dr(a). {modalAppt.doctor?.full_name ?? '—'}
                </p>
                <p className="text-sm text-slate-500 text-center mb-6">
                  {modalAppt.slot
                    ? `${formatDate(modalAppt.slot.date)} · ${formatTime(modalAppt.slot.start_time)}`
                    : ''}
                </p>
                <p className="text-xs text-slate-400 text-center mb-6">
                  El horario quedará disponible para otros pacientes.
                </p>

                {cancelError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {cancelError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setConfirmCancel(false)} disabled={cancelling}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    No, volver
                  </button>
                  <button onClick={handleCancel} disabled={cancelling}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Feedback modal ── */}
      {feedbackAppt && profile && (
        <FeedbackModal
          appointment={feedbackAppt}
          patientId={profile.id}
          onClose={() => setFeedbackAppt(null)}
          onSubmitted={() => {
            setFeedbackAppt(null)
            setFeedbackToast('¡Gracias por tu calificación! 🌟')
            setTimeout(() => setFeedbackToast(null), 4000)
          }}
        />
      )}

      {/* ── Reschedule modal ── */}
      {reschedulingAppt && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !rscSaving) setReschedulingAppt(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-7 max-h-[90vh] overflow-y-auto"
            style={{ animation: 'modal-in 0.2s ease-out' }}
          >
            {rscStep === 'picker' ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Seleccionar nueva fecha</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {specialtyLabel(reschedulingAppt.doctor?.specialty)}
                    </p>
                  </div>
                  <button
                    onClick={() => setReschedulingAppt(null)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
                    aria-label="Cerrar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {rscLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : rscSlots.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-500 text-sm">No hay horarios disponibles para esta especialidad.</p>
                    <button
                      onClick={() => setReschedulingAppt(null)}
                      className="mt-4 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Calendar */}
                    <MiniCalendar
                      year={rscYear} month={rscMonth}
                      dots={(() => {
                        const d: Record<string, 'available'> = {}
                        rscSlots.forEach((s) => { d[s.date] = 'available' })
                        return d
                      })()}
                      selected={rscDate ?? undefined}
                      onSelectDate={(d) => { setRscDate(d === rscDate ? null : d); setRscSlot(null) }}
                      onPrev={() => { if (rscMonth === 0) { setRscMonth(11); setRscYear((y) => y - 1) } else setRscMonth((m) => m - 1) }}
                      onNext={() => { if (rscMonth === 11) { setRscMonth(0); setRscYear((y) => y + 1) } else setRscMonth((m) => m + 1) }}
                    />

                    {/* Time slots for selected day */}
                    {rscDate && (() => {
                      const daySlots = rscSlots
                        .filter((s) => s.date === rscDate)
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      if (daySlots.length === 0) return null
                      return (
                        <div className="mt-5" style={{ animation: 'modal-in 0.15s ease-out' }}>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            Horarios disponibles · {formatDate(rscDate)}
                          </p>

                          {/* Doctor info */}
                          {daySlots[0]?.doctor && (
                            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
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

                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {daySlots.map((slot) => (
                              <button
                                key={slot.id}
                                onClick={() => setRscSlot(rscSlot?.id === slot.id ? null : slot)}
                                className={`p-2.5 rounded-xl border text-center transition-colors ${
                                  rscSlot?.id === slot.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <p className="text-sm font-bold">{formatTime(slot.start_time)}</p>
                                <p className={`text-xs mt-0.5 ${rscSlot?.id === slot.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                  – {formatTime(slot.end_time)}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {rscSlot && (
                      <button
                        onClick={() => setRscStep('confirming')}
                        className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                        style={{ animation: 'modal-in 0.15s ease-out' }}
                      >
                        Confirmar cambio
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              /* ── Confirmation step ── */
              <div style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-2xl mx-auto mb-5">
                  <span className="text-2xl">📅</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 text-center mb-3">¿Confirmas el cambio?</h2>
                <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                  ¿Confirmas el cambio de tu cita a{' '}
                  <strong className="text-slate-700">{formatDate(rscSlot!.date)}</strong>{' '}
                  a las{' '}
                  <strong className="text-slate-700">{formatTime(rscSlot!.start_time)}</strong>{' '}
                  con{' '}
                  <strong className="text-slate-700">Dr(a). {rscSlot!.doctor?.full_name ?? '—'}</strong>?
                </p>

                {rscError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {rscError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setRscStep('picker')}
                    disabled={rscSaving}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleConfirmReschedule}
                    disabled={rscSaving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {rscSaving ? 'Cambiando...' : 'Sí, cambiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}
