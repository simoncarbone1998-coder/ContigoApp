import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import type { Role } from '../lib/types'

const roleHome: Record<Role, string> = {
  patient: '/paciente/perfil',
  doctor:  '/doctor/agenda',
  admin:   '/admin/dashboard',
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

  // Wrong role — redirect to their home
  if (profile.role !== role) {
    return <Navigate to={roleHome[profile.role]} replace />
  }

  // Onboarding redirect for patients and doctors
  const obPath = onboardingPath[role]
  if (obPath && !profile.onboarding_completed && pathname !== obPath) {
    // Use sessionStorage so skipping onboarding doesn't cause an infinite redirect loop.
    // On the next fresh session (new login) the redirect fires again until they complete it.
    const seenKey = `ob-seen-${profile.id}`
    if (!sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, '1')
      return <Navigate to={obPath} replace />
    }
  }

  return <Outlet />
}
