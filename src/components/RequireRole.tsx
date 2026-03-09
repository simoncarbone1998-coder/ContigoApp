import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import type { Role } from '../lib/types'

const roleHome: Record<Role, string> = {
  patient: '/paciente/perfil',
  doctor:  '/doctor/agenda',
  admin:   '/admin/dashboard',
}

interface Props {
  role: Role
}

export default function RequireRole({ role }: Props) {
  const { session, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner message="Cargando perfil..." />

  if (profile.role !== role) {
    return <Navigate to={roleHome[profile.role]} replace />
  }

  return <Outlet />
}
