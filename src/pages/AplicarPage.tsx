import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const BG     = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }
const BTN_BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

const inputCls =
  'w-full border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors'

const CONDITIONS = [
  'Diabetes',
  'Hipertensión arterial',
  'Enfermedad cardíaca o coronaria',
  'Cáncer activo o en tratamiento',
  'Enfermedad renal crónica',
  'Enfermedad pulmonar crónica (EPOC, asma severa)',
  'Enfermedad autoinmune (lupus, artritis reumatoide)',
  'VIH/SIDA',
  'Ninguna de las anteriores',
]

function Logo() {
  const [err, setErr] = useState(false)
  if (err) return <span className="text-3xl font-extrabold tracking-tight"><span style={{ color: '#16a34a' }}>con</span><span style={{ color: '#1e3a5f' }}>tigo</span></span>
  return <img src="/logo.png" alt="Contigo" className="h-16 w-auto" onError={() => setErr(true)} />
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
  )
}

function ProgressBar({ step }: { step: number }) {
  const steps = ['Tu información', 'Tu salud', 'Evaluando', 'Confirmación']
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        {steps.map((label, i) => (
          <div key={i} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-colors ${
              i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-medium text-center leading-tight hidden sm:block ${
              i === step ? 'text-blue-700' : i < step ? 'text-green-600' : 'text-slate-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
      <div className="relative h-1.5 bg-slate-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / (steps.length - 1)) * 100}%`, background: 'linear-gradient(90deg, #2563eb, #16a34a)' }}
        />
      </div>
    </div>
  )
}

export default function AplicarPage() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role === 'patient' && profile.application_status === 'approved') navigate('/paciente/perfil', { replace: true })
      else if (profile.role === 'patient') navigate('/paciente/pending-application', { replace: true })
      else if (profile.role === 'doctor') navigate('/doctor/agenda', { replace: true })
      else if (profile.role === 'admin') navigate('/admin/dashboard', { replace: true })
    }
  }, [loading, profile, navigate])

  // ── Step 1: personal info ──
  const [fullName,        setFullName]        = useState('')
  const [email,           setEmail]           = useState('')
  const [phone,           setPhone]           = useState('')
  const [city,            setCity]            = useState('')
  const [address,         setAddress]         = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd,         setShowPwd]         = useState(false)
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false)

  // ── Step 2: health questionnaire ──
  const [dob,                 setDob]                 = useState('')
  const [sex,                 setSex]                 = useState('')
  const [conditions,          setConditions]          = useState<string[]>([])
  const [hospitalized,        setHospitalized]        = useState<boolean | null>(null)
  const [hospitalReason,      setHospitalReason]      = useState('')
  const [activeTreatment,     setActiveTreatment]     = useState<boolean | null>(null)
  const [regularMeds,         setRegularMeds]         = useState<boolean | null>(null)
  const [medsDetail,          setMedsDetail]          = useState('')
  const [smokingStatus,       setSmokingStatus]       = useState('')
  const [hasEps,              setHasEps]              = useState<boolean | null>(null)

  const [step,        setStep]        = useState(0)
  const [error,       setError]       = useState<string | null>(null)
  const [emailError,  setEmailError]  = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [appliedEmail, setAppliedEmail] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={BG}>
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // ── Calculated age ──
  function calcAge(): number | null {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  // ── Email validation ──
  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  // ── Condition toggle ──
  function toggleCondition(cond: string) {
    if (cond === 'Ninguna de las anteriores') {
      setConditions(['Ninguna de las anteriores'])
      return
    }
    setConditions((prev) => {
      const withoutNone = prev.filter((c) => c !== 'Ninguna de las anteriores')
      return withoutNone.includes(cond)
        ? withoutNone.filter((c) => c !== cond)
        : [...withoutNone, cond]
    })
  }

  // ── Step 1 validation ──
  function validateStep1(): boolean {
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo.'); return false }
    if (!email.trim())    { setEmailError('Por favor ingresa un correo electrónico válido'); return false }
    if (!isValidEmail(email)) { setEmailError('Por favor ingresa un correo electrónico válido'); return false }
    if (!phone.trim())    { setError('Por favor ingresa tu teléfono.'); return false }
    if (!city.trim())     { setError('Por favor ingresa tu ciudad.'); return false }
    if (!address.trim())  { setError('Por favor ingresa tu dirección.'); return false }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return false }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return false }
    return true
  }

  // ── Step 2 validation ──
  function validateStep2(): boolean {
    if (!dob)                            { setError('Por favor ingresa tu fecha de nacimiento.'); return false }
    if (!sex)                            { setError('Por favor selecciona tu sexo biológico.'); return false }
    if (conditions.length === 0)         { setError('Por favor indica tus condiciones médicas (o selecciona "Ninguna").'); return false }
    if (hospitalized === null)           { setError('Por favor indica si has sido hospitalizado.'); return false }
    if (activeTreatment === null)        { setError('Por favor indica si estás en tratamiento activo.'); return false }
    if (regularMeds === null)            { setError('Por favor indica si tomas medicamentos regularmente.'); return false }
    if (!smokingStatus)                  { setError('Por favor indica tu estado tabáquico.'); return false }
    if (hasEps === null)                 { setError('Por favor indica si tienes EPS activa.'); return false }
    return true
  }

  // ── Advance to step 2 ──
  function goToStep2() {
    setError(null)
    setEmailError(null)
    if (!validateStep1()) return
    setStep(1)
    window.scrollTo(0, 0)
  }

  // ── Submit (step 2 → step 3 → step 4) ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validateStep2()) return
    setStep(2)
    window.scrollTo(0, 0)
    setSubmitting(true)

    try {
      // 1. Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError || !signUpData.user) {
        const msg = (signUpError?.message ?? '').toLowerCase()
        const code = (signUpError as { code?: string } | null)?.code ?? ''
        if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          code === 'user_already_exists' ||
          code === 'email_address_not_authorized'
        ) {
          setEmailError('ya_registrado')
        } else {
          setError(`Hubo un problema con tu correo: ${signUpError?.message ?? 'Error desconocido'}`)
        }
        setStep(0); setSubmitting(false); window.scrollTo(0, 0); return
      }

      const userId = signUpData.user.id

      // 2–5. Call underwriting edge function — it writes profile fields,
      //       health_questionnaire, and patient_applications via service role,
      //       bypassing RLS (safe regardless of whether signUp returned a session).
      const age = calcAge()
      const { data: aiData, error: fnError } = await supabase.functions.invoke('underwrite-patient', {
        body: {
          patient_id: userId,
          patient_data: {
            full_name:        fullName.trim(),
            phone:            phone.trim() || null,
            city:             city.trim() || null,
            delivery_address: address.trim() || null,
          },
          questionnaire: {
            date_of_birth:          dob || undefined,
            biological_sex:         sex || undefined,
            conditions:             conditions.filter((c) => c !== 'Ninguna de las anteriores'),
            hospitalized_last_12m:  hospitalized ?? false,
            hospitalization_reason: hospitalReason.trim() || undefined,
            active_treatment:       activeTreatment ?? false,
            regular_medications:    regularMeds ?? false,
            medications_detail:     medsDetail.trim() || undefined,
            smoking_status:         smokingStatus || undefined,
            has_eps:                hasEps ?? false,
            age:                    age ?? undefined,
          },
        },
      })

      if (fnError) {
        console.error('underwrite-patient error:', fnError)
        // Non-fatal: the profile + application row may still have been written partially.
        // Continue to sign out and show confirmation so the patient isn't left hanging.
      }

      // 6. Notify admin
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'simoncarbone1998@gmail.com',
            subject: '🏥 Nueva aplicación de paciente — Contigo',
            html: `
              <p>Un nuevo paciente ha enviado una aplicación y está pendiente de revisión.</p>
              <br/>
              <p><strong>Nombre:</strong> ${fullName.trim()}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Ciudad:</strong> ${city.trim()}</p>
              ${aiData?.recommendation ? `<p><strong>Recomendación IA:</strong> ${aiData.recommendation.toUpperCase()}</p>` : ''}
              ${aiData?.ratio != null ? `<p><strong>Ratio costo/ingreso:</strong> ${aiData.ratio.toFixed(2)}x</p>` : ''}
              <br/>
              <p>Revisa en el panel de administración:<br/>
              <a href="https://contigomedicina.com/admin/dashboard">contigomedicina.com/admin/dashboard</a></p>
            `,
          },
        })
      } catch { /* non-critical */ }

      // 7. Sign out immediately
      await supabase.auth.signOut()

      setAppliedEmail(email)
      setStep(3)
    } catch (err) {
      console.error('Application error:', err)
      setError('Ocurrió un error inesperado. Por favor intenta de nuevo.')
      setStep(1)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>
      <Link to="/" className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium hover:underline transition-colors">
        ← Volver al inicio
      </Link>

      <div className="flex flex-col items-center w-full max-w-lg">
        <Link to="/" className="mb-6"><Logo /></Link>

        {/* Step 0: Personal info */}
        {step === 0 && (
          <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-10">
            <ProgressBar step={0} />

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              Completa tu aplicación para unirte a Contigo. Revisaremos tu información en las próximas 48 horas.
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-1">Tu información personal</h1>
            <p className="text-slate-500 text-sm mb-6">Paso 1 de 2</p>

            {error && (
              <div className="mb-5 flex gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <span>{error}</span>
                {error.includes('ya está registrado') && (
                  <Link to="/login" className="font-semibold underline ml-1">Iniciar sesión</Link>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nombre completo</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: María García" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
                  onBlur={() => {
                    if (email && !isValidEmail(email)) setEmailError('Por favor ingresa un correo electrónico válido')
                  }}
                  placeholder="tu@correo.com"
                  className={inputCls + (emailError ? ' !border-red-400 focus:!border-red-400 focus:!ring-red-400/20' : '')}
                />
                {emailError && (
                  <p className="mt-1.5 text-[13px] text-red-600">
                    {emailError === 'ya_registrado' ? (
                      <>
                        Este correo ya está registrado.{' '}
                        <Link to="/login" className="font-semibold underline">Inicia sesión aquí</Link>
                      </>
                    ) : emailError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Teléfono</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="ej: 3001234567" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ciudad</label>
                <input type="text" required value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="ej: Bogotá" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dirección</label>
                <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="ej: Calle 123 #45-67, Apto 201" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className={inputCls + ' pr-11'} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <EyeIcon open={showPwd} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">Mínimo 6 caracteres</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <input type={showConfirmPwd ? 'text' : 'password'} required value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                    className={inputCls + ' pr-11'} />
                  <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <EyeIcon open={showConfirmPwd} />
                  </button>
                </div>
              </div>

              <button onClick={goToStep2} disabled={!email.trim()} style={BTN_BG}
                className="w-full mt-2 text-white font-semibold py-3.5 rounded-xl text-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none">
                Continuar →
              </button>
            </div>

            <p className="mt-6 text-sm text-center text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-semibold text-blue-700 hover:underline">Iniciar sesión</Link>
            </p>
          </div>
        )}

        {/* Step 1: Health questionnaire */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-2xl px-8 py-10">
            <ProgressBar step={1} />

            <h1 className="text-xl font-bold text-slate-900 mb-1">Cuéntanos sobre tu salud</h1>
            <p className="text-slate-500 text-sm mb-6">Esta información es confidencial y nos ayuda a personalizar tu plan de atención</p>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-6">
              {/* DOB */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha de nacimiento</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
                {dob && calcAge() !== null && (
                  <p className="mt-1 text-xs text-slate-500">Tienes {calcAge()} años</p>
                )}
              </div>

              {/* Sex */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sexo biológico</label>
                <div className="flex gap-3 flex-wrap">
                  {[['masculino', 'Masculino'], ['femenino', 'Femenino'], ['otro', 'Prefiero no indicar']].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-colors ${sex === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="sex" value={val} checked={sex === val} onChange={() => setSex(val)} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Tienes alguna de estas condiciones médicas?</label>
                <div className="space-y-2">
                  {CONDITIONS.map((cond) => (
                    <label key={cond} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer text-sm transition-colors ${conditions.includes(cond) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={conditions.includes(cond)} onChange={() => toggleCondition(cond)}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded" />
                      <span className={conditions.includes(cond) ? 'text-blue-800 font-medium' : 'text-slate-700'}>{cond}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Hospitalized */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Has sido hospitalizado en los últimos 12 meses?</label>
                <div className="flex gap-3">
                  {[['true', 'Sí'], ['false', 'No']].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-colors ${String(hospitalized) === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="hospitalized" value={val} checked={String(hospitalized) === val}
                        onChange={() => setHospitalized(val === 'true')} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
                {hospitalized && (
                  <div className="mt-2">
                    <input type="text" value={hospitalReason} onChange={(e) => setHospitalReason(e.target.value)}
                      placeholder="¿Por qué motivo? (opcional)" className={inputCls} />
                  </div>
                )}
              </div>

              {/* Active treatment */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Estás en tratamiento médico activo actualmente?</label>
                <div className="flex gap-3">
                  {[['true', 'Sí'], ['false', 'No']].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-colors ${String(activeTreatment) === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="activeTreatment" value={val} checked={String(activeTreatment) === val}
                        onChange={() => setActiveTreatment(val === 'true')} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Regular meds */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Tomas medicamentos de forma regular?</label>
                <div className="flex gap-3">
                  {[['true', 'Sí'], ['false', 'No']].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-colors ${String(regularMeds) === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="regularMeds" value={val} checked={String(regularMeds) === val}
                        onChange={() => setRegularMeds(val === 'true')} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
                {regularMeds && (
                  <div className="mt-2">
                    <input type="text" value={medsDetail} onChange={(e) => setMedsDetail(e.target.value)}
                      placeholder="¿Cuáles? (opcional)" className={inputCls} />
                  </div>
                )}
              </div>

              {/* Smoking */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Fumas o consumes tabaco?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['no_fumo', 'No fumo'],
                    ['exfumador', 'Exfumador (dejé hace más de 1 año)'],
                    ['ocasional', 'Fumador ocasional'],
                    ['regular', 'Fumador regular'],
                  ].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer text-sm transition-colors ${smokingStatus === val ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="smoking" value={val} checked={smokingStatus === val}
                        onChange={() => setSmokingStatus(val)} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* EPS */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">¿Tienes EPS activa en Colombia?</label>
                <div className="flex gap-3">
                  {[['true', 'Sí'], ['false', 'No']].map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-colors ${String(hasEps) === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="hasEps" value={val} checked={String(hasEps) === val}
                        onChange={() => setHasEps(val === 'true')} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Legal disclaimer */}
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 leading-relaxed">
                Al continuar, autorizas a Contigo a utilizar esta información para evaluar tu elegibilidad. Tus datos son confidenciales y nunca serán compartidos con terceros.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(0); setError(null); window.scrollTo(0, 0) }}
                  className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  ← Atrás
                </button>
                <button type="submit" disabled={submitting} style={BTN_BG}
                  className="flex-1 py-3.5 rounded-xl text-white font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  Enviar aplicación →
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-16 text-center">
            <ProgressBar step={2} />

            <div className="mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={BTN_BG}>
                <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Evaluando tu aplicación...</h2>
              <p className="text-slate-500 text-sm">Esto tomará solo un momento</p>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-full rounded-full animate-pulse" style={{ width: '70%', background: 'linear-gradient(90deg, #2563eb, #16a34a)' }} />
            </div>
            <p className="text-xs text-slate-400">Analizando tu información de salud...</p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="w-full bg-white rounded-2xl shadow-2xl px-8 py-12 text-center">
            <ProgressBar step={3} />

            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">¡Aplicación recibida!</h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Hemos recibido tu aplicación para Contigo. Estamos evaluando tu información y te notificaremos por email en las próximas 48 horas.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-200">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">Te escribiremos a {appliedEmail || email}</span>
              </div>
            </div>

            <Link to="/login"
              className="inline-flex items-center justify-center w-full py-3.5 rounded-xl text-white font-semibold text-sm hover:shadow-lg transition-all"
              style={BTN_BG}>
              Entendido
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
