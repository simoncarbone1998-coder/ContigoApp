import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import MiniCalendar from '../../components/MiniCalendar'
import PatientVideoCall from '../../components/PatientVideoCall'
import { specialtyLabel } from '../../lib/types'
import { createDailyRoom, createDailyToken } from '../../services/dailyService'
import type { Appointment } from '../../lib/types'

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
        onLeave={() => { setVideoAppt(null); setVideoToken(null); fetchAppointments() }}
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

                <div className="flex gap-3">
                  <button onClick={() => setModalAppt(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                    Cerrar
                  </button>
                  {!(modalAppt.slot && new Date(`${modalAppt.slot.date}T${modalAppt.slot.start_time}`).getTime() < Date.now()) && (
                    <button onClick={() => setConfirmCancel(true)}
                      className="flex-1 py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-colors">
                      Cancelar cita
                    </button>
                  )}
                </div>
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
