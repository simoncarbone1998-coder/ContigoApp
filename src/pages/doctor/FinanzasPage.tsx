import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import type { DoctorEarning } from '../../lib/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }
function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function DoctorFinanzasPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [earnings, setEarnings] = useState<DoctorEarning[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Guard: redirect to setup if no specialty
  if (profile && !profile.specialty) {
    navigate('/doctor/setup', { replace: true })
    return null
  }

  const fetchEarnings = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('doctor_earnings')
      .select('*, appointment:appointment_id(id, reason, summary, created_at, patient:patient_id(id, full_name, email), slot:slot_id(*))')
      .eq('doctor_id', profile.id)
      .order('created_at', { ascending: false })
    if (err) setError('No se pudieron cargar las ganancias.')
    else setEarnings((data ?? []) as DoctorEarning[])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  const totalEarned    = earnings.reduce((s, e) => s + Number(e.amount), 0)
  const thisMonthStr   = new Date().toISOString().slice(0, 7)
  const monthEarnings  = earnings.filter((e) => e.created_at.startsWith(thisMonthStr))
  const monthTotal     = monthEarnings.reduce((s, e) => s + Number(e.amount), 0)

  const stats = [
    { label: 'Total ganado', value: formatCurrency(totalEarned), icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Este mes', value: formatCurrency(monthTotal), icon: '📅', color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Citas completadas', value: earnings.length, icon: '✅', color: 'text-violet-700', bg: 'bg-violet-50' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión Financiera</h1>
          <p className="text-slate-500 text-sm mt-1">Resumen de tus ingresos por consultas completadas.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-5`}>
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Earnings table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-0">
            <h2 className="text-base font-bold text-slate-900 mb-5">Historial de Ingresos</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
            </div>
          ) : earnings.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium text-sm">Sin ingresos registrados</p>
              <p className="text-slate-400 text-sm mt-1">Los ingresos aparecen cuando completas una cita.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Paciente', 'Fecha', 'Monto', 'Notas'].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {(e.appointment as any)?.patient?.full_name ?? (e.appointment as any)?.patient?.email ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {(e.appointment as any)?.slot
                          ? `${formatDate((e.appointment as any).slot.date)} · ${formatTime((e.appointment as any).slot.start_time)}`
                          : formatDate(e.created_at.slice(0, 10))
                        }
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-emerald-700">{formatCurrency(Number(e.amount))}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate">
                        {(e.appointment as any)?.summary ?? '—'}
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
