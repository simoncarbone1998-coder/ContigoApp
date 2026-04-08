import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getLabSession } from '../lib/labAuth'

export default function RequireLab() {
  const session = getLabSession()
  const { pathname } = useLocation()

  if (!session) return <Navigate to="/lab/login" replace />

  if (session.status === 'pending') {
    if (pathname !== '/lab/pending') return <Navigate to="/lab/pending" replace />
    return <Outlet />
  }

  if (session.status === 'rejected') {
    if (pathname !== '/lab/rejected') return <Navigate to="/lab/rejected" replace />
    return <Outlet />
  }

  return <Outlet />
}
