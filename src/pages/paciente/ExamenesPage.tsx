import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

// ── Constants ─────────────────────────────────────────────────────────────────

const LABS = [
  'LabClínicos Bogotá Norte',
  'Laboratorio Colsanitas Chapinero',
  'Labs Santa Fe Centro',
  'Laboratorio Medilaser Suba',
  'LabClínicos Bogotá Sur',
]

function getFakeSlots() {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const tom  = new Date(); tom.setDate(tom.getDate() + 1)
  const day2 = new Date(); day2.setDate(day2.getDate() + 2)
  const label = (d: Date) => `${d.getDate()}/${d.getMonth() + 1} (${days[d.getDay()]})`
  return [
    { short: 'Mañana 8:00 AM',         full: `${label(tom)} · 8:00 AM` },
    { short: 'Mañana 9:30 AM',         full: `${label(tom)} · 9:30 AM` },
    { short: 'Mañana 11:00 AM',        full: `${label(tom)} · 11:00 AM` },
    { short: 'Pasado mañana 8:00 AM',  full: `${label(day2)} · 8:00 AM` },
    { short: 'Pasado mañana 10:00 AM', full: `${label(day2)} · 10:00 AM` },
    { short: 'Pasado mañana 2:00 PM',  full: `${label(day2)} · 2:00 PM` },
  ]
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DiagOrder = {
  id: string
  appointment_id: string
  patient_id: string
  doctor_id: string
  exam_type: string
  status: 'pending' | 'scheduled' | 'completed'
  notes: string | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doctor: any
  result_file: { file_url: string; file_name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending')
    return <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Pendiente</span>
  if (status === 'scheduled')
    return <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Agendado</span>
  return <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Completado ✓</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PatientExamenesPage() {
  const { profile } = useAuth()

  const [orders, setOrders]   = useState<DiagOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Schedule modal
  const [scheduleOrder, setScheduleOrder] = useState<DiagOrder | null>(null)
  const [selectedLab,   setSelectedLab]   = useState('')
  const [selectedSlot,  setSelectedSlot]  = useState<number | null>(null)
  const [scheduling,    setScheduling]    = useState(false)
  const [scheduleOk,    setScheduleOk]    = useState<string | null>(null)

  // Upload result modal
  const [uploadOrder, setUploadOrder] = useState<DiagOrder | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadOk,    setUploadOk]    = useState<string | null>(null)
  const [uploadErr,   setUploadErr]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchOrders = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('diagnostic_orders')
      .select('*, doctor:doctor_id(full_name, email)')
      .eq('patient_id', profile.id)
      .order('created_at', { ascending: false })

    const list = (data ?? []) as DiagOrder[]

    // Fetch result files for completed orders
    const completedIds = list.filter((o) => o.status === 'completed').map((o) => o.id)
    const resultMap: Record<string, { file_url: string; file_name: string }> = {}
    if (completedIds.length > 0) {
      const { data: fData } = await supabase
        .from('diagnostic_files')
        .select('diagnostic_order_id, file_url, file_name')
        .in('diagnostic_order_id', completedIds)
        .eq('stage', 'result')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fData ?? []).forEach((f: any) => {
        if (f.diagnostic_order_id) resultMap[f.diagnostic_order_id] = f
      })
    }

    setOrders(list.map((o) => ({ ...o, result_file: resultMap[o.id] ?? null })))
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleSchedule() {
    if (!scheduleOrder || !selectedLab || selectedSlot === null) return
    setScheduling(true)
    const slots = getFakeSlots()
    const slot  = slots[selectedSlot]
    await supabase.from('diagnostic_orders').update({ status: 'scheduled' }).eq('id', scheduleOrder.id)
    setScheduleOk(
      `✅ Tu examen ha sido agendado en ${selectedLab} el ${slot.full}.\nEl laboratorio te contactará para confirmar los detalles.`
    )
    await fetchOrders()
    setScheduling(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadOrder || !profile) return
    if (file.size > 10 * 1024 * 1024) { setUploadErr('El archivo no puede superar 10 MB.'); return }

    setUploading(true)
    setUploadErr(null)

    const ext  = file.name.split('.').pop()
    const path = `results/${profile.id}/${uploadOrder.id}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('diagnostic-files')
      .upload(path, file, { upsert: true })

    if (upErr) {
      setUploadErr('No se pudo subir el archivo. Intenta de nuevo.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('diagnostic-files').getPublicUrl(path)

    await Promise.all([
      supabase.from('diagnostic_files').insert({
        diagnostic_order_id: uploadOrder.id,
        appointment_id:      uploadOrder.appointment_id,
        patient_id:          profile.id,
        file_url:            publicUrl,
        file_name:           file.name,
        file_size:           `${(file.size / 1024).toFixed(0)} KB`,
        stage:               'result',
      }),
      supabase.from('diagnostic_orders').update({ status: 'completed' }).eq('id', uploadOrder.id),
    ])

    // Notify doctor (fire-and-forget)
    if (uploadOrder.doctor?.email) {
      supabase.functions.invoke('send-email', {
        body: {
          to:      uploadOrder.doctor.email,
          subject: `🔬 Resultado de examen disponible — ${profile.full_name ?? 'Paciente'}`,
          html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;padding:32px;background:#f8fafc;">
            <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
              <p style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 16px;">🔬 Resultado de examen disponible</p>
              <p style="color:#475569;font-size:15px;margin:0 0 8px;">Hola Dr(a). ${uploadOrder.doctor.full_name},</p>
              <p style="color:#475569;font-size:15px;margin:0 0 16px;">
                Tu paciente <strong>${profile.full_name}</strong> ha subido el resultado de
                <strong>${uploadOrder.exam_type}</strong>.
              </p>
              <a href="https://contigomedicina.com/doctor/agenda"
                style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
                Ver en Mi Agenda →
              </a>
            </div>
          </body></html>`,
        },
      }).catch(() => {})
    }

    setUploadOk('✅ Resultado subido exitosamente. Tu médico ha sido notificado.')
    await fetchOrders()
    setUploading(false)
  }

  const pending   = orders.filter((o) => o.status === 'pending' || o.status === 'scheduled')
  const completed = orders.filter((o) => o.status === 'completed')
  const fakeSlots = getFakeSlots()

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exámenes Diagnósticos</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona los exámenes ordenados por tu médico.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Pending ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-bold text-slate-900">🔬 Exámenes pendientes</h2>
                {pending.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{pending.length}</span>
                )}
              </div>

              {pending.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center gap-3">
                  <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-slate-500 text-sm font-medium">No tienes exámenes pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((order) => (
                    <div key={order.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{order.exam_type}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Dr(a). {order.doctor?.full_name ?? '—'} · {formatDate(order.created_at.slice(0, 10))}
                          </p>
                          {order.notes && (
                            <p className="text-xs text-slate-600 mt-1 italic">"{order.notes}"</p>
                          )}
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex gap-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setScheduleOrder(order)
                            setSelectedLab('')
                            setSelectedSlot(null)
                            setScheduleOk(null)
                          }}
                          disabled={order.status === 'scheduled'}
                          className="flex-1 py-2 rounded-lg border border-blue-200 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {order.status === 'scheduled' ? '📅 Agendado' : 'Agendar examen'}
                        </button>
                        <button
                          onClick={() => {
                            setUploadOrder(order)
                            setUploadOk(null)
                            setUploadErr(null)
                          }}
                          className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                        >
                          📎 Subir resultado
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Completed ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">✅ Exámenes realizados</h2>

              {completed.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No tienes exámenes completados.</p>
              ) : (
                <div className="space-y-3">
                  {completed.map((order) => (
                    <div key={order.id} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{order.exam_type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Dr(a). {order.doctor?.full_name ?? '—'}</p>
                        <p className="text-xs text-emerald-700 font-semibold mt-1">Resultado disponible ✓</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={order.status} />
                        {order.result_file && (
                          <a
                            href={order.result_file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                          >
                            Ver resultado
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Schedule modal ── */}
      {scheduleOrder && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setScheduleOrder(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto"
            style={{ animation: 'modal-in 0.2s ease-out', maxHeight: '90vh' }}
          >
            <div className="px-7 pt-7 pb-7 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Agendar tu examen</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Selecciona un laboratorio y horario disponible</p>
                  <span className="inline-block mt-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                    🔬 {scheduleOrder.exam_type}
                  </span>
                </div>
                <button
                  onClick={() => setScheduleOrder(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {scheduleOk ? (
                <>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 whitespace-pre-line">
                    {scheduleOk}
                  </div>
                  <button
                    onClick={() => setScheduleOrder(null)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                  >
                    Listo
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Laboratorio</label>
                    <select
                      value={selectedLab}
                      onChange={(e) => setSelectedLab(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white transition-colors"
                    >
                      <option value="">— Selecciona un laboratorio —</option>
                      {LABS.map((lab) => <option key={lab} value={lab}>{lab}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Horario disponible</label>
                    <div className="grid grid-cols-2 gap-2">
                      {fakeSlots.map((slot, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedSlot(i)}
                          className={`p-3 rounded-xl border text-left text-xs font-medium transition-colors ${
                            selectedSlot === i
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {slot.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setScheduleOrder(null)}
                      disabled={scheduling}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSchedule}
                      disabled={!selectedLab || selectedSlot === null || scheduling}
                      className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {scheduling ? 'Agendando...' : 'Confirmar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload result modal ── */}
      {uploadOrder && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setUploadOrder(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}
          >
            <h2 className="text-lg font-bold text-slate-900 mb-1">Subir resultado</h2>
            <p className="text-sm text-slate-600 font-medium mb-0.5">🔬 {uploadOrder.exam_type}</p>
            <p className="text-xs text-slate-400 mb-5">PDF, JPG o PNG · Máximo 10 MB</p>

            {uploadOk ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">{uploadOk}</div>
                <button
                  onClick={() => setUploadOrder(null)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                >
                  Listo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadErr && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{uploadErr}</div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-6 border-2 border-dashed border-blue-200 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Seleccionar archivo</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  onClick={() => setUploadOrder(null)}
                  className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
