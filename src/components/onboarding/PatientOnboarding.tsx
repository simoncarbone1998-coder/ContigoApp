import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import OnboardingWrapper from './OnboardingWrapper'

const CHECK_ANIM = `@keyframes drawCheck{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}`
const FADE_ANIM  = `@keyframes obFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.ob-fade{animation:obFadeIn 0.35s ease both}`

export default function PatientOnboarding() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 2 form (pre-fill from existing profile)
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [city,      setCity]      = useState(profile?.city ?? '')
  const [address,   setAddress]   = useState(profile?.delivery_address ?? '')
  const [phone,     setPhone]     = useState(profile?.phone ?? '')
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Avatar
  const fileRef    = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl]  = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading]  = useState(false)

  const firstName = profile?.full_name?.trim().split(' ')[0] ?? 'amigo'

  /** Skip: mark session so RequireRole won't redirect again, go to dashboard */
  function handleSkip() {
    if (profile) sessionStorage.setItem(`ob-seen-${profile.id}`, '1')
    navigate('/paciente/perfil')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      setAvatarUrl(url)
    }
    setUploading(false)
  }

  async function handleSaveProfile() {
    if (!profile) return
    setSaving(true)
    setFormError(null)
    const { error } = await supabase.from('profiles').update({
      birth_date:       birthDate || null,
      city:             city.trim() || null,
      delivery_address: address.trim() || null,
      phone:            phone.trim() || null,
    }).eq('id', profile.id)
    if (error) { setFormError('No se pudo guardar. Intenta de nuevo.'); setSaving(false); return }
    await refreshProfile()
    setSaving(false)
    setStep(3)
  }

  async function handleComplete(destination: string) {
    if (!profile) return
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id)
    await refreshProfile()
    navigate(destination)
  }

  /* ── Step 1: Welcome ── */
  if (step === 1) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }}
      >
        <style>{FADE_ANIM}</style>
        <div className="flex justify-end p-4">
          <button onClick={handleSkip} className="text-white/70 hover:text-white text-sm font-medium transition-colors">
            Omitir por ahora
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center ob-fade">
          <img src="/logo.png" alt="Contigo" className="w-20 h-20 rounded-2xl mb-6 shadow-lg" />

          <h1 className="text-white text-2xl font-bold mb-2 leading-snug">
            ¡Bienvenido a Contigo, {firstName}! 👋
          </h1>
          <p className="text-white/80 text-base mb-10 max-w-xs">
            En 2 minutos tendrás todo listo para tu primera consulta.
          </p>

          {/* Benefits */}
          <div className="flex gap-8 mb-10">
            {[
              { icon: '🕐', label: 'Citas en 36h' },
              { icon: '💊', label: 'Medicamentos' },
              { icon: '📋', label: 'Historial' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-2">
                <span className="text-3xl">{b.icon}</span>
                <span className="text-white/80 text-xs font-medium">{b.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full max-w-sm py-4 bg-white text-blue-900 font-bold rounded-2xl text-base shadow-lg hover:bg-white/90 transition-colors"
          >
            Comenzar →
          </button>
        </div>
      </div>
    )
  }

  /* ── Step 2: Profile form ── */
  if (step === 2) {
    return (
      <OnboardingWrapper step={1} totalSteps={2} onBack={() => setStep(1)} onSkip={handleSkip}>
        <style>{FADE_ANIM}</style>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6 ob-fade">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cuéntanos un poco más sobre ti</h2>
            <p className="text-sm text-slate-500 mt-1">Esta información nos ayuda a brindarte una mejor experiencia.</p>
          </div>

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer shrink-0" onClick={() => !uploading && fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-blue-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 text-2xl font-bold">{firstName[0]?.toUpperCase()}</span>
                </div>
              )}
              {uploading ? (
                <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                  <span className="text-white text-xs">📷</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Foto de perfil</p>
              <p className="text-xs text-slate-500">Opcional · JPG o PNG</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha de nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ciudad</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej: Bogotá"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dirección de entrega</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Calle 100 # 15-20, Apto 301"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-slate-400 mt-1">La usaremos para enviar tus medicamentos</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 300 123 4567"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{formError}</p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-base"
          >
            {saving ? 'Guardando...' : 'Guardar y continuar →'}
          </button>
        </div>
      </OnboardingWrapper>
    )
  }

  /* ── Step 3: Done ── */
  return (
    <OnboardingWrapper step={2} totalSteps={2} onSkip={() => handleComplete('/paciente/perfil')}>
      <style>{`${CHECK_ANIM}${FADE_ANIM}`}</style>
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center space-y-6 ob-fade">
        {/* Animated checkmark */}
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
          <circle cx="44" cy="44" r="42" fill="#dcfce7" stroke="#16a34a" strokeWidth="3" />
          <path
            d="M28 44l12 12 22-22"
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 60,
              strokeDashoffset: 0,
              animation: 'drawCheck 0.6s 0.2s ease-out both',
            }}
          />
        </svg>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">¡Tu perfil está completo! 🎉</h2>
          <p className="text-slate-500 mt-2">Ya puedes agendar tu primera consulta médica.</p>
        </div>

        <div className="w-full space-y-3 pt-2">
          <button
            onClick={() => handleComplete('/paciente/agendar')}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors text-base shadow-sm"
          >
            Agendar mi primera cita
          </button>
          <button
            onClick={() => handleComplete('/paciente/perfil')}
            className="w-full py-4 border border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-colors"
          >
            Explorar primero
          </button>
        </div>
      </div>
    </OnboardingWrapper>
  )
}
