import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLabSession } from '../../lib/labAuth'
import LabNavBar from '../../components/LabNavBar'
import { generateSlots } from '../../lib/slots'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slot  = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Appt  = any

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
// Monday=0..Sunday=6 (our index), JS getDay() Sunday=0 so offset
function jsDay(d: Date) { return (d.getDay() + 6) % 7 }

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t?.slice(0, 5) ?? '—' }

export default function LabAgendaPage() {
  const session = getLabSession()!
  const [slots,     setSlots]     = useState<Slot[]>([])
  const [appts,     setAppts]     = useState<Appt[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  // Detail/upload modal
  const [detailAppt, setDetailAppt] = useState<Appt | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Availability form
  const [selDays,    setSelDays]    = useState<boolean[]>(Array(7).fill(false))
  const [startTime,  setStartTime]  = useState('07:00')
  const [endTime,    setEndTime]    = useState('17:00')
  const [weeks,      setWeeks]      = useState(2)
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 4000)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: slotData }, { data: apptData }] = await Promise.all([
      supabase.rpc('get_lab_slots',        { p_lab_id: session.id }),
      supabase.rpc('get_lab_appointments', { p_lab_id: session.id }),
    ])
    setSlots((slotData as Slot[]) ?? [])
    setAppts((apptData as Appt[]) ?? [])
    setLoading(false)
  }, [session.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Preview count
  const previewCount = (() => {
    if (!selDays.some(Boolean) || !startTime || !endTime || startTime >= endTime) return 0
    let count = 0
    const today = new Date()
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if (!selDays[d]) continue
        const dt = new Date(today)
        const diff = ((d - jsDay(today)) + 7) % 7 + w * 7
        dt.setDate(today.getDate() + (diff === 0 && w === 0 ? 0 : diff || 7))
        count += generateSlots(dt.toISOString().slice(0, 10), startTime, endTime).length
      }
    }
    return count
  })()

  async function handleAddSlots() {
    if (!selDays.some(Boolean)) { setAddError('Selecciona al menos un día.'); return }
    if (!startTime || !endTime || startTime >= endTime) { setAddError('Horario inválido.'); return }
    setAdding(true); setAddError(null)
    const today = new Date()
    const allSlots: { date: string; start_time: string; end_time: string }[] = []

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if (!selDays[d]) continue
        const dt = new Date(today)
        const diff = ((d - jsDay(today)) + 7) % 7 + w * 7
        dt.setDate(today.getDate() + (diff === 0 && w === 0 ? 0 : diff || 7))
        const dateStr = dt.toISOString().slice(0, 10)
        generateSlots(dateStr, startTime, endTime).forEach((s) => {
          allSlots.push({ date: s.date, start_time: s.start_time, end_time: s.end_time })
        })
      }
    }

    if (allSlots.length === 0) { setAddError('No se generaron horarios. Verifica los campos.'); setAdding(false); return }

    await supabase.rpc('insert_lab_slots', {
      p_laboratory_id: session.id,
      p_slots: JSON.stringify(allSlots),
    })

    setShowAdd(false)
    setSelDays(Array(7).fill(false))
    setAdding(false)
    await fetchAll()
    showToast(`✅ ${allSlots.length} horarios agregados.`)
  }

  async function handleDeleteSlot(slotId: string) {
    setDeleting(slotId)
    await supabase.rpc('delete_lab_slot', { p_slot_id: slotId, p_lab_id: session.id })
    await fetchAll()
    setDeleting(null)
  }

  async function handleUploadResult(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !detailAppt) return
    if (file.size > 20 * 1024 * 1024) { showToast('El archivo no puede superar 20 MB.'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${session.id}/${detailAppt.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('lab-results').upload(path, file, { upsert: true })
    if (upErr) { showToast('Error al subir el archivo.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('lab-results').getPublicUrl(path)
    await supabase.rpc('upload_lab_result', {
      p_appointment_id: detailAppt.id,
      p_lab_id:         session.id,
      p_result_url:     publicUrl,
    })
    // Emails
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

  const freeSlots   = slots.filter((s: Slot) => !s.is_booked)
  const bookedSlots = slots.filter((s: Slot) => s.is_booked)

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
                <button onClick={() => { setShowAdd(true); setAddError(null) }}
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
                      </div>
                      <button onClick={() => handleDeleteSlot(slot.id)} disabled={deleting === slot.id}
                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 text-lg leading-none" title="Eliminar">
                        {deleting === slot.id ? '...' : '×'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Booked slots info */}
              {bookedSlots.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Horarios con cita agendada ({bookedSlots.length})</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {bookedSlots.map((slot: Slot) => (
                      <div key={slot.id} className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-800">{formatDate(slot.date)}</p>
                        <p className="text-xs text-blue-600">{formatTime(slot.start_time)}</p>
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

      {/* ── Add availability modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 space-y-5"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Agregar disponibilidad</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            {addError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{addError}</div>}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Días</label>
              <div className="flex gap-2">
                {DAYS.map((d, i) => (
                  <button key={d} type="button"
                    onClick={() => setSelDays((prev) => prev.map((v, j) => j === i ? !v : v))}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${
                      selDays[i] ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`} title={DAY_FULL[i]}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Semanas</label>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w} {w === 1 ? 'semana' : 'semanas'}</option>)}
              </select>
            </div>

            {previewCount > 0 && (
              <p className="text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                Se crearán <strong>{previewCount}</strong> horarios de 30 minutos.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAdd(false)} disabled={adding}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAddSlots} disabled={adding || previewCount === 0}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {adding ? 'Guardando...' : `Confirmar (${previewCount})`}
              </button>
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
