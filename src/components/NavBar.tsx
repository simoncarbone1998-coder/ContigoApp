import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import LanguageToggle from './LanguageToggle'
import type { Role } from '../lib/types'

type NavItem = { to: string; labelKey: string }

const roleLinks: Record<Role, NavItem[]> = {
  patient: [
    { to: '/paciente/mi-salud',  labelKey: 'nav.myHealth' },
    { to: '/paciente/pastillas', labelKey: 'nav.medications' },
    { to: '/paciente/examenes',  labelKey: 'nav.labTests' },
    { to: '/paciente/perfil',    labelKey: 'nav.profile' },
  ],
  doctor: [
    { to: '/doctor/perfil',    labelKey: 'nav.myProfile' },
    { to: '/doctor/agenda',    labelKey: 'nav.mySchedule' },
    { to: '/doctor/finanzas',  labelKey: 'nav.earnings' },
  ],
  admin:      [{ to: '/admin/dashboard', labelKey: 'nav.adminPanel' }],
  laboratory: [{ to: '/lab/dashboard',   labelKey: 'nav.alliedPortal' }],
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
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  if (!profile) return null

  const links = roleLinks[profile.role]
  const initials = getInitials(profile.full_name, profile.email)
  const profileLink = profile.role === 'patient' ? '/paciente/perfil' : links[0].to

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link to={profile.role === 'patient' ? '/paciente/mi-salud' : links[0].to} className="flex items-center gap-2 shrink-0">
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
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Right: language toggle + user menu */}
        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle />

          {/* User avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-50 transition-colors"
              aria-label={t('nav.userMenu')}
              aria-expanded={dropdownOpen}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? 'Avatar'}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  className="ring-2 ring-slate-200 hover:ring-blue-300 transition-all shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 ring-2 ring-transparent hover:ring-blue-300 transition-all">
                  <span className="text-white text-xs font-bold">{initials}</span>
                </div>
              )}

              <span className="hidden sm:block text-slate-600 text-sm font-medium truncate max-w-28">
                {profile.full_name?.split(' ')[0] ?? profile.email}
              </span>

              <svg
                className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden z-50"
                style={{ animation: 'modal-in 0.15s ease-out' }}
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {profile.full_name ?? profile.email}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{profile.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate(profileLink) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {t('nav.myProfileLink')}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('nav.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
