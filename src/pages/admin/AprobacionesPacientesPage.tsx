import { useAdminCtx } from './AdminContext'
import { ApplicationsSection } from './DashboardPage'

export default function AprobacionesPacientesPage() {
  const {
    applications, questionnaires, appProcessingId, expandedQuestions, setExpandedQuestions,
    historyFilter, setHistoryFilter, historySearch, setHistorySearch,
    handleAppApprove, setAppRejectTarget, setAppRejectNote,
  } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Aplicaciones de pacientes</h1>
        <p className="text-sm text-slate-500 mt-1">Revisa y decide sobre cada solicitud de ingreso al plan.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <ApplicationsSection
          applications={applications}
          questionnaires={questionnaires}
          processingId={appProcessingId}
          expandedQuestions={expandedQuestions}
          onToggleQuestions={(id) => setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }))}
          historyFilter={historyFilter}
          onHistoryFilterChange={setHistoryFilter}
          historySearch={historySearch}
          onHistorySearchChange={setHistorySearch}
          onApprove={handleAppApprove}
          onReject={(app) => { setAppRejectTarget(app); setAppRejectNote('') }}
        />
      </div>
    </div>
  )
}
