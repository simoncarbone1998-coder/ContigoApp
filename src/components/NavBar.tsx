import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/types'

const roleLinks: Record<Role, { to: string; label: string }[]> = {
  patient: [
    { to: '/paciente/perfil',     label: 'Mi Perfil' },
    { to: '/paciente/agendar',    label: 'Agendar Cita' },
    { to: '/paciente/calendario', label: 'Calendario' },
    { to: '/paciente/pastillas',  label: 'Pastillas' },
  ],
  doctor: [
    { to: '/doctor/perfil',    label: 'Mi Perfil' },
    { to: '/doctor/agenda',    label: 'Mi Agenda' },
    { to: '/doctor/finanzas',  label: 'Finanzas' },
  ],
  admin: [{ to: '/admin/dashboard', label: 'Panel de Admin' }],
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

export default function NavBar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  if (!profile) return null

  const links = roleLinks[profile.role]
  const initials = getInitials(profile.full_name, profile.email)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link to={links[0].to} className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="Contigo" className="h-10 w-auto" />
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <span className="text-slate-600 text-sm font-medium truncate max-w-32">
              {profile.full_name?.split(' ')[0] ?? profile.email}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
