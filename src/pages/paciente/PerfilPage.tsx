import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { specialtyLabel } from '../../lib/types'
import type { Appointment } from '../../lib/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

function calcAge(birthDate: string): number {
  const today = new Date()
  const bd = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age
}

const TODAY = new Date().toISOString().slice(0, 10)

export default function PatientPerfilPage() {
  const { profile, refreshProfile } = useAuth()

  const [fullName, setFullName]   = useState(profile?.full_name ?? '')
  const [phone, setPhone]         = useState(profile?.phone ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [city, setCity]           = useState(profile?.city ?? '')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)

  const [history, setHistory]   = useState<Appointment[]>([])
  const [loadingH, setLoadingH] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!profile) return
    setLoadingH(true)
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url), slot:slot_id(*)')
      .eq('patient_id', profile.id)
      .eq('completed', true)
      .eq('status', 'confirmed')
      .order('completed_at', { ascending: false })
    // Filter: slot date must be in the past
    const past = ((data ?? []) as Appointment[]).filter(
      (a) => a.slot?.date != null && a.slot.date < TODAY
    )
    setHistory(past)
    setLoadingH(false)
  }, [profile])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSaveMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:  fullName.trim(),
        phone:      phone.trim() || null,
        birth_date: birthDate || null,
        city:       city.trim() || null,
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

  const age = birthDate ? calcAge(birthDate) : null
  const initials = (profile?.full_name ?? profile?.email ?? 'P')[0].toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona tu información personal.</p>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Avatar */}
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
              >
                Cambiar foto
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

          {saveMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${saveMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {saveMsg.text}
            </div>
          )}

          <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
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

            <div className="flex items-end">
              <div className="w-full">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Edad</p>
                <p className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
                  {age !== null ? `${age} años` : '—'}
                </p>
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Correo electrónico</p>
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">{profile?.email}</p>
            </div>

            <div className="sm:col-span-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-100">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>

        {/* Appointment history */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">Historia Médica</h2>
          <p className="text-xs text-slate-400 mb-4">Solo citas completadas por el médico.</p>

          {loadingH ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No tienes citas en tu historial.</p>
          ) : (
            <ul className="space-y-2.5">
              {history.map((appt) => (
                <li key={appt.id}>
                  <button
                    onClick={() => setSelected(appt)}
                    className="w-full text-left p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Dr(a). {appt.doctor?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {appt.slot ? `${formatDate(appt.slot.date)} · ${formatTime(appt.slot.start_time)}` : '—'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        {specialtyLabel(appt.doctor?.specialty)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Appointment detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Detalle de cita</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {selected.slot ? `${formatDate(selected.slot.date)} · ${formatTime(selected.slot.start_time)} – ${formatTime(selected.slot.end_time)}` : '—'}
                </p>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <InfoRow label="Médico" value={`Dr(a). ${selected.doctor?.full_name ?? '—'}`} />
              <InfoRow label="Especialización" value={specialtyLabel(selected.doctor?.specialty)} />
              <InfoRow label="Motivo de consulta" value={selected.reason ?? 'No especificado'} />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Conclusión del médico</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 leading-relaxed">
                  {selected.summary ?? 'El médico no escribió una conclusión.'}
                </p>
              </div>
            </div>

            <button onClick={() => setSelected(null)}
              className="mt-6 w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}
