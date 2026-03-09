import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/types'

const roleHome: Record<Role, string> = {
  patient: '/paciente/perfil',
  doctor:  '/doctor/agenda',
  admin:   '/admin/dashboard',
}

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }
const BTN_BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

// ── Shared small components ────────────────────────────────────────────────

function Logo() {
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <span className="text-3xl font-extrabold tracking-tight">
        <span style={{ color: '#16a34a' }}>con</span>
        <span style={{ color: '#1e3a5f' }}>tigo</span>
      </span>
    )
  }
  return <img src="/logo.png" alt="Contigo" className="h-16 w-auto" onError={() => setErr(true)} />
}

function Field({
  id, label, icon, children,
}: {
  id: string; label: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
    </div>
  )
}

function MailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

const inputCls =
  'w-full border border-slate-200 rounded-xl py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors'

// ── Page ──────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) navigate(roleHome[profile.role], { replace: true })
  }, [loading, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={BG}>
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>

      {/* Back button — fixed top-left */}
      <Link
        to="/"
        className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium hover:underline transition-colors"
      >
        ← Volver al inicio
      </Link>

      {/* Logo + Card */}
      <div className="flex flex-col items-center w-full max-w-md">

        <Link to="/" className="mb-6">
          <Logo />
        </Link>

        <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-10">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
              Bienvenido de nuevo
            </h1>
            <p className="text-slate-500 text-sm mt-1">Inicia sesión en tu cuenta Contigo</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <Field id="email" label="Correo electrónico" icon={<MailIcon />}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className={`${inputCls} pl-10 pr-4`}
              />
            </Field>

            {/* Password */}
            <Field id="password" label="Contraseña" icon={<LockIcon />}>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-10 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon open={showPwd} />
              </button>
            </Field>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-1 text-white font-semibold py-3.5 rounded-xl text-sm transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              style={BTN_BG}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          {/* Separator */}
          <div className="flex items-center gap-3 my-6">
            <hr className="flex-1 border-slate-200" />
            <span className="text-xs text-slate-400 font-medium">o</span>
            <hr className="flex-1 border-slate-200" />
          </div>

          {/* Register link */}
          <p className="text-sm text-center text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors">
              Regístrate aquí
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
