import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLabContext } from '../../contexts/LabContext'
import LabNavBar from '../../components/LabNavBar'

type Stats = { pending_orders: number; today_appts: number; month_completed: number; total_completed: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TodayAppt = any

function formatTime(t: string) { return t?.slice(0, 5) ?? '—' }

export default function LabDashboardPage() {
  const { lab } = useLabContext()
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [todayAppts, setTodayAppts] = useState<TodayAppt[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploadId,   setUploadId]   = useState<string | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async () => {
    if (!lab) return
    setLoading(true)
    const [{ data: statsData }, { data: apptData }] = await Promise.all([
      supabase.rpc('get_lab_dashboard_stats', { p_lab_id: lab.id }),
      supabase.rpc('get_lab_today_appointments', { p_lab_id: lab.id }),
    ])
    setStats(statsData as Stats)
    setTodayAppts((apptData as TodayAppt[]) ?? [])
    setLoading(false)
  }, [lab])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadId || !lab) return
    if (file.size > 20 * 1024 * 1024) { showToast('El archivo no puede superar 20 MB.'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${lab.id}/${uploadId}.${ext}`
    const { error: upErr } = await supabase.storage.from('lab-results').upload(path, file, { upsert: true })
    if (upErr) { showToast('Error al subir el archivo.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('lab-results').getPublicUrl(path)

    const appt = todayAppts.find((a: TodayAppt) => a.id === uploadId)
    await supabase.rpc('upload_lab_result', {
      p_appointment_id: uploadId,
      p_lab_id:         lab.id,
      p_result_url:     publicUrl,
    })
    if (appt?.patient_name) {
      supabase.functions.invoke('send-email', {
        body: {
          to: appt.patient_email,
          subject: '🔬 Tu resultado está disponible — Contigo',
          html: `<p>Hola ${appt.patient_name},</p><p>Tu resultado de <strong>${appt.exam_name}</strong> está disponible en tu historial médico en <a href="https://contigomedicina.com/paciente/examenes">contigomedicina.com</a>.</p>`,
        },
      }).catch(() => {})
    }
    if (appt?.doctor_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: appt.doctor_email,
          subject: `🔬 Resultado disponible — ${appt.patient_name}`,
          html: `<p>El resultado de <strong>${appt.exam_name}</strong> de tu paciente <strong>${appt.patient_name}</strong> está disponible.</p>`,
        },
      }).catch(() => {})
    }

    setUploadId(null)
    showToast('✅ Resultado subido. Paciente y médico notificados.')
    await fetchData()
    setUploading(false)
  }

  const statCards = stats ? [
    { label: 'Órdenes pendientes',   value: stats.pending_orders,  bg: 'bg-orange-50',  text: 'text-orange-700',  icon: '📋' },
    { label: 'Citas hoy',            value: stats.today_appts,     bg: 'bg-blue-50',    text: 'text-blue-700',    icon: '📅' },
    { label: 'Completados este mes', value: stats.month_completed, bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✅' },
    { label: 'Total realizados',     value: stats.total_completed, bg: 'bg-violet-50',  text: 'text-violet-700',  icon: '🔬' },
  ] : []

  return (
    <div className="min-h-screen bg-slate-50">
      <LabNavBar />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{lab?.name} · {lab?.city}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-5`}>
                  <p className="text-2xl mb-2">{s.icon}</p>
                  <p className={`text-3xl font-extrabold ${s.text}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-5">
                📅 Citas de hoy
                {todayAppts.length > 0 && (
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{todayAppts.length}</span>
                )}
              </h2>

              {todayAppts.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No hay citas programadas para hoy.</p>
              ) : (
                <div className="space-y-3">
                  {todayAppts.map((appt: TodayAppt) => (
                    <div key={appt.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-bold text-slate-700 shrink-0 tabular-nums">{formatTime(appt.slot_time)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{appt.patient_name}</p>
                          <p className="text-xs text-slate-500 truncate">{appt.exam_name}</p>
                          {appt.patient_phone && <p className="text-xs text-slate-400">{appt.patient_phone}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => { setUploadId(appt.id); fileRef.current?.click() }}
                        disabled={uploading}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {uploading && uploadId === appt.id ? 'Subiendo...' : 'Subir resultado'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
        onChange={handleUpload} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} />
    </div>
  )
}
