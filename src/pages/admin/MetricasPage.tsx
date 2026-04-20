import { useAdminCtx } from './AdminContext'
import { SPECIALTY_LABELS } from './AdminLayout'
import { StarsDisplay } from './DashboardPage'

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <p className="text-2xl mb-3">{icon}</p>
      <p className="text-3xl font-extrabold text-slate-900 leading-none">{value}</p>
      <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function MetricasPage() {
  const {
    allUsers, appointments, feedbacks, avgRating,
    monthlyApprovedPatients, apptsBySpecialty, doctorRatingsTable, loading,
  } = useAdminCtx()

  const activePatients = allUsers.filter((u) => u.role === 'patient' && (u.application_status === 'approved' || u.application_status === null)).length
  const activeDoctors  = allUsers.filter((u) => u.role === 'doctor' && u.doctor_status === 'approved').length

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const apptThisMonth = appointments.filter((a) => new Date(a.created_at) >= startOfMonth).length

  const maxCount = Math.max(...monthlyApprovedPatients.map((m) => m.count), 1)

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
    return d.toLocaleDateString('es-CO', { month: 'short' })
  }

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Métricas</h1>
        <p className="text-sm text-slate-500 mt-1">Resumen de actividad de la plataforma.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Pacientes activos" value={activePatients} />
        <StatCard icon="🗓️" label="Citas este mes" value={apptThisMonth} />
        <StatCard icon="🩺" label="Médicos activos" value={activeDoctors} />
        <StatCard icon="⭐" label="Calificación promedio" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} sub={`${(feedbacks as unknown[]).length} reseñas`} />
      </div>

      {/* Patient growth bar chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Pacientes aprobados — últimos 6 meses</h2>
        {monthlyApprovedPatients.every((m) => m.count === 0) ? (
          <p className="text-sm text-slate-400 text-center py-8">Sin datos aún</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {monthlyApprovedPatients.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">{m.count > 0 ? m.count : ''}</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${Math.max((m.count / maxCount) * 120, m.count > 0 ? 6 : 2)}px`,
                    background: m.count > 0 ? '#1e3a5f' : '#e2e8f0',
                  }}
                />
                <span className="text-[10px] text-slate-400 font-medium">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments by specialty */}
      {apptsBySpecialty.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">Citas por especialidad</h2>
          <div className="space-y-3">
            {apptsBySpecialty.map((row) => (
              <div key={row.specialty} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{SPECIALTY_LABELS[row.specialty] ?? row.specialty}</span>
                  <span className="text-slate-400 font-medium">{row.count} · {row.pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor ratings table */}
      {doctorRatingsTable.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Calificaciones por médico</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Médico', 'Especialidad', 'Citas', 'Promedio'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctorRatingsTable.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-6 py-3 text-slate-500">{SPECIALTY_LABELS[row.specialty] ?? row.specialty}</td>
                    <td className="px-6 py-3 text-slate-600">{row.totalAppts}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <StarsDisplay rating={row.avg} />
                        <span className="text-slate-600 font-medium text-xs">{row.avg.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
