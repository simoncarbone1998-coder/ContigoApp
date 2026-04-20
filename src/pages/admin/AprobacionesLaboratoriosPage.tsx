import { useAdminCtx } from './AdminContext'
import { LabsSection } from './DashboardPage'

export default function AprobacionesLaboratoriosPage() {
  const {
    allLabs, labProcessingId, handleLabApprove,
    setLabRejectTarget, setLabRejectReason, setLabDetail,
  } = useAdminCtx()

  const pendingCount = (allLabs as { status: string }[]).filter((l) => l.status === 'pending').length

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Centros Diagnóstico</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pendingCount > 0
            ? `${pendingCount} centro${pendingCount !== 1 ? 's' : ''} esperan aprobación`
            : 'Todos los centros han sido revisados'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {allLabs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <span className="text-4xl mb-3">🔬</span>
            <p className="text-sm font-medium">No hay centros registrados aún.</p>
          </div>
        ) : (
          <div className="p-6">
            <LabsSection
              labs={allLabs}
              processingId={labProcessingId}
              onApprove={handleLabApprove}
              onReject={(lab) => { setLabRejectTarget(lab); setLabRejectReason('') }}
              onDetail={setLabDetail}
            />
          </div>
        )}
      </div>
    </div>
  )
}
