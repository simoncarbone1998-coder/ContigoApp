import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { specialtyLabel } from '../../lib/types'

export default function DoctorPerfilPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName]                         = useState(profile?.full_name ?? '')
  const [phone, setPhone]                               = useState(profile?.phone ?? '')
  const [birthDate, setBirthDate]                       = useState(profile?.birth_date ?? '')
  const [city, setCity]                                 = useState(profile?.city ?? '')
  const [undergrad, setUndergrad]                       = useState(profile?.undergraduate_university ?? '')
  const [postgrad, setPostgrad]                         = useState(profile?.postgraduate_specialty ?? '')
  const [doctorDescription, setDoctorDescription]       = useState(profile?.doctor_description ?? '')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)

  if (profile && !profile.specialty) {
    navigate('/doctor/setup', { replace: true })
    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSaveMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:               fullName.trim(),
        phone:                   phone.trim() || null,
        birth_date:              birthDate || null,
        city:                    city.trim() || null,
        undergraduate_university: undergrad.trim() || null,
        postgraduate_specialty:   postgrad.trim() || null,
        doctor_description:       doctorDescription.trim() || null,
      })
      .eq('id', profile.id)
    if (error) {
      setSaveMsg({ ok: false, text: 'No se pudo guardar. Intenta de nuevo.' })
    } else {
      await refreshProfile()
      setSaveMsg({ ok: true, text: 'Perfil actualizado.' })
    }
    setSaving(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + `?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      setAvatarUrl(url)
      await refreshProfile()
    }
    setUploading(false)
  }

  const initials = (profile?.full_name ?? profile?.email ?? 'D')[0].toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
          <p className="text-slate-500 text-sm mt-1">Tu información visible para pacientes.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Avatar + specialty */}
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-slate-100">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border border-slate-200" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 text-2xl font-bold">{initials}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-0.5">{profile?.full_name ?? '—'}</p>
              <p className="text-xs text-slate-500 mb-2">{profile?.email}</p>
              <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
                {specialtyLabel(profile?.specialty ?? null)}
              </span>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium">
                  Cambiar foto
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>
          </div>

          {saveMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${saveMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {saveMsg.text}
            </div>
          )}

          <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">

            {/* Personal info */}
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nombre completo</label>
              <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Teléfono</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            <div>
              <label htmlFor="city" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ciudad</label>
              <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Bogotá, Medellín..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            <div>
              <label htmlFor="birthDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha de nacimiento</label>
              <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            {/* Separator */}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Formación académica</p>
            </div>

            <div>
              <label htmlFor="undergrad" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Universidad de pregrado</label>
              <input id="undergrad" type="text" value={undergrad} onChange={(e) => setUndergrad(e.target.value)}
                placeholder="Universidad Nacional de Colombia"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            <div>
              <label htmlFor="postgrad" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Especialización de posgrado</label>
              <input id="postgrad" type="text" value={postgrad} onChange={(e) => setPostgrad(e.target.value)}
                placeholder="No aplica"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="doctorDesc" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción profesional</label>
              <textarea id="doctorDesc" value={doctorDescription} onChange={(e) => setDoctorDescription(e.target.value)}
                rows={4} placeholder="Cuéntale a tus pacientes sobre tu experiencia y enfoque médico..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none" />
            </div>

            {/* Specialty (read-only) */}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Especialidad médica</p>
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
                {specialtyLabel(profile?.specialty ?? null)}
              </p>
              <p className="text-xs text-slate-400 mt-1">La especialidad no se puede cambiar una vez configurada.</p>
            </div>

            <div className="sm:col-span-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-100">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
