import { useAdminCtx } from './AdminContext'
import { AppointmentsTable } from './DashboardPage'

export default function CitasPage() {
  const { appointments, cancelling, handleCancel, loading } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Citas</h1>
        <p className="text-sm text-slate-500 mt-1">{appointments.length} cita{appointments.length !== 1 ? 's' : ''} registrada{appointments.length !== 1 ? 's' : ''}.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
          </div>
        ) : (
          <AppointmentsTable appointments={appointments} cancelling={cancelling} onCancel={handleCancel} />
        )}
      </div>
    </div>
  )
}
