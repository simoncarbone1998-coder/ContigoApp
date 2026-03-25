import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import MiniCalendar from '../../components/MiniCalendar'
import DoctorVideoCall from '../../components/DoctorVideoCall'
import { specialtyLabel } from '../../lib/types'
import type { AvailabilitySlot, Appointment } from '../../lib/types'
import { generateSlots, roundUpToSlot } from '../../lib/slots'
import { createDailyRoom, createDailyToken } from '../../services/dailyService'

/** Returns minutes until slot starts (negative = already started) */
function minutesUntil(slotDate: string, slotStartTime: string): number {
  const slotMs = new Date(`${slotDate}T${slotStartTime}`).getTime()
  return (slotMs - Date.now()) / 60000
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }
type AgendaTab = 'agenda' | 'historial'

export default function DoctorAgendaPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<AgendaTab>('agenda')

  // Slots & appointments
  const [slots, setSlots]             = useState<AvailabilitySlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [history, setHistory]         = useState<Appointment[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Add slot form
  const [date, setDate]           = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // Calendar
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Slot modal
  const [detailSlot, setDetailSlot] = useState<AvailabilitySlot | null>(null)
  const [summary, setSummary]       = useState('')
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Prescription state (inside complete modal)
  type MedRow = { medicine_name: string; dose: string; instructions: string }
  const emptyMed = (): MedRow => ({ medicine_name: '', dose: '', instructions: '' })
  const [meds, setMeds]   = useState<MedRow[]>([emptyMed()])
  const [noMeds, setNoMeds] = useState(false)

  // History modal
  const [historyAppt, setHistoryAppt] = useState<Appointment | null>(null)

  // Video call
  const [videoAppt,    setVideoAppt]    = useState<Appointment | null>(null)
  const [videoToken,   setVideoToken]   = useState<string | null>(null)
  const [joiningVideo, setJoiningVideo] = useState(false)
  const [videoError,   setVideoError]   = useState<string | null>(null)

  if (profile && !profile.specialty) {
    navigate('/doctor/setup', { replace: true })
    return null
  }

  const fetchData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    const [sR, aR, hR] = await Promise.all([
      supabase.from('availability_slots').select('*').eq('doctor_id', profile.id).order('date').order('start_time'),
      supabase.from('appointments')
        .select('*, patient:patient_id(id, full_name, email, phone, city, birth_date)')
        .eq('doctor_id', profile.id).eq('status', 'confirmed').eq('completed', false),
      supabase.from('appointments')
        .select('*, patient:patient_id(id, full_name, email, phone), slot:slot_id(*)')
        .eq('doctor_id', profile.id).eq('completed', true)
        .order('completed_at', { ascending: false }),
    ])
    if (sR.error || aR.error || hR.error) setError('No se pudo cargar la información.')
    else {
      setSlots((sR.data ?? []) as AvailabilitySlot[])
      setAppointments((aR.data ?? []) as Appointment[])
      setHistory((hR.data ?? []) as Appointment[])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-create Daily rooms for appointments within 10 minutes
  useEffect(() => {
    if (appointments.length === 0) return
    for (const appt of appointments) {
      const slot = slots.find((s) => s.id === appt.slot_id)
      if (!slot || appt.daily_room_url) continue
      const mins = minutesUntil(slot.date, slot.start_time)
      if (mins <= 10 && mins > -60) {
        createDailyRoom(appt.id)
          .then(({ name, url }) =>
            supabase.from('appointments').update({
              daily_room_name: name,
              daily_room_url: url,
              room_created_at: new Date().toISOString(),
            }).eq('id', appt.id)
          )
          .then(() => fetchData())
          .catch(() => { /* silently skip */ })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, slots])

  async function handleStartVideo(appt: Appointment, slot: AvailabilitySlot) {
    if (!profile) return
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

      const token = await createDailyToken(roomName!, true)
      setVideoAppt({ ...appt, daily_room_url: roomUrl, daily_room_name: roomName, slot })
      setVideoToken(token)
      setDetailSlot(null)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'No se pudo crear la sala de video. Intenta de nuevo.')
    }
    setJoiningVideo(false)
  }

  async function handleAddSlots(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setFormError(null)
    setFormSuccess(false)
    if (!date || !startTime || !endTime) { setFormError('Completa todos los campos.'); return }
    if (endTime <= startTime) { setFormError('La hora fin debe ser posterior al inicio.'); return }

    const generated = generateSlots(date, startTime, endTime)
    if (generated.length === 0) {
      const rounded = roundUpToSlot(startTime)
      setFormError(`El rango no alcanza para un slot de 30 min. El inicio redondeado sería ${formatTime(rounded)}.`)
      return
    }
    setSubmitting(true)
    const rows = generated.map((s) => ({ doctor_id: profile.id, specialty: profile.specialty, ...s }))
    const { error: err } = await supabase.from('availability_slots').insert(rows)
    if (err) setFormError('No se pudieron agregar los horarios.')
    else {
      setFormSuccess(true)
      setDate(''); setStartTime(''); setEndTime('')
      await fetchData()
    }
    setSubmitting(false)
  }

  async function handleDelete() {
    if (!detailSlot) return
    setDeleting(true)
    const { error: err } = await supabase.from('availability_slots').delete().eq('id', detailSlot.id)
    if (err) setError('No se pudo eliminar el horario.')
    else {
      setDetailSlot(null)
      await fetchData()
    }
    setDeleting(false)
  }

  async function handleComplete() {
    const appt = apptBySlot.get(detailSlot?.id ?? '')
    if (!appt || !profile || !detailSlot) return

    // Validate medications
    if (!noMeds) {
      if (meds.length === 0) {
        setCompleteError('Agrega al menos un medicamento o marca "No recetar medicamentos".')
        return
      }
      if (meds.some((m) => !m.medicine_name.trim() || !m.dose.trim() || !m.instructions.trim())) {
        setCompleteError('Completa todos los campos de los medicamentos.')
        return
      }
    }

    setCompleting(true)
    setCompleteError(null)

    // 1. Mark appointment completed
    const { error: apptErr } = await supabase
      .from('appointments')
      .update({ completed: true, completed_at: new Date().toISOString(), summary: summary.trim() || null })
      .eq('id', appt.id)
    if (apptErr) { setCompleteError('No se pudo completar la cita.'); setCompleting(false); return }

    // 2. Create prescription + items (unless skipped)
    if (!noMeds) {
      const { data: prescData, error: prescErr } = await supabase
        .from('prescriptions')
        .insert({
          appointment_id: appt.id,
          patient_id:     appt.patient_id,
          doctor_id:      profile.id,
          status:         'pendiente',
        })
        .select('id')
        .single()
      if (prescErr || !prescData) {
        setCompleteError('No se pudo crear la receta. La cita fue marcada como completada.')
        setCompleting(false)
        await fetchData()
        return
      }
      const items = meds.map((m) => ({
        prescription_id: prescData.id,
        medicine_name:   m.medicine_name.trim(),
        dose:            m.dose.trim(),
        instructions:    m.instructions.trim(),
      }))
      const { error: itemsErr } = await supabase.from('prescription_items').insert(items)
      if (itemsErr) {
        setCompleteError('No se pudieron guardar los medicamentos. La cita fue completada.')
        setCompleting(false)
        await fetchData()
        return
      }
    }

    // 3. Doctor earnings
    await supabase.from('doctor_earnings').insert({ doctor_id: profile.id, appointment_id: appt.id, amount: 10 })

    setDetailSlot(null)
    setSummary('')
    setMeds([emptyMed()])
    setNoMeds(false)
    await fetchData()
    setCompleting(false)
  }

  const apptBySlot = new Map(appointments.map((a) => [a.slot_id, a]))

  // Dot map: skip slots whose appointment has been completed (is_booked=true but not in apptBySlot)
  type DotVal = 'available' | 'booked' | 'both'
  const dotMap: Record<string, DotVal> = {}
  slots.forEach((s) => {
    if (s.is_booked && !apptBySlot.has(s.id)) return  // completed — hide from calendar
    const cur = dotMap[s.date]
    dotMap[s.date] = s.is_booked
      ? cur === 'available' ? 'both' : 'booked'
      : cur === 'booked' ? 'both' : 'available'
  })

  // Day slots: exclude completed-appointment slots (is_booked but no active appointment)
  const daySlots = selectedDate
    ? slots
        .filter((s) => s.date === selectedDate)
        .filter((s) => !s.is_booked || apptBySlot.has(s.id))
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []

  const stats = [
    { label: 'Total horarios', value: slots.length, icon: '🗓️' },
    { label: 'Disponibles', value: slots.filter((s) => !s.is_booked).length, icon: '✅' },
    { label: 'Reservados', value: slots.filter((s) => s.is_booked).length, icon: '👤' },
  ]

  // Full-screen video call
  if (videoAppt && videoToken && videoAppt.daily_room_url && profile) {
    return (
      <DoctorVideoCall
        roomUrl={videoAppt.daily_room_url}
        token={videoToken}
        appointmentId={videoAppt.id}
        doctorId={profile.id}
        onComplete={() => { setVideoAppt(null); setVideoToken(null); fetchData() }}
        onLeave={() => { setVideoAppt(null); setVideoToken(null) }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Agenda</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona tus horarios y consultas.</p>
        </div>

        {/* Sub-tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {([
              { key: 'agenda', label: 'Agenda' },
              { key: 'historial', label: `Historial (${history.length})` },
            ] as { key: AgendaTab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  tab === t.key
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── AGENDA TAB ── */}
          {tab === 'agenda' && (
            <div className="p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                    <p className="text-xl mb-1">{s.icon}</p>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Add slot form */}
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-1">Agregar disponibilidad</h2>
                <p className="text-xs text-slate-400 mb-4">Se generarán slots de 30 min en :00 y :30. El inicio se redondea al siguiente bloque.</p>

                {formError && (
                  <div className="mb-3 flex gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-3 flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    ¡Horarios agregados con éxito!
                  </div>
                )}

                <form onSubmit={handleAddSlots} className="grid sm:grid-cols-4 gap-3">
                  {[
                    { id: 'date', label: 'Fecha', type: 'date', value: date, onChange: setDate },
                    { id: 'start', label: 'Hora inicio', type: 'time', value: startTime, onChange: setStartTime },
                    { id: 'end', label: 'Hora fin', type: 'time', value: endTime, onChange: setEndTime },
                  ].map((f) => (
                    <div key={f.id}>
                      <label htmlFor={f.id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                      <input id={f.id} type={f.type} value={f.value} onChange={(e) => f.onChange(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors bg-white" />
                    </div>
                  ))}
                  <div className="flex items-end">
                    <button type="submit" disabled={submitting}
                      className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-100">
                      {submitting ? '...' : 'Generar'}
                    </button>
                  </div>
                </form>
              </div>

              {error && (
                <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Calendar + day detail */}
              <div className="grid lg:grid-cols-[320px_1fr] gap-5">
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
                  {loading ? (
                    <div className="flex justify-center py-10">
                      <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <MiniCalendar
                      year={year} month={month} dots={dotMap}
                      selected={selectedDate ?? undefined}
                      onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
                      onPrev={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
                      onNext={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
                    />
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
                  {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 border border-slate-200">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium text-sm">Selecciona un día</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-4">{formatDate(selectedDate)}</h3>
                      {daySlots.length === 0 ? (
                        <p className="text-slate-500 text-sm">No tienes horarios este día.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {daySlots.map((slot) => {
                            const appt = apptBySlot.get(slot.id)
                            return (
                              <button
                                key={slot.id}
                                onClick={() => { setDetailSlot(slot); setSummary(''); setCompleteError(null); setMeds([emptyMed()]); setNoMeds(false) }}
                                className={`p-3 rounded-xl border text-left transition-colors ${
                                  slot.is_booked
                                    ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                                    : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                                }`}
                              >
                                <p className="text-xs font-bold text-slate-800">
                                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                                </p>
                                {slot.is_booked && appt ? (
                                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                                    {appt.patient?.full_name ?? '—'}
                                  </p>
                                ) : (
                                  <p className="text-xs text-emerald-600 mt-0.5">Disponible</p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORIAL TAB ── */}
          {tab === 'historial' && (
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-600 font-medium text-sm">Sin citas en el historial</p>
                  <p className="text-slate-400 text-sm mt-1">Las citas completadas aparecerán aquí.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Paciente', 'Fecha', 'Especialización', ''].map((h) => (
                          <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((appt) => (
                        <tr key={appt.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 pr-4">
                            <span className="font-semibold text-slate-900">{appt.patient?.full_name ?? '—'}</span>
                          </td>
                          <td className="py-3.5 pr-4 text-slate-500 whitespace-nowrap">
                            {appt.slot ? `${formatDate(appt.slot.date)} · ${formatTime(appt.slot.start_time)}` : '—'}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                              {specialtyLabel(profile?.specialty ?? null)}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <button onClick={() => setHistoryAppt(appt)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Slot detail modal ── */}
      {detailSlot && (() => {
        const appt = apptBySlot.get(detailSlot.id)
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            style={{ animation: 'backdrop-in 0.15s ease-out' }}
            onClick={(e) => { if (e.target === e.currentTarget && !completing && !deleting) setDetailSlot(null) }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-7"
              style={{ animation: 'modal-in 0.2s ease-out' }}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {formatTime(detailSlot.start_time)} – {formatTime(detailSlot.end_time)}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">{formatDate(detailSlot.date)}</p>
                </div>
                <button onClick={() => setDetailSlot(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {detailSlot.is_booked && appt ? (
                <div className="space-y-5">
                  {/* Patient info */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Información del paciente</p>
                    <InfoRow label="Nombre completo" value={appt.patient?.full_name ?? '—'} />
                    <InfoRow label="Teléfono" value={appt.patient?.phone ?? 'No registrado'} />
                    <InfoRow label="Ciudad" value={appt.patient?.city ?? 'No registrada'} />
                    <InfoRow label="Fecha de nacimiento" value={appt.patient?.birth_date ?? 'No registrada'} />
                    {appt.reason && <InfoRow label="Motivo de consulta" value={appt.reason} />}
                  </div>

                  {/* Summary */}
                  <div>
                    <label htmlFor="summary" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Conclusión / Diagnóstico
                    </label>
                    <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                      placeholder="Notas de la consulta para el paciente..."
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none" />
                  </div>

                  {/* Medications section */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recetar medicamentos</p>
                    </div>

                    {!noMeds && (
                      <div className="space-y-2.5 mb-3">
                        {meds.map((med, i) => (
                          <div key={i} className="relative p-3 bg-slate-50 rounded-xl border border-slate-200">
                            {meds.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setMeds((m) => m.filter((_, j) => j !== i))}
                                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold transition-colors"
                                aria-label="Eliminar"
                              >
                                ×
                              </button>
                            )}
                            <input
                              type="text"
                              value={med.medicine_name}
                              onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, medicine_name: e.target.value } : x))}
                              placeholder="Nombre del medicamento"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 mb-2 bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={med.dose}
                                onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))}
                                placeholder="Dosis (ej: 500mg)"
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                              />
                              <input
                                type="text"
                                value={med.instructions}
                                onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))}
                                placeholder="ej: 1 pastilla cada 8 horas"
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                              />
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setMeds((m) => [...m, emptyMed()])}
                          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                        >
                          <span className="text-lg leading-none">+</span> Agregar medicamento
                        </button>
                      </div>
                    )}

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={noMeds}
                        onChange={(e) => setNoMeds(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                      />
                      <span className="text-sm text-slate-600">No recetar medicamentos en esta cita</span>
                    </label>
                  </div>

                  {completeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{completeError}</div>
                  )}

                  {/* Video consultation button */}
                  {(() => {
                    const mins = minutesUntil(detailSlot.date, detailSlot.start_time)
                    const canJoin = mins <= 5 && mins > -60
                    return (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <button
                          onClick={() => appt && handleStartVideo(appt, detailSlot)}
                          disabled={!canJoin || joiningVideo || completing}
                          title={
                            !canJoin && mins > 5
                              ? `La consulta comenzará en ${Math.ceil(mins)} minutos`
                              : undefined
                          }
                          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                            canJoin
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-100'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          }`}
                        >
                          📹
                          {joiningVideo
                            ? 'Conectando...'
                            : canJoin
                            ? 'Iniciar consulta'
                            : mins > 5
                            ? `Disponible en ${Math.ceil(mins)} min`
                            : 'Consulta finalizada'}
                        </button>
                        {videoError && (
                          <p className="text-xs text-red-600 text-center">{videoError}</p>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex gap-3">
                    <button onClick={() => setDetailSlot(null)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      Cerrar
                    </button>
                    <button onClick={handleComplete} disabled={completing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                      {completing ? 'Completando...' : 'Marcar completada'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Este horario está disponible y no ha sido reservado.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDetailSlot(null)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      Cerrar
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="flex-1 py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50">
                      {deleting ? 'Eliminando...' : 'Eliminar horario'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── History detail modal ── */}
      {historyAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryAppt(null) }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-start justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Cita completada</h2>
              <button onClick={() => setHistoryAppt(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <InfoRow label="Paciente" value={historyAppt.patient?.full_name ?? '—'} />
              <InfoRow label="Fecha y hora"
                value={historyAppt.slot
                  ? `${formatDate(historyAppt.slot.date)} · ${formatTime(historyAppt.slot.start_time)} – ${formatTime(historyAppt.slot.end_time)}`
                  : '—'} />
              <InfoRow label="Especialización" value={specialtyLabel(profile?.specialty ?? null)} />
              {historyAppt.reason && <InfoRow label="Motivo de consulta" value={historyAppt.reason} />}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Conclusión registrada</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 leading-relaxed">
                  {historyAppt.summary ?? 'Sin conclusión registrada.'}
                </p>
              </div>
            </div>

            <button onClick={() => setHistoryAppt(null)}
              className="mt-6 w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Cerrar
            </button>
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
