import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLabContext } from '../../contexts/LabContext'
import LabNavBar from '../../components/LabNavBar'
import { useTranslation } from 'react-i18next'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HistoryItem = any

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatDateTime(ts: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export default function LabHistorialPage() {
  const { t } = useTranslation()
  const { lab: session } = useLabContext()
  const [history,    setHistory]    = useState<HistoryItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterExam, setFilterExam] = useState('')

  const fetchHistory = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const { data } = await supabase.rpc('get_lab_history', { p_lab_id: session.id })
    setHistory((data as HistoryItem[]) ?? [])
    setLoading(false)
  }, [session])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const allExams = Array.from(new Set(history.map((h: HistoryItem) => h.exam_name))).sort()

  const filtered = history.filter((h: HistoryItem) => {
    const matchSearch = !search || (h.patient_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchExam   = !filterExam || h.exam_name === filterExam
    return matchSearch && matchExam
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <LabNavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('lab.historial.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('lab.historial.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('lab.historial.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
              <option value="">{t('lab.historial.allExams')}</option>
              {allExams.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-3">🔬</p>
              <p className="text-slate-600 font-medium">
                {history.length === 0 ? 'No hay exámenes completados aún.' : 'No hay resultados que coincidan.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Paciente', 'Examen', 'Fecha cita', 'Resultado subido', ''].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item: HistoryItem) => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{item.patient_name ?? '—'}</td>
                      <td className="py-3.5 px-4 text-slate-700">{item.exam_name}</td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {item.slot_date ? formatDate(item.slot_date) : '—'}
                        {item.slot_time ? ` · ${item.slot_time?.slice(0,5)}` : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(item.result_uploaded_at)}</td>
                      <td className="py-3.5 px-4">
                        {item.result_url ? (
                          <a href={item.result_url} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap">
                            Ver resultado
                          </a>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
