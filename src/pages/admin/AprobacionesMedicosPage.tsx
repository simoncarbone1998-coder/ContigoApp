import { useAdminCtx } from './AdminContext'
import { specialtyLabel } from '../../lib/types'

function initials(name: string | null, email: string | null) {
  if (name) { const p = name.trim().split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0][0].toUpperCase() }
  return (email?.[0] ?? '?').toUpperCase()
}

export default function AprobacionesMedicosPage() {
  const {
    pendingDoctors, processingId, handleApprove, setRejectTarget, setRejectReason,
  } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Médicos</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pendingDoctors.length > 0
            ? `${pendingDoctors.length} médico${pendingDoctors.length !== 1 ? 's' : ''} esperan aprobación`
            : 'No hay solicitudes pendientes'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-amber-50">
          <span className="text-lg">⏳</span>
          <h2 className="text-base font-bold text-slate-900">Pendientes de aprobación</h2>
          {pendingDoctors.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingDoctors.length}</span>
          )}
        </div>
        {pendingDoctors.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <span className="text-4xl mb-3">✅</span>
            <p className="text-sm font-medium">No hay médicos pendientes</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingDoctors.map((doctor) => (
              <div key={doctor.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <span className="text-emerald-700 text-sm font-bold">{initials(doctor.full_name, doctor.email)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{doctor.full_name ?? '—'}</p>
                    <p className="text-sm text-slate-500">{doctor.email}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">
                      {doctor.specialty && <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{specialtyLabel(doctor.specialty)}</span>}
                      {doctor.undergraduate_university && <span className="bg-slate-100 px-2 py-0.5 rounded-md">{doctor.undergraduate_university}</span>}
                      {doctor.medical_license && <span className="bg-slate-100 px-2 py-0.5 rounded-md">T.P. {doctor.medical_license}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleApprove(doctor)} disabled={processingId === doctor.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {processingId === doctor.id ? '...' : 'Aprobar'}
                  </button>
                  <button onClick={() => { setRejectTarget(doctor); setRejectReason('') }} disabled={processingId === doctor.id}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
