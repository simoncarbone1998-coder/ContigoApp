import { useAdminCtx } from './AdminContext'
import { RatingsSection, ExamsSection } from './DashboardPage'

export default function CalificacionesPage() {
  const { feedbacks, avgRating, diagOrders, loading } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Calificaciones y Exámenes</h1>
        <p className="text-sm text-slate-500 mt-1">Calificaciones de médicos y órdenes de diagnóstico.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Calificaciones</h2>
            <RatingsSection feedbacks={feedbacks} avgRating={avgRating} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Órdenes diagnósticas</h2>
            <ExamsSection orders={diagOrders} />
          </div>
        </>
      )}
    </div>
  )
}
