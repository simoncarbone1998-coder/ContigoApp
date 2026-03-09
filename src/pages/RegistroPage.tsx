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

const BG     = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }
const BTN_BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

const inputCls =
  'w-full border border-slate-200 rounded-xl py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors'

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

// ── Icons ─────────────────────────────────────────────────────────────────

function PersonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
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

function PhoneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
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

// ── Page ──────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const navigate = useNavigate()
  const { profile, loading, refreshProfile } = useAuth()

  const [fullName, setFullName]                     = useState('')
  const [email, setEmail]                           = useState('')
  const [phone, setPhone]                           = useState('')
  const [city, setCity]                             = useState('')
  const [deliveryAddress, setDeliveryAddress]       = useState('')
  const [password, setPassword]                     = useState('')
  const [confirmPassword, setConfirmPassword]       = useState('')
  const [showPwd, setShowPwd]                       = useState(false)
  const [showConfirmPwd, setShowConfirmPwd]         = useState(false)
  const [submitting, setSubmitting]                 = useState(false)
  const [error, setError]                           = useState<string | null>(null)
  const [emailExists, setEmailExists]               = useState(false)

  useEffect(() => {
    if (!loading && profile) navigate(roleHome[profile.role], { replace: true })
  }, [loading, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailExists(false)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setSubmitting(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError || !signUpData.user) {
      const msg = (signUpError?.message ?? '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setEmailExists(true)
        setError('Este correo ya está registrado.')
      } else if (msg.includes('password')) {
        setError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setError('No se pudo crear la cuenta. Intenta de nuevo.')
      }
      setSubmitting(false)
      return
    }

    if (!signUpData.session) {
      setError('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.')
      setSubmitting(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id:               signUpData.user.id,
        full_name:        fullName.trim(),
        email,
        phone:            phone.trim() || null,
        city:             city.trim() || null,
        delivery_address: deliveryAddress.trim() || null,
        role:             'patient',
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      setError('Cuenta creada, pero hubo un error al guardar el perfil. Intenta iniciar sesión.')
      setSubmitting(false)
      return
    }

    await refreshProfile()
    navigate('/paciente/dashboard', { replace: true })
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

        {/* Card — scrollable on mobile for the long form */}
        <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-10"
          style={{ maxHeight: '85vh', overflowY: 'auto' }}>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
              Crea tu cuenta
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Únete a Contigo y recupera el control de tu salud
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                {error}{' '}
                {emailExists && (
                  <Link to="/login" className="font-semibold underline hover:text-red-800 transition-colors">
                    ¿Quieres iniciar sesión?
                  </Link>
                )}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 1. Nombre completo */}
            <Field id="fullName" label="Nombre completo" icon={<PersonIcon />}>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Pérez"
                className={`${inputCls} pl-10 pr-4`}
              />
            </Field>

            {/* 2. Correo electrónico */}
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

            {/* 3. Teléfono */}
            <Field id="phone" label="Teléfono" icon={<PhoneIcon />}>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ej: 3001234567"
                className={`${inputCls} pl-10 pr-4`}
              />
            </Field>

            {/* 4. Ciudad */}
            <Field id="city" label="Ciudad" icon={<MapPinIcon />}>
              <input
                id="city"
                type="text"
                autoComplete="address-level2"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="ej: Bogotá"
                className={`${inputCls} pl-10 pr-4`}
              />
            </Field>

            {/* 5. Dirección */}
            <Field id="deliveryAddress" label="Dirección" icon={<HomeIcon />}>
              <input
                id="deliveryAddress"
                type="text"
                autoComplete="street-address"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="ej: Calle 123 #45-67, Apto 201"
                className={`${inputCls} pl-10 pr-4`}
              />
            </Field>

            {/* 6. Contraseña */}
            <Field id="password" label="Contraseña" icon={<LockIcon />}>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
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
              <p className="mt-1.5 text-xs text-slate-400">Mínimo 6 caracteres</p>
            </Field>

            {/* 7. Confirmar contraseña */}
            <Field id="confirmPassword" label="Confirmar contraseña" icon={<LockIcon />}>
              <input
                id="confirmPassword"
                type={showConfirmPwd ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-10 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showConfirmPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon open={showConfirmPwd} />
              </button>
            </Field>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 text-white font-semibold py-3.5 rounded-xl text-sm transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              style={BTN_BG}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta'}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-7 text-sm text-center text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors">
              Inicia sesión aquí
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
