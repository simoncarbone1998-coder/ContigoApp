import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { specialtyLabel } from '../../lib/types'
import type { Appointment } from '../../lib/types'
import FeedbackModal from '../../components/FeedbackModal'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function formatBirthDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${parseInt(day)} de ${MONTHS_ES[parseInt(m) - 1]} de ${y}`
}

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

  const [editing, setEditing]     = useState(false)
  const [fullName, setFullName]   = useState(profile?.full_name ?? '')
  const [phone, setPhone]         = useState(profile?.phone ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [city, setCity]           = useState(profile?.city ?? '')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  function enterEdit() {
    setFullName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
    setBirthDate(profile?.birth_date ?? '')
    setCity(profile?.city ?? '')
    setSaveMsg(null)
    setEditing(true)
  }
  function cancelEdit() {
    setFullName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
    setBirthDate(profile?.birth_date ?? '')
    setCity(profile?.city ?? '')
    setSaveMsg(null)
    setEditing(false)
  }

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)

  const [history, setHistory]   = useState<Appointment[]>([])
  const [loadingH, setLoadingH] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)

  type FeedbackRecord = { appointment_id: string; rating: number; comment: string | null }
  const [feedbacks,     setFeedbacks]     = useState<Record<string, FeedbackRecord>>({})
  const [feedbackAppt,  setFeedbackAppt]  = useState<Appointment | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  // Diagnostic data for selected appointment modal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedDiagOrders, setSelectedDiagOrders] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedDiagFiles,  setSelectedDiagFiles]  = useState<any[]>([])

  const fetchHistory = useCallback(async () => {
    if (!profile) return
    setLoadingH(true)
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url), slot:slot_id(*), prescriptions(id, prescription_items(medicine_name, dose, instructions))')
      .eq('patient_id', profile.id)
      .eq('completed', true)
      .eq('status', 'confirmed')
      .order('completed_at', { ascending: false })
    // Filter: slot date must be in the past
    const past = ((data ?? []) as Appointment[]).filter(
      (a) => a.slot?.date != null && a.slot.date < TODAY
    )
    setHistory(past)

    // Fetch feedback for these appointments
    const apptIds = past.map((a) => a.id)
    if (apptIds.length > 0) {
      const { data: fbs } = await supabase
        .from('appointment_feedback')
        .select('appointment_id, rating, comment')
        .in('appointment_id', apptIds)
      const fbMap: Record<string, FeedbackRecord> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fbs ?? []).forEach((f: any) => { fbMap[f.appointment_id] = f as FeedbackRecord })
      setFeedbacks(fbMap)
    }
    setLoadingH(false)
  }, [profile])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Fetch diagnostic data when an appointment is selected in the modal
  useEffect(() => {
    if (!selected) { setSelectedDiagOrders([]); setSelectedDiagFiles([]); return }
    Promise.all([
      supabase.from('diagnostic_orders')
        .select('id, exam_type, status, notes, created_at')
        .eq('appointment_id', selected.id)
        .order('created_at', { ascending: true }),
      supabase.from('diagnostic_files')
        .select('id, file_name, file_url, stage, uploaded_at')
        .eq('appointment_id', selected.id)
        .in('stage', ['pre_appointment', 'during_call'])
        .order('uploaded_at', { ascending: true }),
    ]).then(([ordersRes, filesRes]) => {
      setSelectedDiagOrders(ordersRes.data ?? [])
      setSelectedDiagFiles(filesRes.data ?? [])
    })
  }, [selected])

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
      setEditing(false)
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
            <div className={`mb-4 p-3 rounded-xl text-sm transition-opacity duration-200 ${saveMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {saveMsg.text}
            </div>
          )}

          {/* ── VIEW MODE ── */}
          <div style={{ opacity: editing ? 0 : 1, pointerEvents: editing ? 'none' : 'auto', transition: 'opacity 200ms' } as CSSProperties}>
            {!editing && (
              <>
                <dl className="space-y-4">
                  {(
                    [
                      { label: 'Nombre completo',      value: profile?.full_name },
                      { label: 'Correo electrónico',   value: profile?.email },
                      { label: 'Teléfono',              value: profile?.phone },
                      { label: 'Ciudad',                value: profile?.city },
                      {
                        label: 'Fecha de nacimiento',
                        value: profile?.birth_date
                          ? `${formatBirthDate(profile.birth_date)}${age !== null ? ` · ${age} años` : ''}`
                          : undefined,
                      },
                    ] as { label: string; value: string | null | undefined }[]
                  ).map(({ label, value }) => (
                    <div key={label} className="py-2 border-b border-slate-100 last:border-0">
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</dt>
                      <dd className="text-[15px] text-slate-900">
                        {value ?? <span className="text-slate-400 italic text-sm">No registrado</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex justify-end mt-5">
                  <button
                    type="button"
                    onClick={enterEdit}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    ✏️ Editar perfil
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── EDIT MODE ── */}
          <div style={{ opacity: editing ? 1 : 0, pointerEvents: editing ? 'auto' : 'none', transition: 'opacity 200ms' } as CSSProperties}>
            {editing && (
              <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nombre completo</label>
                  <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Correo electrónico</p>
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">{profile?.email}</p>
                  <p className="text-xs text-slate-400 mt-1">El correo no puede modificarse</p>
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

                <div className="sm:col-span-2 flex gap-3">
                  <button type="submit" disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-100">
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button type="button" onClick={cancelEdit} disabled={saving}
                    className="px-6 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
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
            <div className="flex flex-col items-center py-12 text-center gap-3">
              <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-500 text-sm font-medium">Aún no tienes consultas en tu historia médica</p>
              <p className="text-xs text-slate-400">Aquí aparecerán tus consultas completadas.</p>
            </div>
          ) : (
            <>
            {feedbackToast && (
              <div className="mb-4 flex gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
                style={{ animation: 'modal-in 0.2s ease-out' }}>
                {feedbackToast}
              </div>
            )}
            <ul className="space-y-2.5">
              {history.map((appt) => {
                const fb = feedbacks[appt.id]
                const noAtendida = appt.summary === 'Cita no atendida - cerrada automáticamente'
                return (
                  <li key={appt.id}>
                    <div
                      className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all cursor-pointer group"
                      onClick={() => setSelected(appt)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-slate-900">
                              Dr(a). {appt.doctor?.full_name ?? '—'}
                            </p>
                            {noAtendida ? (
                              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                No atendida
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {specialtyLabel(appt.doctor?.specialty)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {appt.slot ? `${formatDate(appt.slot.date)} · ${formatTime(appt.slot.start_time)}` : '—'}
                          </p>
                          {fb && (
                            <div className="mt-1.5">
                              <StarsDisplay rating={fb.rating} />
                            </div>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {/* Feedback row — only if not rated and not noAtendida */}
                      {!fb && !noAtendida && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); setFeedbackAppt(appt) }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                          >
                            ⭐ Calificar consulta
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            </>
          )}
        </div>
      </main>

      {/* Feedback modal */}
      {feedbackAppt && profile && (
        <FeedbackModal
          appointment={feedbackAppt}
          patientId={profile.id}
          onClose={() => setFeedbackAppt(null)}
          onSubmitted={() => {
            setFeedbackAppt(null)
            setFeedbackToast('¡Gracias por tu calificación! 🌟')
            setTimeout(() => setFeedbackToast(null), 4000)
            fetchHistory()
          }}
        />
      )}

      {/* Appointment detail modal */}
      {selected && (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const medItems: { medicine_name: string; dose: string; instructions: string }[] = (selected as any).prescriptions?.[0]?.prescription_items ?? []
        const noAtendida = selected.summary === 'Cita no atendida - cerrada automáticamente'
        const fb = feedbacks[selected.id]
        const docInitials = (selected.doctor?.full_name ?? 'D')[0].toUpperCase()
        return (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            style={{ animation: 'backdrop-in 0.15s ease-out' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto"
              style={{ animation: 'modal-in 0.2s ease-out', maxHeight: '90vh' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">📋</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Consulta Médica</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selected.slot
                        ? `${formatDate(selected.slot.date)} · ${formatTime(selected.slot.start_time)} – ${formatTime(selected.slot.end_time)}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center shrink-0" aria-label="Cerrar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-7 pb-7 space-y-5">
                {/* Doctor card */}
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  {selected.doctor?.avatar_url ? (
                    <img src={selected.doctor.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 text-sm font-bold">{docInitials}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Dr(a). {selected.doctor?.full_name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{specialtyLabel(selected.doctor?.specialty)}</p>
                  </div>
                  {noAtendida && (
                    <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      No atendida
                    </span>
                  )}
                </div>

                {/* Motivo */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base" aria-hidden="true">📝</span>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Motivo de la consulta</p>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed pl-1">
                    {selected.reason ?? <span className="text-slate-400 italic">No especificado</span>}
                  </p>
                </div>

                <div className="border-t border-slate-100" />

                {/* Resumen médico */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base" aria-hidden="true">🩺</span>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Resumen médico</p>
                  </div>
                  {noAtendida ? (
                    <div className="flex items-start gap-3 p-3.5 bg-orange-50 border border-orange-200 rounded-xl">
                      <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-orange-800">Esta cita no fue atendida</p>
                        <p className="text-xs text-orange-600 mt-0.5">La consulta fue cerrada automáticamente.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 leading-relaxed">
                      {selected.summary ?? <span className="text-slate-400 italic">El médico no escribió una conclusión.</span>}
                    </p>
                  )}
                </div>

                {/* Medications */}
                {medItems.length > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base" aria-hidden="true">💊</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Medicamentos recetados</p>
                      </div>
                      <ul className="space-y-2.5">
                        {medItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="text-blue-400 font-bold mt-0.5 shrink-0">•</span>
                            <div>
                              <span className="font-semibold text-slate-900">{item.medicine_name}</span>
                              <span className="text-slate-500"> — {item.dose}</span>
                              {item.instructions && <p className="text-xs text-slate-400 mt-0.5">{item.instructions}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Diagnostic orders */}
                {selectedDiagOrders.length > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base" aria-hidden="true">🔬</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Exámenes ordenados</p>
                      </div>
                      <ul className="space-y-2">
                        {selectedDiagOrders.map((order: any) => (
                          <li key={order.id} className="flex items-start justify-between gap-3 text-sm">
                            <span className="text-slate-800 font-medium">{order.exam_type}</span>
                            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              order.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : order.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.status === 'completed' ? 'Completado ✓' : order.status === 'scheduled' ? 'Agendado' : 'Pendiente'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Shared diagnostic files */}
                {selectedDiagFiles.length > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base" aria-hidden="true">📎</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Archivos compartidos</p>
                      </div>
                      <ul className="space-y-2">
                        {selectedDiagFiles.map((file: any) => (
                          <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-800 truncate">{file.file_name}</p>
                              <p className="text-xs text-slate-400">
                                {file.stage === 'pre_appointment' ? 'Previo a la cita' : 'Durante la consulta'}
                              </p>
                            </div>
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              Ver →
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Rating */}
                {!noAtendida && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base" aria-hidden="true">⭐</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tu calificación</p>
                      </div>
                      {fb ? (
                        <div className="space-y-1.5">
                          <StarsDisplay rating={fb.rating} />
                          {fb.comment && (
                            <p className="text-xs text-slate-500 italic">"{fb.comment}"</p>
                          )}
                          <p className="text-xs text-slate-400">Calificación enviada ✓</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelected(null); setFeedbackAppt(selected) }}
                          className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          ⭐ Calificar esta consulta
                        </button>
                      )}
                    </div>
                  </>
                )}

                <button onClick={() => setSelected(null)}
                  className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}


function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-base leading-none">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  )
}
