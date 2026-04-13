import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import type { Role } from '../lib/types'

const roleHome: Record<Role, string> = {
  patient:    '/paciente/perfil',
  doctor:     '/doctor/agenda',
  admin:      '/admin/dashboard',
  laboratory: '/lab/dashboard',
}

const onboardingPath: Record<string, string> = {
  patient: '/paciente/onboarding',
  doctor:  '/doctor/onboarding',
}

export default function RequireRole({ role }: { role: Role }) {
  const { session, profile, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <LoadingSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner message="Cargando perfil..." />

  // Wrong role → redirect to their home
  if (profile.role !== role) {
    return <Navigate to={roleHome[profile.role]} replace />
  }

  // Patient application gate
  // null = legacy / pre-underwriting patient → treat as approved
  if (role === 'patient') {
    const appStatus = profile.application_status
    if (appStatus === 'pending') {
      if (pathname !== '/paciente/pending-application') return <Navigate to="/paciente/pending-application" replace />
      return <Outlet />
    }
    if (appStatus === 'rejected') {
      if (pathname !== '/paciente/rejected') return <Navigate to="/paciente/rejected" replace />
      return <Outlet />
    }
  }

  // Doctor approval gate
  // null = legacy / pre-approval-system doctor → treat as approved
  if (role === 'doctor') {
    const status = profile.doctor_status
    if (status === 'pending' || status === 'rejected') {
      if (pathname !== '/doctor/pending') return <Navigate to="/doctor/pending" replace />
      // Already on /doctor/pending — render it, skip onboarding check
      return <Outlet />
    }
  }

  // Onboarding redirect for patients and approved doctors
  const obPath = onboardingPath[role]
  if (obPath && !profile.onboarding_completed && pathname !== obPath) {
    const seenKey = `ob-seen-${profile.id}`
    if (!sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, '1')
      return <Navigate to={obPath} replace />
    }
  }

  return <Outlet />
}
