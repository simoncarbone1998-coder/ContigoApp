import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SPECIALTIES } from '../../lib/types'
import type { Specialty } from '../../lib/types'
import { generateSlots } from '../../lib/slots'
import OnboardingWrapper from './OnboardingWrapper'

const CHECK_ANIM = `@keyframes drawCheck{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}`
const FADE_ANIM  = `@keyframes obFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.ob-fade{animation:obFadeIn 0.35s ease both}`

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function DoctorOnboarding() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 2: Professional info
  const fileRef    = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl]  = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading]  = useState(false)
  const [specialty, setSpecialty]  = useState<Specialty | ''>(profile?.specialty ?? '')
  const [university, setUniversity] = useState(profile?.undergraduate_university ?? '')
  const [postgrad,   setPostgrad]   = useState(profile?.postgraduate_specialty ?? '')
  const [bio,        setBio]        = useState(profile?.doctor_description ?? '')
  const [saving2,    setSaving2]    = useState(false)
  const [formError2, setFormError2] = useState<string | null>(null)

  // Step 3: Availability
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startTime,    setStartTime]    = useState('')
  const [endTime,      setEndTime]      = useState('')
  const [recurWeeks,   setRecurWeeks]   = useState(2)
  const [saving3,      setSaving3]      = useState(false)
  const [formError3,   setFormError3]   = useState<string | null>(null)
  const [slotsCreated, setSlotsCreated] = useState<number | null>(null)

  const firstName = profile?.full_name?.trim().split(' ')[0] ?? ''

  function handleSkip() {
    if (profile) sessionStorage.setItem(`ob-seen-${profile.id}`, '1')
    navigate('/doctor/agenda')
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

  async function handleSaveProfessional() {
    if (!profile) return
    if (!specialty) { setFormError2('La especialidad es obligatoria.'); return }
    setSaving2(true)
    setFormError2(null)
    const { error } = await supabase.from('profiles').update({
      specialty:               specialty as Specialty,
      undergraduate_university: university.trim() || null,
      postgraduate_specialty:   postgrad.trim() || null,
      doctor_description:       bio.trim() || null,
    }).eq('id', profile.id)
    if (error) { setFormError2('No se pudo guardar. Intenta de nuevo.'); setSaving2(false); return }
    await refreshProfile()
    setSaving2(false)
    setStep(3)
  }

  function buildPreviewSlots() {
    if (selectedDays.length === 0 || !startTime || !endTime || endTime <= startTime) return []
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const endDate = new Date(base); endDate.setDate(endDate.getDate() + recurWeeks * 7)
    const nowMs = Date.now()
    const result: Array<{ date: string; start_time: string; end_time: string }> = []
    const cur = new Date(base)
    while (cur < endDate) {
      const jsDay = cur.getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      if (selectedDays.includes(idx)) {
        const dateStr = cur.toISOString().split('T')[0]
        for (const slot of generateSlots(dateStr, startTime, endTime)) {
          if (new Date(`${dateStr}T${slot.start_time}`).getTime() > nowMs) {
            result.push(slot)
          }
        }
      }
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  async function handleCreateSlots() {
    if (!profile) return
    setFormError3(null)
    const slots = buildPreviewSlots()
    if (slots.length === 0) { setFormError3('No se generarán horarios con esos parámetros.'); return }
    setSaving3(true)
    const rows = slots.map((s) => ({
      doctor_id:  profile.id,
      specialty:  profile.specialty,
      date:       s.date,
      start_time: s.start_time,
      end_time:   s.end_time,
      is_booked:  false,
    }))
    const { error } = await supabase.from('availability_slots').insert(rows)
    setSaving3(false)
    if (error) { setFormError3('No se pudieron crear los horarios. Intenta de nuevo.'); return }
    setSlotsCreated(slots.length)
  }

  async function handleComplete() {
    if (!profile) return
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id)
    await refreshProfile()
    navigate('/doctor/agenda')
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
            ¡Bienvenido Dr(a). {firstName}! 👋
          </h1>
          <p className="text-white/80 text-base mb-10 max-w-xs">
            Configura tu perfil en minutos y empieza a recibir pacientes.
          </p>
          <div className="flex gap-8 mb-10">
            {[
              { icon: '📅', label: 'Agenda flexible' },
              { icon: '💰', label: 'Pago garantizado' },
              { icon: '⚡', label: 'Sin admin' },
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

  /* ── Step 2: Professional info ── */
  if (step === 2) {
    return (
      <OnboardingWrapper step={1} totalSteps={3} onBack={() => setStep(1)} onSkip={handleSkip}>
        <style>{FADE_ANIM}</style>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6 ob-fade">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Completa tu perfil médico</h2>
            <p className="text-sm text-slate-500 mt-1">Esta información la verán tus pacientes.</p>
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

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Especialidad <span className="text-red-500">*</span>
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value as Specialty)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">Seleccionar especialidad...</option>
                {SPECIALTIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Universidad de pregrado</label>
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="Ej: Universidad Nacional de Colombia"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Especialización de posgrado <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={postgrad}
                onChange={(e) => setPostgrad(e.target.value)}
                placeholder="Ej: Cardiología Intervencionista"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Descripción profesional</label>
                <span className={`text-xs ${bio.length >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {bio.length}/50 mín.
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Describe tu experiencia y enfoque médico..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          </div>

          {formError2 && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{formError2}</p>
          )}

          <button
            onClick={handleSaveProfessional}
            disabled={saving2}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-base"
          >
            {saving2 ? 'Guardando...' : 'Guardar y continuar →'}
          </button>
        </div>
      </OnboardingWrapper>
    )
  }

  /* ── Step 3: Availability ── */
  if (step === 3) {
    const previewCount = buildPreviewSlots().length
    return (
      <OnboardingWrapper step={2} totalSteps={3} onBack={() => setStep(2)} onSkip={handleSkip}>
        <style>{FADE_ANIM}</style>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6 ob-fade">
          <div>
            <h2 className="text-xl font-bold text-slate-900">¿Cuándo quieres atender pacientes?</h2>
            <p className="text-sm text-slate-500 mt-1">Crea tus primeros horarios disponibles.</p>
          </div>

          {slotsCreated !== null ? (
            /* Success state */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <p className="text-emerald-800 font-semibold">✅ {slotsCreated} horarios creados exitosamente</p>
                <p className="text-emerald-600 text-sm mt-1">Los pacientes ya pueden ver tu disponibilidad.</p>
              </div>
              <button
                onClick={() => setStep(4)}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors text-base"
              >
                Continuar →
              </button>
            </div>
          ) : (
            /* Creator form */
            <div className="space-y-5">
              {/* Day selector */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Días de atención</p>
                <div className="flex gap-2">
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setSelectedDays((prev) =>
                          prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                        )
                      }
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        selectedDays.includes(idx)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hora inicio</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hora fin</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Duración</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setRecurWeeks(w)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        recurWeeks === w
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {w} {w === 1 ? 'semana' : 'semanas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {previewCount > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 font-medium text-center">
                  Se crearán <strong>{previewCount}</strong> slots de 30 minutos
                </div>
              )}

              {formError3 && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{formError3}</p>
              )}

              <button
                onClick={handleCreateSlots}
                disabled={saving3 || previewCount === 0}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-base"
              >
                {saving3 ? 'Creando horarios...' : `Crear horarios →`}
              </button>

              <button
                onClick={() => setStep(4)}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Crear horarios después →
              </button>
            </div>
          )}
        </div>
      </OnboardingWrapper>
    )
  }

  /* ── Step 4: Done ── */
  return (
    <OnboardingWrapper step={3} totalSteps={3} onSkip={handleComplete}>
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
          <h2 className="text-2xl font-bold text-slate-900">¡Listo para recibir pacientes! 🎉</h2>
          <p className="text-slate-500 mt-2">Tu perfil está configurado.</p>
        </div>

        {/* Summary */}
        <div className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-2.5 text-sm text-left">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <span>✓</span><span>Perfil completado</span>
          </div>
          {specialty && (
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <span>✓</span>
              <span>Especialidad: {SPECIALTIES.find((s) => s.value === specialty)?.label ?? specialty}</span>
            </div>
          )}
          <div className="flex items-center gap-2 font-medium">
            {slotsCreated != null && slotsCreated > 0 ? (
              <><span className="text-emerald-700">✓</span><span className="text-emerald-700">{slotsCreated} horarios disponibles creados</span></>
            ) : (
              <><span className="text-amber-600">⏳</span><span className="text-amber-700">Horarios pendientes</span></>
            )}
          </div>
        </div>

        <button
          onClick={handleComplete}
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors text-base shadow-sm"
        >
          Ir a mi agenda →
        </button>
      </div>
    </OnboardingWrapper>
  )
}
