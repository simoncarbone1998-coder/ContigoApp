import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { SPECIALTIES } from '../lib/types'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../components/LanguageToggle'
import type { Role } from '../lib/types'

const roleHome: Record<Role, string> = {
  patient:    '/paciente/perfil',
  doctor:     '/doctor/pending',
  admin:      '/admin/dashboard',
  laboratory: '/lab/dashboard',
}

const BG     = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }
const BTN_BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

const inputCls =
  'w-full border border-slate-200 rounded-xl py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors'

// ── Shared small components ────────────────────────────────────────────────

function Logo() {
  const [err, setErr] = useState(false)
  if (err) return <span className="text-3xl font-extrabold tracking-tight"><span style={{ color: '#16a34a' }}>con</span><span style={{ color: '#1e3a5f' }}>tigo</span></span>
  return <img src="/logo.png" alt="Contigo" className="h-16 w-auto" onError={() => setErr(true)} />
}

function Field({ id, label, children }: { id: string; label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">{children}</div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PersonIcon()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> }
function MailIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg> }
function PhoneIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg> }
function MapPinIcon()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> }
function HomeIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> }
function LockIcon()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> }
function IdIcon()      { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg> }

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
  )
}

function DocFileField({ label, helper, file, inputRef, optional, onChange }: {
  label: string; helper: string; file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>; optional?: boolean
  onChange: (f: File) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
        {label}{optional && <span className="normal-case font-normal text-slate-400 ml-1">({t('common.optional')})</span>}
      </p>
      <p className="text-xs text-slate-400 mb-1.5">{helper}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          📎 {file ? t('common.changeFile') : t('common.selectFile')}
        </button>
        {file && <span className="text-xs text-emerald-700 font-medium truncate max-w-[160px]">✓ {file.name}</span>}
        <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = '' }} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

type Mode = 'select' | 'patient' | 'doctor'

export default function RegistroPage() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const { profile, loading, refreshProfile } = useAuth()
  const { t } = useTranslation()

  // Derive initial mode from ?role= param
  const roleParam = searchParams.get('role')
  const [mode, setMode] = useState<Mode>(
    roleParam === 'doctor' ? 'doctor' : roleParam === 'patient' ? 'patient' : 'select'
  )

  useEffect(() => {
    if (roleParam === 'laboratory') navigate('/lab/registro', { replace: true })
    if (roleParam === 'patient' || roleParam === null) {
      // Patient registration moved to /aplicar (underwriting flow)
      if (mode === 'patient') navigate('/aplicar', { replace: true })
    }
  }, [roleParam, navigate, mode])

  // Shared fields
  const [fullName,         setFullName]         = useState('')
  const [email,            setEmail]            = useState('')
  const [phone,            setPhone]            = useState('')
  const [password,         setPassword]         = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [showPwd,          setShowPwd]          = useState(false)
  const [showConfirmPwd,   setShowConfirmPwd]   = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [emailExists,      setEmailExists]      = useState(false)

  // Patient-only fields
  const [city,            setCity]            = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Doctor-only fields
  const [specialty,   setSpecialty]   = useState('')
  const [university,  setUniversity]  = useState('')
  const [medLicense,  setMedLicense]  = useState('')

  // Doctor document uploads
  const cedulaRef       = useRef<HTMLInputElement>(null)
  const diplomaRef      = useRef<HTMLInputElement>(null)
  const especializRef   = useRef<HTMLInputElement>(null)
  const [cedulaFile,      setCedulaFile]      = useState<File | null>(null)
  const [diplomaFile,     setDiplomaFile]     = useState<File | null>(null)
  const [especializFile,  setEspecializFile]  = useState<File | null>(null)
  const [hasEspecializ,   setHasEspecializ]   = useState(false)

  useEffect(() => {
    if (!loading && profile) navigate(roleHome[profile.role], { replace: true })
  }, [loading, profile, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={BG}>
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // ── Role selector ────────────────────────────────────────────────────────
  if (mode === 'select') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={BG}>
        <Link to="/" className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium hover:underline transition-colors">
          {t('common.backToHome')}
        </Link>
        <div className="fixed top-4 right-4 z-10">
          <LanguageToggle />
        </div>

        <Link to="/" className="mb-8"><Logo /></Link>

        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{t('auth.registro.title')}</h1>
            <p className="text-white/70 text-sm">{t('auth.registro.subtitle')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Patient card */}
            <button
              onClick={() => navigate('/aplicar')}
              className="group bg-white rounded-2xl p-8 text-left hover:border-blue-400 border-2 border-transparent transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200"
            >
              <div className="text-5xl mb-4">🧑‍⚕️</div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">{t('auth.registro.patientRole')}</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {t('auth.registro.patientDesc')}
              </p>
              <div className="w-full py-3 bg-blue-600 group-hover:bg-blue-700 text-white font-semibold rounded-xl text-sm text-center transition-colors">
                {t('auth.registro.registerAsPatient')}
              </div>
            </button>

            {/* Doctor card */}
            <button
              onClick={() => setMode('doctor')}
              className="group bg-white rounded-2xl p-8 text-left hover:border-emerald-400 border-2 border-transparent transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200"
            >
              <div className="text-5xl mb-4">👨‍⚕️</div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">{t('auth.registro.doctorRole')}</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {t('auth.registro.doctorDesc')}
              </p>
              <div className="w-full py-3 bg-emerald-600 group-hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm text-center transition-colors">
                {t('auth.registro.registerAsDoctor')}
              </div>
            </button>

            {/* Lab card */}
            <button
              onClick={() => navigate('/lab/registro')}
              className="group bg-white rounded-2xl p-8 text-left hover:border-violet-400 border-2 border-transparent transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200"
            >
              <div className="text-5xl mb-4">🔬</div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">{t('auth.registro.labRole')}</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {t('auth.registro.labDesc')}
              </p>
              <div className="w-full py-3 bg-violet-600 group-hover:bg-violet-700 text-white font-semibold rounded-xl text-sm text-center transition-colors">
                {t('auth.registro.registerLab')}
              </div>
            </button>
          </div>

          <p className="text-center mt-6 text-sm text-white/70">
            {t('auth.registro.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-white font-semibold hover:underline">{t('auth.registro.signInArrow')}</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Shared submit validation ─────────────────────────────────────────────
  function validateBase(): boolean {
    if (password !== confirmPassword) { setError(t('auth.registro.passwordsMismatch')); return false }
    if (password.length < 6)          { setError(t('auth.registro.passwordTooShort')); return false }
    return true
  }

  // ── Patient submit ───────────────────────────────────────────────────────
  async function handlePatientSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailExists(false)
    if (!validateBase()) return
    setSubmitting(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !signUpData.user) {
      const msg = (signUpError?.message ?? '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setEmailExists(true); setError(t('auth.registro.emailExists'))
      } else if (msg.includes('password')) {
        setError(t('auth.registro.passwordTooShort'))
      } else {
        setError(t('auth.registro.couldNotCreate'))
      }
      setSubmitting(false); return
    }
    if (!signUpData.session) {
      setError(t('auth.registro.confirmEmail'))
      setSubmitting(false); return
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      { id: signUpData.user.id, full_name: fullName.trim(), email, phone: phone.trim() || null, city: city.trim() || null, delivery_address: deliveryAddress.trim() || null, role: 'patient', onboarding_completed: false },
      { onConflict: 'id' }
    )
    if (profileError) {
      setError(t('auth.registro.profileError'))
      setSubmitting(false); return
    }

    await refreshProfile()
    navigate('/paciente/dashboard', { replace: true })
  }

  // ── Doctor submit ────────────────────────────────────────────────────────
  async function handleDoctorSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailExists(false)
    if (!specialty)         { setError(t('auth.registro.selectSpecialty')); return }
    if (!university.trim()) { setError(t('auth.registro.universityPlaceholder')); return }
    if (!medLicense.trim()) { setError(t('auth.registro.licensePlaceholder')); return }
    if (!cedulaFile)        { setError(t('auth.registro.cedulaHelper')); return }
    if (!diplomaFile)       { setError(t('auth.registro.diplomaHelper')); return }
    if (!validateBase()) return
    setSubmitting(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !signUpData.user) {
      const msg = (signUpError?.message ?? '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setEmailExists(true); setError(t('auth.registro.emailExists'))
      } else if (msg.includes('password')) {
        setError(t('auth.registro.passwordTooShort'))
      } else {
        setError(t('auth.registro.couldNotCreate'))
      }
      setSubmitting(false); return
    }
    if (!signUpData.session) {
      setError(t('auth.registro.confirmEmail'))
      setSubmitting(false); return
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: signUpData.user.id,
        full_name: fullName.trim(),
        email,
        phone: phone.trim() || null,
        specialty,
        undergraduate_university: university.trim(),
        medical_license: medLicense.trim(),
        role: 'doctor',
        doctor_status: 'pending',
        onboarding_completed: false,
      },
      { onConflict: 'id' }
    )
    if (profileError) {
      setError(t('auth.registro.profileError'))
      setSubmitting(false); return
    }

    // Upload documents (non-blocking — registration completes even if uploads fail)
    try {
      const userId = signUpData.user.id
      const uploadDoc = async (file: File | null, docType: string): Promise<string | null> => {
        if (!file) return null
        if (file.size > 10 * 1024 * 1024) return null
        const ext = file.name.split('.').pop()
        const path = `${userId}/${docType}.${ext}`
        const { error: upErr } = await supabase.storage.from('doctor-documents').upload(path, file, { upsert: true })
        return upErr ? null : path
      }
      const [cedulaPath, diplomaPath, especializPath] = await Promise.all([
        uploadDoc(cedulaFile, 'cedula'),
        uploadDoc(diplomaFile, 'diploma_pregrado'),
        uploadDoc(hasEspecializ ? especializFile : null, 'diploma_especializacion'),
      ])
      const docUpdate: Record<string, string> = {}
      if (cedulaPath)      docUpdate.cedula_url                  = cedulaPath
      if (diplomaPath)     docUpdate.diploma_pregrado_url        = diplomaPath
      if (especializPath)  docUpdate.diploma_especializacion_url = especializPath
      if (Object.keys(docUpdate).length > 0) {
        await supabase.from('profiles').update(docUpdate).eq('id', userId)
      }
    } catch { /* non-blocking */ }

    // Notify admin
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: 'simoncarbone1998@gmail.com',
          subject: '🩺 Nuevo médico pendiente de aprobación — Contigo',
          html: `
            <p>Un nuevo médico se ha registrado y está pendiente de aprobación.</p>
            <br/>
            <p><strong>Nombre:</strong> ${fullName.trim()}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Especialidad:</strong> ${specialty}</p>
            <p><strong>Universidad:</strong> ${university.trim()}</p>
            <p><strong>Tarjeta profesional:</strong> ${medLicense.trim()}</p>
            <br/>
            <p>Aprueba o rechaza en el panel de administración:<br/>
            <a href="https://contigomedicina.com/admin/dashboard">contigomedicina.com/admin/dashboard</a></p>
          `,
        },
      })
    } catch { /* non-critical — don't block registration */ }

    await refreshProfile()
    navigate('/doctor/pending', { replace: true })
  }

  // ── Shared form chrome ───────────────────────────────────────────────────
  const isDoctor  = mode === 'doctor'
  const title     = isDoctor ? t('auth.registro.doctorTitle') : t('auth.registro.patientTitle')
  const subtitle  = isDoctor ? t('auth.registro.doctorSubtitle') : t('auth.registro.patientSubtitle')
  const onSubmit  = isDoctor ? handleDoctorSubmit : handlePatientSubmit

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>
      <Link to="/" className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium hover:underline transition-colors">
        {t('common.backToHome')}
      </Link>
      <div className="fixed top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="flex flex-col items-center w-full max-w-md">
        <Link to="/" className="mb-6"><Logo /></Link>

        <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-10" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

          {/* Back to role selector */}
          <button onClick={() => setMode('select')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors">
            {t('auth.registro.changeRole')}
          </button>

          {/* Role pill */}
          <div className="flex justify-center mb-6">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isDoctor ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isDoctor ? t('auth.registro.doctorPill') : t('auth.registro.patientPill')}
            </span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>{title}</h1>
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          </div>

          {error && (
            <div className="mb-6 flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                {error}{' '}
                {emailExists && <Link to="/login" className="font-semibold underline hover:text-red-800 transition-colors">{t('auth.registro.wantSignIn')}</Link>}
              </span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">

            {/* Nombre */}
            <Field id="fullName" label={t('common.fullName')} icon={<PersonIcon />}>
              <input id="fullName" type="text" autoComplete="name" required value={fullName}
                onChange={(e) => setFullName(e.target.value)} placeholder={t('auth.registro.namePlaceholder')}
                className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><PersonIcon /></span>
            </Field>

            {/* Correo */}
            <Field id="email" label={t('common.email')} icon={<MailIcon />}>
              <input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.registro.emailPlaceholder')}
                className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><MailIcon /></span>
            </Field>

            {/* Teléfono */}
            <Field id="phone" label={t('common.phone')} icon={<PhoneIcon />}>
              <input id="phone" type="tel" autoComplete="tel" required value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder={t('auth.registro.phonePlaceholder')}
                className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><PhoneIcon /></span>
            </Field>

            {/* Patient-only fields */}
            {!isDoctor && (
              <>
                <Field id="city" label={t('common.city')} icon={<MapPinIcon />}>
                  <input id="city" type="text" autoComplete="address-level2" required value={city}
                    onChange={(e) => setCity(e.target.value)} placeholder={t('auth.registro.cityPlaceholder')}
                    className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><MapPinIcon /></span>
                </Field>
                <Field id="deliveryAddress" label={t('common.address')} icon={<HomeIcon />}>
                  <input id="deliveryAddress" type="text" autoComplete="street-address" required value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={t('auth.registro.addressPlaceholder')}
                    className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><HomeIcon /></span>
                </Field>
              </>
            )}

            {/* Doctor-only fields */}
            {isDoctor && (
              <>
                <div>
                  <label htmlFor="specialty" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('auth.registro.specialty')}</label>
                  <select id="specialty" required value={specialty} onChange={(e) => setSpecialty(e.target.value)}
                    className={`${inputCls} px-4`}>
                    <option value="">{t('auth.registro.selectSpecialty')}</option>
                    {SPECIALTIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                <Field id="university" label={t('auth.registro.university')} icon={<IdIcon />}>
                  <input id="university" type="text" required value={university}
                    onChange={(e) => setUniversity(e.target.value)} placeholder={t('auth.registro.universityPlaceholder')}
                    className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IdIcon /></span>
                </Field>

                <Field id="medLicense" label={t('auth.registro.professionalCard')} icon={<IdIcon />}>
                  <input id="medLicense" type="text" required value={medLicense}
                    onChange={(e) => setMedLicense(e.target.value)} placeholder={t('auth.registro.licensePlaceholder')}
                    className={`${inputCls} pl-10 pr-4`} style={{ paddingLeft: '2.5rem' }} />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IdIcon /></span>
                  <p className="mt-1 text-xs text-slate-400">{t('auth.registro.licenseHelper')}</p>
                </Field>

                {/* Document uploads */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t('auth.registro.documentsTitle')}</p>
                  <p className="text-xs text-slate-400 mb-4">{t('auth.registro.documentsHelper')}</p>
                  <div className="space-y-4">
                    <DocFileField
                      label={t('auth.registro.cedulaLabel')}
                      helper={t('auth.registro.cedulaHelper')}
                      file={cedulaFile}
                      inputRef={cedulaRef}
                      onChange={setCedulaFile}
                    />
                    <DocFileField
                      label={t('auth.registro.diplomaLabel')}
                      helper={t('auth.registro.diplomaHelper')}
                      file={diplomaFile}
                      inputRef={diplomaRef}
                      onChange={setDiplomaFile}
                    />
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer mb-3">
                        <input type="checkbox" checked={hasEspecializ}
                          onChange={(e) => setHasEspecializ(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-semibold text-slate-600">{t('auth.registro.hasSpecialization')}</span>
                      </label>
                      {hasEspecializ && (
                        <DocFileField
                          label={t('auth.registro.specializationLabel')}
                          helper={t('auth.registro.specializationHelper')}
                          file={especializFile}
                          inputRef={especializRef}
                          optional
                          onChange={setEspecializFile}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Contraseña */}
            <Field id="password" label={t('common.password')} icon={<LockIcon />}>
              <input id="password" type={showPwd ? 'text' : 'password'} autoComplete="new-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className={`${inputCls} pl-10 pr-11`} style={{ paddingLeft: '2.5rem' }} />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><LockIcon /></span>
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Toggle password">
                <EyeIcon open={showPwd} />
              </button>
              <p className="mt-1.5 text-xs text-slate-400">{t('auth.registro.minChars')}</p>
            </Field>

            {/* Confirmar contraseña */}
            <Field id="confirmPassword" label={t('common.confirmPassword')} icon={<LockIcon />}>
              <input id="confirmPassword" type={showConfirmPwd ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                className={`${inputCls} pl-10 pr-11`} style={{ paddingLeft: '2.5rem' }} />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><LockIcon /></span>
              <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Toggle password">
                <EyeIcon open={showConfirmPwd} />
              </button>
            </Field>

            {isDoctor && (
              <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                {t('auth.registro.doctorPendingNote')}
              </p>
            )}

            <button type="submit" disabled={submitting}
              className="w-full mt-2 text-white font-semibold py-3.5 rounded-xl text-sm transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              style={BTN_BG}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isDoctor ? t('auth.registro.sendingRequest') : t('auth.registro.creatingAccount')}
                </span>
              ) : (isDoctor ? t('auth.registro.sendRequest') : t('auth.registro.createAccount'))}
            </button>
          </form>

          <p className="mt-7 text-sm text-center text-slate-500">
            {t('auth.registro.haveAccount')}{' '}
            <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors">{t('auth.registro.signInHere')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
