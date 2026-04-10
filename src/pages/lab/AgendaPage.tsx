import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLabContext } from '../../contexts/LabContext'
import LabNavBar from '../../components/LabNavBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slot  = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Appt  = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExamType = any

const DAYS     = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const DURATIONS = [10, 20, 30, 45, 60]

function jsDay(d: Date) { return (d.getDay() + 6) % 7 }

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t?.slice(0, 5) ?? '—' }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function addDays(base: string, n: number) {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Generate time slots at `durationMin`-minute intervals within [start, end) */
function generateFreqSlots(date: string, start: string, end: string, durationMin: number) {
  const slots: { date: string; start_time: string; end_time: string }[] = []
  let [h, m] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const endMins = eh * 60 + em
  while (h * 60 + m + durationMin <= endMins) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const startT = `${pad(h)}:${pad(m)}:00`
    const totalEnd = h * 60 + m + durationMin
    const endT = `${pad(Math.floor(totalEnd / 60))}:${pad(totalEnd % 60)}:00`
    slots.push({ date, start_time: startT, end_time: endT })
    m += durationMin
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
  }
  return slots
}

function getDatesInRange(start: string, end: string, selDays: boolean[]) {
  const dates: string[] = []
  const d = new Date(start + 'T12:00:00')
  const e = new Date(end   + 'T12:00:00')
  while (d <= e) {
    if (selDays[jsDay(d)]) dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

interface ExamSchedule {
  exam_name: string
  startTime: string
  endTime: string
  duration: number
}

export default function LabAgendaPage() {
  const { lab } = useLabContext()
  const [slots,     setSlots]     = useState<Slot[]>([])
  const [appts,     setAppts]     = useState<Appt[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const [detailAppt, setDetailAppt] = useState<Appt | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Availability wizard state ──────────────────────────────────────────
  const [wizStep,    setWizStep]    = useState(1)
  const [examTypes,  setExamTypes]  = useState<ExamType[]>([])
  const [selExams,   setSelExams]   = useState<string[]>([])
  const [sameSchedule, setSameSchedule] = useState(true)
  const [selDays,    setSelDays]    = useState<boolean[]>(Array(7).fill(false))
  const [startDate,  setStartDate]  = useState(todayStr())
  const [endDate,    setEndDate]    = useState(addDays(todayStr(), 14))
  // Shared schedule (sameSchedule=true)
  const [startTime,  setStartTime]  = useState('07:00')
  const [endTime,    setEndTime]    = useState('17:00')
  const [duration,   setDuration]   = useState(30)
  // Per-exam schedules (sameSchedule=false)
  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([])
  const [adding,     setAdding]     = useState(false)
  const [wizError,   setWizError]   = useState<string | null>(null)
  // ─────────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 4000)
  }

  const fetchAll = useCallback(async () => {
    if (!lab) return
    setLoading(true)
    const [{ data: slotData }, { data: apptData }] = await Promise.all([
      supabase.rpc('get_lab_slots',        { p_lab_id: lab.id }),
      supabase.rpc('get_lab_appointments', { p_lab_id: lab.id }),
    ])
    setSlots((slotData as Slot[]) ?? [])
    setAppts((apptData as Appt[]) ?? [])
    setLoading(false)
  }, [lab])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function fetchExamTypes() {
    if (!lab) return
    const { data } = await supabase.rpc('get_lab_exam_types', { p_lab_id: lab.id })
    setExamTypes((data as ExamType[]) ?? [])
  }

  function openWizard() {
    setWizStep(1); setSelExams([]); setSameSchedule(true)
    setSelDays(Array(7).fill(false))
    setStartDate(todayStr()); setEndDate(addDays(todayStr(), 14))
    setStartTime('07:00'); setEndTime('17:00'); setDuration(30)
    setExamSchedules([]); setWizError(null)
    fetchExamTypes()
    setShowAdd(true)
  }

  function closeWizard() { setShowAdd(false); setAdding(false) }

  // Step 1 → 2
  function nextToStep2() {
    setWizError(null)
    if (selExams.length === 0) { setWizError('Selecciona al menos un examen.'); return }
    if (!sameSchedule) {
      setExamSchedules(selExams.map((name) => ({ exam_name: name, startTime: '07:00', endTime: '17:00', duration: 30 })))
    }
    setWizStep(2)
  }

  // Step 2 → 3 (preview)
  function nextToPreview() {
    setWizError(null)
    if (!selDays.some(Boolean))  { setWizError('Selecciona al menos un día.'); return }
    if (startDate > endDate)     { setWizError('La fecha de inicio debe ser anterior a la fecha de fin.'); return }
    if (sameSchedule && (startTime >= endTime)) { setWizError('La hora de inicio debe ser anterior a la hora de fin.'); return }
    if (!sameSchedule) {
      const bad = examSchedules.find((es) => es.startTime >= es.endTime)
      if (bad) { setWizError(`Horario inválido para: ${bad.exam_name}`); return }
    }
    setWizStep(3)
  }

  function buildAllSlots() {
    const dates = getDatesInRange(startDate, endDate, selDays)
    const result: { date: string; start_time: string; end_time: string; exam_name: string; duration_minutes: number }[] = []

    if (sameSchedule) {
      for (const examName of selExams) {
        for (const date of dates) {
          const base = generateFreqSlots(date, startTime, endTime, duration)
          base.forEach((s) => result.push({ ...s, exam_name: examName, duration_minutes: duration }))
        }
      }
    } else {
      for (const es of examSchedules) {
        for (const date of dates) {
          const base = generateFreqSlots(date, es.startTime, es.endTime, es.duration)
          base.forEach((s) => result.push({ ...s, exam_name: es.exam_name, duration_minutes: es.duration }))
        }
      }
    }
    return result
  }

  async function handleConfirm() {
    setAdding(true); setWizError(null)
    const allSlots = buildAllSlots()
    if (allSlots.length === 0) { setWizError('No se generaron horarios. Verifica los campos.'); setAdding(false); return }

    const { error } = await supabase.rpc('insert_lab_slots_v2', { p_slots: JSON.stringify(allSlots) as unknown as object })
    if (error) { setWizError('Error al guardar los horarios. Intenta de nuevo.'); setAdding(false); return }

    closeWizard()
    await fetchAll()
    showToast(`✅ ${allSlots.length} horarios agregados.`)
  }

  async function handleDeleteSlot(slotId: string) {
    if (!lab) return
    setDeleting(slotId)
    await supabase.rpc('delete_lab_slot', { p_slot_id: slotId, p_lab_id: lab.id })
    await fetchAll()
    setDeleting(null)
  }

  async function handleUploadResult(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !detailAppt || !lab) return
    if (file.size > 20 * 1024 * 1024) { showToast('El archivo no puede superar 20 MB.'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${lab.id}/${detailAppt.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('lab-results').upload(path, file, { upsert: true })
    if (upErr) { showToast('Error al subir el archivo.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('lab-results').getPublicUrl(path)
    await supabase.rpc('upload_lab_result', {
      p_appointment_id: detailAppt.id,
      p_lab_id:         lab.id,
      p_result_url:     publicUrl,
    })
    if (detailAppt.patient_email) {
      supabase.functions.invoke('send-email', {
        body: { to: detailAppt.patient_email, subject: '🔬 Tu resultado está disponible — Contigo',
          html: `<p>Hola ${detailAppt.patient_name}, tu resultado de <strong>${detailAppt.exam_name}</strong> está disponible en <a href="https://contigomedicina.com/paciente/examenes">contigomedicina.com</a>.</p>` },
      }).catch(() => {})
    }
    if (detailAppt.doctor_email) {
      supabase.functions.invoke('send-email', {
        body: { to: detailAppt.doctor_email, subject: `🔬 Resultado disponible — ${detailAppt.patient_name}`,
          html: `<p>El resultado de <strong>${detailAppt.exam_name}</strong> de tu paciente <strong>${detailAppt.patient_name}</strong> está disponible.</p>` },
      }).catch(() => {})
    }
    setDetailAppt(null)
    showToast('✅ Resultado subido. Paciente y médico notificados.')
    await fetchAll()
    setUploading(false)
  }

  // Preview data
  const previewSlots = showAdd && wizStep === 3 ? buildAllSlots() : []
  const previewByExam = selExams.map((name) => ({
    name,
    count: previewSlots.filter((s) => s.exam_name === name).length,
  }))

  const freeSlots   = slots.filter((s: Slot) => !s.is_booked)
  const bookedSlots = slots.filter((s: Slot) => s.is_booked)

  // Exam type grouped by category
  const labExams = examTypes.filter((e: ExamType) => e.category === 'laboratorio')
  const imgExams = examTypes.filter((e: ExamType) => e.category === 'imagenes')

  return (
    <div className="min-h-screen bg-slate-50">
      <LabNavBar />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Available slots ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Mis horarios disponibles
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{freeSlots.length}</span>
                </h2>
                <button onClick={openWizard}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                  + Agregar disponibilidad
                </button>
              </div>

              {freeSlots.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No tienes horarios disponibles. Agrega disponibilidad para recibir pacientes.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {freeSlots.map((slot: Slot) => (
                    <div key={slot.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div>
                        <p className="text-xs font-semibold text-emerald-800">{formatDate(slot.date)}</p>
                        <p className="text-xs text-emerald-600">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</p>
                        {slot.exam_name && <p className="text-xs text-emerald-500 mt-0.5 truncate">{slot.exam_name}</p>}
                      </div>
                      <button onClick={() => handleDeleteSlot(slot.id)} disabled={deleting === slot.id}
                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 text-lg leading-none" title="Eliminar">
                        {deleting === slot.id ? '...' : '×'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bookedSlots.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Horarios con cita agendada ({bookedSlots.length})</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {bookedSlots.map((slot: Slot) => (
                      <div key={slot.id} className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-800">{formatDate(slot.date)}</p>
                        <p className="text-xs text-blue-600">{formatTime(slot.start_time)}</p>
                        {slot.exam_name && <p className="text-xs text-blue-500 mt-0.5 truncate">{slot.exam_name}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Upcoming appointments ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">
                Citas programadas
                {appts.length > 0 && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{appts.length}</span>}
              </h2>

              {appts.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No hay citas programadas.</p>
              ) : (
                <div className="space-y-3">
                  {appts.map((appt: Appt) => (
                    <div key={appt.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => setDetailAppt(appt)}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                            {formatDate(appt.slot_date)} · {formatTime(appt.slot_time)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{appt.patient_name}</p>
                        <p className="text-xs text-slate-500 truncate">{appt.exam_name}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">Ver →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Add availability wizard modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6"
          onClick={(e) => { if (e.target === e.currentTarget) closeWizard() }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '90vh', animation: 'modal-in 0.2s ease-out' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Agregar disponibilidad</h2>
                <p className="text-xs text-slate-400 mt-0.5">Paso {wizStep} de 3</p>
              </div>
              <button onClick={closeWizard} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            {/* Step indicators */}
            <div className="flex gap-1.5 px-7 pt-3 shrink-0">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= wizStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
              {wizError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{wizError}</div>
              )}

              {/* ── Step 1: Select exams ── */}
              {wizStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">¿Para qué exámenes?</h3>
                    <button
                      onClick={() => {
                        const allNames = examTypes.map((e: ExamType) => e.exam_name)
                        setSelExams(selExams.length === allNames.length ? [] : allNames)
                      }}
                      className="text-xs text-emerald-600 font-semibold hover:underline"
                    >
                      {selExams.length === examTypes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>

                  {examTypes.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No tienes exámenes registrados.</p>
                  ) : (
                    <div className="space-y-3">
                      {labExams.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">🧪 Laboratorio Clínico</p>
                          <div className="space-y-1.5">
                            {labExams.map((e: ExamType) => {
                              const checked = selExams.includes(e.exam_name)
                              return (
                                <label key={e.exam_name}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                  <input type="checkbox" checked={checked} onChange={() =>
                                    setSelExams((prev) => checked ? prev.filter((n) => n !== e.exam_name) : [...prev, e.exam_name])
                                  } className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0" />
                                  <span className="text-sm text-slate-800">{e.exam_name}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {imgExams.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">📷 Imágenes Diagnósticas</p>
                          <div className="space-y-1.5">
                            {imgExams.map((e: ExamType) => {
                              const checked = selExams.includes(e.exam_name)
                              return (
                                <label key={e.exam_name}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                  <input type="checkbox" checked={checked} onChange={() =>
                                    setSelExams((prev) => checked ? prev.filter((n) => n !== e.exam_name) : [...prev, e.exam_name])
                                  } className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0" />
                                  <span className="text-sm text-slate-800">{e.exam_name}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selExams.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Horario</label>
                      <div className="flex gap-3">
                        {[
                          { label: 'Mismo para todos', value: true },
                          { label: 'Por examen',       value: false },
                        ].map(({ label, value }) => (
                          <button key={label}
                            onClick={() => setSameSchedule(value)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                              sameSchedule === value
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Schedule config ── */}
              {wizStep === 2 && (
                <div className="space-y-5">
                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fecha inicio</label>
                      <input type="date" value={startDate} min={todayStr()} onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fecha fin</label>
                      <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Días</label>
                    <div className="flex gap-2">
                      {DAYS.map((d, i) => (
                        <button key={d} type="button" title={DAY_FULL[i]}
                          onClick={() => setSelDays((prev) => prev.map((v, j) => j === i ? !v : v))}
                          className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${
                            selDays[i] ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shared schedule */}
                  {sameSchedule ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Hora inicio</label>
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Hora fin</label>
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Duración por turno</label>
                        <div className="flex gap-2 flex-wrap">
                          {DURATIONS.map((d) => (
                            <button key={d} onClick={() => setDuration(d)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                duration === d ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}>
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      {examSchedules.map((es, i) => (
                        <div key={es.exam_name} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                          <p className="text-xs font-bold text-slate-700">{es.exam_name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Hora inicio</label>
                              <input type="time" value={es.startTime}
                                onChange={(e) => setExamSchedules((prev) => prev.map((s, j) => j === i ? { ...s, startTime: e.target.value } : s))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Hora fin</label>
                              <input type="time" value={es.endTime}
                                onChange={(e) => setExamSchedules((prev) => prev.map((s, j) => j === i ? { ...s, endTime: e.target.value } : s))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1.5">Duración</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {DURATIONS.map((d) => (
                                <button key={d} onClick={() => setExamSchedules((prev) => prev.map((s, j) => j === i ? { ...s, duration: d } : s))}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                    es.duration === d ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}>
                                  {d} min
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Preview ── */}
              {wizStep === 3 && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Se crearán <span className="text-emerald-600">{previewSlots.length}</span> horarios en total.
                  </p>
                  <div className="space-y-2">
                    {previewByExam.map(({ name, count }) => (
                      <div key={name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-700">{name}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{count} turnos</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
                    <p>📅 {formatDate(startDate)} → {formatDate(endDate)}</p>
                    <p>📆 {DAYS.filter((_, i) => selDays[i]).join(', ')}</p>
                    {sameSchedule
                      ? <p>⏰ {startTime} – {endTime} · {duration} min/turno</p>
                      : <p>⏰ Horario por examen</p>
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 px-7 py-5 border-t border-slate-100 shrink-0">
              {wizStep > 1 ? (
                <button onClick={() => { setWizStep((s) => s - 1); setWizError(null) }} disabled={adding}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  ← Atrás
                </button>
              ) : (
                <button onClick={closeWizard}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              )}

              {wizStep === 1 && (
                <button onClick={nextToStep2} disabled={selExams.length === 0}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  Continuar →
                </button>
              )}
              {wizStep === 2 && (
                <button onClick={nextToPreview}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                  Ver resumen →
                </button>
              )}
              {wizStep === 3 && (
                <button onClick={handleConfirm} disabled={adding || previewSlots.length === 0}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {adding ? 'Guardando...' : `Confirmar (${previewSlots.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Appointment detail / upload modal ── */}
      {detailAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailAppt(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 space-y-5"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Detalle de cita</h2>
              <button onClick={() => setDetailAppt(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <div className="space-y-3 text-sm">
              {[
                { label: 'Paciente',  value: detailAppt.patient_name },
                { label: 'Teléfono', value: detailAppt.patient_phone },
                { label: 'Examen',   value: detailAppt.exam_name },
                { label: 'Doctor',   value: detailAppt.doctor_name },
                { label: 'Fecha',    value: formatDate(detailAppt.slot_date) },
                { label: 'Hora',     value: formatTime(detailAppt.slot_time) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 text-right">{value ?? '—'}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-6 border-2 border-dashed border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                    <span>Subiendo resultado...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Subir resultado (PDF / imagen, máx. 20 MB)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
        onChange={handleUploadResult} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} />
    </div>
  )
}
