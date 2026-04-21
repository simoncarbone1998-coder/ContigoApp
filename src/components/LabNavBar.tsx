import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLabContext } from '../contexts/LabContext'

const NAV_LINKS = [
  { to: '/lab/dashboard', label: 'Dashboard' },
  { to: '/lab/ordenes',   label: 'Órdenes' },
  { to: '/lab/agenda',    label: 'Agenda' },
  { to: '/lab/historial', label: 'Historial' },
]

export default function LabNavBar() {
  const { lab }  = useLabContext()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link to="/lab/dashboard" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="Contigo" className="h-8 w-auto" />
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Portal Aliados
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          {lab && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-800 truncate max-w-36">{lab.name}</span>
              <span className="text-[10px] text-slate-400 capitalize">{lab.type}</span>
            </div>
          )}
          <NavLink
            to="/lab/perfil"
            className={({ isActive }) =>
              `hidden sm:block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            Perfil
          </NavLink>
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Salir
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-lg px-4 pb-4 pt-3">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/lab/perfil" onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              Perfil
            </NavLink>
            <div className="border-t border-slate-100 mt-2 pt-2">
              <button onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Cerrar sesión
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
