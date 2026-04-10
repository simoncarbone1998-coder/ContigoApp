import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LabProvider, useLabContext } from '../contexts/LabContext'

function LabRouteGuard() {
  const { lab, loading } = useLabContext()
  const { pathname }     = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!lab) return <Navigate to="/lab/login" replace />

  if (lab.status === 'pending') {
    if (pathname !== '/lab/pending') return <Navigate to="/lab/pending" replace />
    return <Outlet />
  }

  if (lab.status === 'rejected') {
    if (pathname !== '/lab/rejected') return <Navigate to="/lab/rejected" replace />
    return <Outlet />
  }

  return <Outlet />
}

export default function RequireLab() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || profile?.role !== 'laboratory') {
    return <Navigate to="/lab/login" replace />
  }

  return (
    <LabProvider>
      <LabRouteGuard />
    </LabProvider>
  )
}
