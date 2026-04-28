import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import DoctorVideoCall from '../../components/DoctorVideoCall'
import { specialtyLabel } from '../../lib/types'
import { useTranslation } from 'react-i18next'
import type { AvailabilitySlot, Appointment } from '../../lib/types'
import { generateSlots, roundUpToSlot } from '../../lib/slots'
import { createDailyRoom, createDailyToken } from '../../services/dailyService'
import { generateICS, downloadICS, buildGoogleCalendarUrl } from '../../utils/exportCalendar'
import type { ICSAppointment } from '../../utils/exportCalendar'

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

// Month names and day headers will come from i18n

export default function DoctorAgendaPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const MONTH_NAMES = t('months.capitalized', { returnObjects: true }) as string[]
  const DAY_HEADERS = t('days.short', { returnObjects: true }) as string[]

  const [tab, setTab] = useState<AgendaTab>('agenda')

  // Slots & appointments
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [history, setHistory]           = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  // Add slot form
  const [date, setDate]             = useState('')
  const [startTime, setStartTime]   = useState('')
  const [endTime, setEndTime]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formMode, setFormMode]     = useState<'specific' | 'recurring'>('specific')
  const [formOpen, setFormOpen]     = useState(true)
  // Recurring schedule
  const [selectedDays,  setSelectedDays]  = useState<number[]>([])
  const [recurWeeks,    setRecurWeeks]    = useState(2)
  const [confirmSlots,  setConfirmSlots]  = useState<Array<{ date: string; start_time: string; end_time: string }> | null>(null)
  const [confirming,    setConfirming]    = useState(false)
  const [recurSuccessMsg, setRecurSuccessMsg] = useState<string | null>(null)

  // Calendar
  const today = new Date()
  const todayStr   = today.toISOString().split('T')[0]
  const nowTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  // Slot modal
  const [detailSlot, setDetailSlot]     = useState<AvailabilitySlot | null>(null)
  const [summary, setSummary]           = useState('')
  const [completing, setCompleting]     = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // Prescription state (inside complete modal)
  type MedRow = { medicine_name: string; dose: string; instructions: string }
  const emptyMed = (): MedRow => ({ medicine_name: '', dose: '', instructions: '' })
  const [meds, setMeds]   = useState<MedRow[]>([emptyMed()])
  const [noMeds, setNoMeds] = useState(false)

  // History modal
  const [historyAppt, setHistoryAppt] = useState<Appointment | null>(null)

  // Diagnostic data for selected booked-slot appointment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [slotDiagFiles,  setSlotDiagFiles]  = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [slotDiagOrders, setSlotDiagOrders] = useState<any[]>([])

  // Video call
  const [videoAppt,    setVideoAppt]    = useState<Appointment | null>(null)
  const [videoToken,   setVideoToken]   = useState<string | null>(null)
  const [joiningVideo, setJoiningVideo] = useState(false)
  const [videoError,   setVideoError]   = useState<string | null>(null)

  // Calendar export
  const [exporting,   setExporting]   = useState(false)
  const [exportToast, setExportToast] = useState<string | null>(null)

  if (profile && !profile.specialty) {
    navigate('/doctor/setup', { replace: true })
    return null
  }

  const fetchData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    const fetchTodayStr = new Date().toISOString().split('T')[0]
    const [sR, aR, hR] = await Promise.all([
      supabase.from('availability_slots').select('*').eq('doctor_id', profile.id)
        .gte('date', fetchTodayStr)
        .order('date').order('start_time'),
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
      const nowMs = Date.now()
      const futureSlots = ((sR.data ?? []) as AvailabilitySlot[]).filter(
        (s) => new Date(`${s.date}T${s.start_time}`).getTime() > nowMs
      )
      setSlots(futureSlots)
      const futureSlotIds = new Set(futureSlots.map((s) => s.id))
      setAppointments(
        ((aR.data ?? []) as Appointment[]).filter((a) => futureSlotIds.has(a.slot_id))
      )
      setHistory((hR.data ?? []) as Appointment[])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch diagnostic data when a booked slot is opened
  useEffect(() => {
    if (!detailSlot) { setSlotDiagFiles([]); setSlotDiagOrders([]); return }
    const appt = appointments.find((a) => a.slot_id === detailSlot.id)
    if (!appt) { setSlotDiagFiles([]); setSlotDiagOrders([]); return }
    Promise.all([
      supabase.from('diagnostic_files')
        .select('id, file_name, file_url, stage, uploaded_at')
        .eq('appointment_id', appt.id)
        .eq('stage', 'pre_appointment')
        .order('uploaded_at', { ascending: true }),
      supabase.from('diagnostic_orders')
        .select('id, exam_type, status, notes')
        .eq('appointment_id', appt.id)
        .eq('status', 'completed'),
    ]).then(([filesRes, ordersRes]) => {
      setSlotDiagFiles(filesRes.data ?? [])
      setSlotDiagOrders(ordersRes.data ?? [])
    })
  }, [detailSlot, appointments])

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

  async function handleExportCalendar() {
    if (!profile) return
    setExporting(true)
    setExportToast(null)

    const todayStr = new Date().toISOString().slice(0, 10)

    const { data } = await supabase
      .from('appointments')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('id, reason, slot:slot_id(date, start_time, end_time), patient:patient_id(full_name)')
      .eq('doctor_id', profile.id)
      .eq('status', 'confirmed')
      .eq('completed', false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const future = ((data ?? []) as any[]).filter((a) => a.slot?.date >= todayStr)

    if (future.length === 0) {
      setExportToast('No tienes citas próximas para exportar')
      setExporting(false)
      setTimeout(() => setExportToast(null), 4000)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: ICSAppointment[] = future.map((a: any) => ({
      id:          a.id,
      reason:      a.reason,
      patientName: a.patient?.full_name ?? 'Paciente',
      specialty:   specialtyLabel(profile.specialty),
      slotDate:    a.slot.date,
      slotStart:   a.slot.start_time,
      slotEnd:     a.slot.end_time,
    }))

    const now = new Date()
    downloadICS(generateICS(events), now.getMonth(), now.getFullYear())
    setExporting(false)
  }

  const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const WEEKDAY_NAMES  = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

  function buildRecurringSlots() {
    if (selectedDays.length === 0 || !startTime || !endTime || endTime <= startTime) return []
    const nowMs = Date.now()
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const endDate = new Date(base); endDate.setDate(endDate.getDate() + recurWeeks * 7)
    const existingKeys = new Set(slots.map((s) => `${s.date}|${s.start_time}`))
    const result: Array<{ date: string; start_time: string; end_time: string }> = []
    const cur = new Date(base)
    while (cur < endDate) {
      const jsDay = cur.getDay()
      const displayIdx = jsDay === 0 ? 6 : jsDay - 1
      if (selectedDays.includes(displayIdx)) {
        const dateStr = cur.toISOString().split('T')[0]
        const generated = generateSlots(dateStr, startTime, endTime)
        for (const slot of generated) {
          if (new Date(`${dateStr}T${slot.start_time}`).getTime() <= nowMs) continue
          if (existingKeys.has(`${dateStr}|${slot.start_time}`)) continue
          result.push({ date: dateStr, start_time: slot.start_time, end_time: slot.end_time })
        }
      }
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  function handleAddRecurring(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)
    setRecurSuccessMsg(null)
    if (selectedDays.length === 0) { setFormError('Selecciona al menos un día de la semana.'); return }
    if (!startTime || !endTime) { setFormError('Completa los campos de hora.'); return }
    if (endTime <= startTime) { setFormError('La hora fin debe ser posterior al inicio.'); return }
    if (recurWeeks > 4) { setFormError('El máximo permitido es 4 semanas'); return }
    const generated = buildRecurringSlots()
    if (generated.length === 0) { setFormError('No se generarán horarios con los parámetros seleccionados.'); return }
    setConfirmSlots(generated)
  }

  async function handleConfirmRecurring() {
    if (!profile || !confirmSlots) return
    setConfirming(true)
    setFormError(null)
    const rows = confirmSlots.map((s) => ({
      doctor_id:  profile.id,
      specialty:  profile.specialty,
      date:       s.date,
      start_time: s.start_time,
      end_time:   s.end_time,
      is_booked:  false,
    }))
    const { error: err } = await supabase.from('availability_slots').insert(rows)
    setConfirming(false)
    if (err) {
      setFormError('No se pudieron crear los horarios. Intenta de nuevo.')
      setConfirmSlots(null)
    } else {
      const count = confirmSlots.length
      setConfirmSlots(null)
      setSelectedDays([])
      setStartTime('')
      setEndTime('')
      setRecurSuccessMsg(`✅ Se crearon ${count} slots exitosamente`)
      await fetchData()
    }
  }

  async function handleAddSlots(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setFormError(null)
    setFormSuccess(false)
    if (!date || !startTime || !endTime) { setFormError('Completa todos los campos.'); return }
    if (endTime <= startTime) { setFormError('La hora fin debe ser posterior al inicio.'); return }

    const nowCheck = new Date()
    const nowDateStr = nowCheck.toISOString().split('T')[0]
    const nowCheckTime = `${String(nowCheck.getHours()).padStart(2, '0')}:${String(nowCheck.getMinutes()).padStart(2, '0')}`
    if (date < nowDateStr || (date === nowDateStr && startTime <= nowCheckTime)) {
      setFormError('No puedes crear horarios en el pasado')
      return
    }

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

    if (!noMeds) {
      if (meds.length === 0) {
        setCompleteError(t('doctor.agenda.noMeds'))
        return
      }
      if (meds.some((m) => !m.medicine_name.trim() || !m.dose.trim() || !m.instructions.trim())) {
        setCompleteError('Completa todos los campos de los medicamentos.')
        return
      }
    }

    setCompleting(true)
    setCompleteError(null)

    const { error: apptErr } = await supabase
      .from('appointments')
      .update({ completed: true, completed_at: new Date().toISOString(), summary: summary.trim() || null })
      .eq('id', appt.id)
    if (apptErr) { setCompleteError('No se pudo completar la cita.'); setCompleting(false); return }

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

    await supabase.from('doctor_earnings').insert({ doctor_id: profile.id, appointment_id: appt.id, amount: 10 })

    setDetailSlot(null)
    setSummary('')
    setMeds([emptyMed()])
    setNoMeds(false)
    await fetchData()
    setCompleting(false)
  }

  const apptBySlot = new Map(appointments.map((a) => [a.slot_id, a]))

  // Build per-day slot counts for the calendar grid
  type DayCounts = { available: number; booked: number }
  const dayCounts: Record<string, DayCounts> = {}
  slots.forEach((s) => {
    if (s.is_booked && !apptBySlot.has(s.id)) return // completed — hide
    if (!dayCounts[s.date]) dayCounts[s.date] = { available: 0, booked: 0 }
    if (s.is_booked) dayCounts[s.date].booked++
    else dayCounts[s.date].available++
  })

  // Day slots: exclude completed-appointment slots
  const daySlots = selectedDate
    ? slots
        .filter((s) => s.date === selectedDate)
        .filter((s) => !s.is_booked || apptBySlot.has(s.id))
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []

  // Build calendar grid for current month
  function buildCalendarGrid(): (string | null)[] {
    const firstDay = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Convert to Mon-first (0=Mon, 6=Sun)
    const startOffset = firstDay === 0 ? 6 : firstDay - 1
    const cells: (string | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }

  const calendarCells = buildCalendarGrid()

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  function handleDayClick(d: string) {
    setSelectedDate(d === selectedDate ? null : d)
    // Pre-fill the specific date form field when clicking a day
    if (formMode === 'specific') setDate(d)
  }

  // Full-screen video call
  if (videoAppt && videoToken && videoAppt.daily_room_url && profile) {
    return (
      <DoctorVideoCall
        roomUrl={videoAppt.daily_room_url}
        token={videoToken}
        appointmentId={videoAppt.id}
        doctorId={profile.id}
        patientId={videoAppt.patient_id}
        onComplete={() => { setVideoAppt(null); setVideoToken(null); fetchData() }}
        onLeave={() => { setVideoAppt(null); setVideoToken(null) }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('doctor.agenda.title')}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{t('doctor.agenda.subtitle')}</p>
          </div>
          <button
            onClick={handleExportCalendar}
            disabled={exporting}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-blue-200 text-sm font-semibold text-blue-600 bg-white hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {exporting
              ? <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              : '📥'
            }
            Exportar agenda
          </button>
        </div>

        {exportToast && (
          <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span className="text-base">📭</span>
            {exportToast}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-2xl overflow-hidden">
          {([
            { key: 'agenda',    label: t('doctor.agenda.tab_agenda') },
            { key: 'historial', label: `${t('doctor.agenda.tab_history')} (${history.length})` },
          ] as { key: AgendaTab; label: string }[]).map((tab_item) => (
            <button key={tab_item.key} onClick={() => setTab(tab_item.key)}
              className={`px-6 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === tab_item.key
                  ? 'text-blue-700 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}>
              {tab_item.label}
            </button>
          ))}
        </div>

        {/* ── AGENDA TAB ── */}
        {tab === 'agenda' && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">

            {/* LEFT: Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Month navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <button onClick={prevMonth} aria-label={t('doctor.agenda.prevMonth')}
                  className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center">
                  ‹
                </button>
                <h2 className="text-base font-bold text-slate-900">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button onClick={nextMonth} aria-label={t('doctor.agenda.nextMonth')}
                  className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center">
                  ›
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {calendarCells.map((d, i) => {
                    if (!d) {
                      return <div key={`empty-${i}`} className="border-b border-r border-slate-50 min-h-[90px] bg-slate-50/50" />
                    }
                    const counts = dayCounts[d]
                    const isToday = d === todayStr
                    const isSelected = d === selectedDate
                    const isPast = d < todayStr
                    const dayNum = parseInt(d.split('-')[2], 10)

                    return (
                      <button
                        key={d}
                        onClick={() => handleDayClick(d)}
                        className={`min-h-[90px] border-b border-r border-slate-100 p-2 text-left transition-colors flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-100'
                            : isPast
                            ? 'bg-slate-50/50 hover:bg-slate-50'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mb-0.5 ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : isSelected
                            ? 'bg-blue-100 text-blue-700'
                            : isPast
                            ? 'text-slate-300'
                            : 'text-slate-700'
                        }`}>
                          {dayNum}
                        </span>
                        {counts && (
                          <div className="flex flex-col gap-0.5 w-full">
                            {counts.available > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 leading-tight truncate">
                                {counts.available} disp.
                              </span>
                            )}
                            {counts.booked > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 leading-tight truncate">
                                {counts.booked} cita{counts.booked > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {error && (
                <div className="m-4 flex gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div className="space-y-4">

              {/* Add availability form */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setFormOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs flex items-center justify-center font-bold">+</span>
                    {t('doctor.agenda.addAvailability')}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${formOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {formOpen && (
                  <div className="px-5 pb-5 border-t border-slate-100 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex gap-1 pt-4">
                      {(['specific', 'recurring'] as const).map((mode) => (
                        <button key={mode} type="button"
                          onClick={() => { setFormMode(mode); setFormError(null); setFormSuccess(false); setRecurSuccessMsg(null) }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            formMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}>
                          {mode === 'specific' ? 'Día específico' : 'Recurrente'}
                        </button>
                      ))}
                    </div>

                    {formError && (
                      <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {formError}
                      </div>
                    )}
                    {formSuccess && (
                      <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                        <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        ¡Horarios agregados con éxito!
                      </div>
                    )}
                    {recurSuccessMsg && (
                      <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                        <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {recurSuccessMsg}
                      </div>
                    )}

                    {/* ── MODE 1: Día específico ── */}
                    {formMode === 'specific' && (
                      <form onSubmit={handleAddSlots} className="space-y-3">
                        <p className="text-xs text-slate-400">Slots de 30 min en :00 y :30. Inicio redondeado al siguiente bloque.</p>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha</label>
                          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={todayStr}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Inicio</label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                              min={date === todayStr ? nowTimeStr : undefined}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fin</label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                          </div>
                        </div>
                        <button type="submit" disabled={submitting}
                          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                          {submitting ? 'Generando...' : 'Generar slots'}
                        </button>
                      </form>
                    )}

                    {/* ── MODE 2: Horario recurrente ── */}
                    {formMode === 'recurring' && (
                      <form onSubmit={handleAddRecurring} className="space-y-4">
                        <p className="text-xs text-slate-400">Genera horarios automáticamente para varios días a la vez.</p>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Días de la semana</label>
                          <div className="flex gap-1 flex-wrap">
                            {WEEKDAY_LABELS.map((day, i) => (
                              <button key={i} type="button"
                                onClick={() => setSelectedDays((prev) =>
                                  prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                                )}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                  selectedDays.includes(i)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:border-blue-300'
                                }`}>
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hora inicio</label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hora fin</label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Por cuántas semanas?</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {[1, 2, 3, 4].map((w) => (
                              <button key={w} type="button" onClick={() => setRecurWeeks(w)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  recurWeeks === w
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:border-blue-300'
                                }`}>
                                {w}sem
                              </button>
                            ))}
                          </div>
                        </div>

                        {(() => {
                          const preview = buildRecurringSlots()
                          if (preview.length === 0) return null
                          const [sy, sm, sd] = preview[0].date.split('-')
                          const [ey, em, ed] = preview[preview.length - 1].date.split('-')
                          return (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                              Se crearán <strong>{preview.length} slots</strong><br />
                              Del <strong>{sd}/{sm}/{sy}</strong> al <strong>{ed}/{em}/{ey}</strong>
                            </div>
                          )
                        })()}

                        <button type="submit"
                          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                          Revisar y confirmar
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Day detail panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedDate ? formatDate(selectedDate) : 'Selecciona un día'}
                  </h3>
                  {selectedDate && (
                    <span className="text-xs font-semibold text-slate-400">
                      {daySlots.length} horario{daySlots.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-500">Haz clic en un día del calendario</p>
                    </div>
                  ) : daySlots.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500">{t('doctor.agenda.noSlotsDay')}</p>
                      <p className="text-xs text-slate-400 mt-1">Usa el formulario para agregar disponibilidad.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => {
                        const appt = apptBySlot.get(slot.id)
                        return (
                          <button
                            key={slot.id}
                            onClick={() => { setDetailSlot(slot); setSummary(''); setCompleteError(null); setMeds([emptyMed()]); setNoMeds(false) }}
                            className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center gap-3 ${
                              slot.is_booked
                                ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                                : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${slot.is_booked ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800">
                                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                              </p>
                              {slot.is_booked && appt ? (
                                <p className="text-xs text-slate-600 truncate mt-0.5">
                                  {appt.patient?.full_name ?? '—'}
                                </p>
                              ) : (
                                <p className="text-xs text-emerald-600 mt-0.5">{t('doctor.agenda.availableSlot')}</p>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIAL TAB ── */}
        {tab === 'historial' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-600 font-medium text-sm">{t('doctor.agenda.noHistoryTitle')}</p>
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
          </div>
        )}
      </main>

      {/* ── Recurring schedule confirmation modal ── */}
      {confirmSlots && (() => {
        const [sy, sm, sd] = confirmSlots[0].date.split('-')
        const [ey, em, ed] = confirmSlots[confirmSlots.length - 1].date.split('-')
        const dayNames = [...selectedDays].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join(', ')
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            style={{ animation: 'backdrop-in 0.15s ease-out' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
              style={{ animation: 'modal-in 0.2s ease-out' }}>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Confirmar horario recurrente</h2>
              <p className="text-sm text-slate-700 leading-7 mb-6">
                ¿Confirmas crear <strong>{confirmSlots.length} slots</strong> de 30 minutos<br />
                los <strong>{dayNames}</strong><br />
                del <strong>{sd}/{sm}/{sy}</strong> al <strong>{ed}/{em}/{ey}</strong><br />
                de <strong>{startTime.slice(0, 5)}</strong> a <strong>{endTime.slice(0, 5)}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmSlots(null)} disabled={confirming}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleConfirmRecurring} disabled={confirming}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {confirming ? 'Creando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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

                  {/* Google Calendar link */}
                  <a
                    href={buildGoogleCalendarUrl({
                      patientName: appt.patient?.full_name ?? 'Paciente',
                      specialty:   specialtyLabel(profile?.specialty ?? null),
                      reason:      appt.reason,
                      slotDate:    detailSlot.date,
                      slotStart:   detailSlot.start_time,
                      slotEnd:     detailSlot.end_time,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    📅 Agregar a Google Calendar →
                  </a>

                  {/* Pre-appointment documents */}
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Documentos previos del paciente</p>
                    {slotDiagFiles.length === 0 ? (
                      <p className="text-xs text-slate-400">El paciente no adjuntó documentos previos.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {slotDiagFiles.map((f: any) => (
                          <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-700 truncate flex-1">📄 {f.file_name}</span>
                            <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                              Ver →
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Completed exam results */}
                  {slotDiagOrders.length > 0 && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">🔬 Resultados de exámenes</p>
                      <ul className="space-y-1.5">
                        {slotDiagOrders.map((o: any) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-700 flex-1">{o.exam_type}</span>
                            <span className="text-emerald-700 font-semibold shrink-0">Resultado subido ✓</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary */}
                  <div>
                    <label htmlFor="summary" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Conclusión / Diagnóstico
                    </label>
                    <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                      placeholder={t('doctor.agenda.summaryPlaceholder')}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none" />
                  </div>

                  {/* Medications section */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('doctor.agenda.prescribeMeds')}</p>
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
                          <span className="text-lg leading-none">+</span> {t('doctor.agenda.addMed')}
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
                      <span className="text-sm text-slate-600">{t('doctor.agenda.noMeds')}</span>
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
