import { useEffect, useRef, useState } from 'react'
import Daily from '@daily-co/daily-js'
import { supabase } from '../lib/supabase'
import { createTranscriptionSession } from '../services/deepgramService'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dailyCallInstance: any = null

interface Props {
  roomUrl: string
  token: string
  appointmentId: string
  doctorId: string
  patientId: string
  onComplete: () => void
  onLeave: () => void
}

type Phase = 'calling' | 'processing' | 'review' | 'done'
type MedRow      = { medicine_name: string; dose: string; instructions: string }
type ExamRow     = { exam_type: string; notes: string }
type ReferralRow = { specialty: string; reason: string; urgency: 'rutinaria' | 'prioritaria' }

const emptyMed      = (): MedRow      => ({ medicine_name: '', dose: '', instructions: '' })
const emptyExam     = (): ExamRow     => ({ exam_type: '', notes: '' })
const emptyReferral = (): ReferralRow => ({ specialty: '', reason: '', urgency: 'rutinaria' })

const SPECIALIST_SPECIALTIES = [
  { value: 'pediatria',    label: 'Pediatría' },
  { value: 'ginecologia',  label: 'Ginecología' },
  { value: 'cardiologia',  label: 'Cardiología' },
  { value: 'dermatologia', label: 'Dermatología' },
  { value: 'psicologia',   label: 'Psicología' },
  { value: 'ortopedia',    label: 'Ortopedia' },
]

export default function DoctorVideoCall({
  roomUrl, token, appointmentId, doctorId, patientId, onComplete, onLeave,
}: Props) {
  // Daily.co
  const callRef       = useRef<ReturnType<typeof Daily.createCallObject> | null>(null)
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localMicRef    = useRef<MediaStream | null>(null)

  // Deepgram session
  const sessionRef = useRef(createTranscriptionSession())

  // Call state
  const [phase,  setPhase]  = useState<Phase>('calling')
  const [muted,  setMuted]  = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Transcript
  const [transcript, setTranscript] = useState('')
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Realtime: patient files shared during call
  const [sharedFiles, setSharedFiles] = useState<{ name: string; url: string }[]>([])

  // Review form
  const [summary,   setSummary]   = useState('')
  const [meds,      setMeds]      = useState<MedRow[]>([emptyMed()])
  const [noMeds,    setNoMeds]    = useState(false)
  const [exams,     setExams]     = useState<ExamRow[]>([emptyExam()])
  const [noExams,   setNoExams]   = useState(false)
  const [aiError,   setAiError]   = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  // Referrals
  const [referrals, setReferrals] = useState<ReferralRow[]>([])
  // Follow-up
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false)
  const [followUpMonths, setFollowUpMonths] = useState<number | null>(null)
  const [followUpNote, setFollowUpNote] = useState('')

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  // Realtime subscription for patient files during the call
  useEffect(() => {
    const channel = supabase
      .channel(`diag-files-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diagnostic_files',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new
          if (row.stage === 'during_call') {
            setSharedFiles((prev) => [...prev, { name: row.file_name, url: row.file_url }])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [appointmentId])

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        // Destroy any existing instance before creating a new one
        if (dailyCallInstance) {
          try { await dailyCallInstance.leave() } catch { /* ignore */ }
          try { dailyCallInstance.destroy() } catch { /* ignore */ }
          dailyCallInstance = null
        }

        const call = Daily.createCallObject()
        dailyCallInstance = call
        callRef.current = call
        const session = sessionRef.current

        call.on('participant-updated', (ev) => {
          if (!ev) return
          const p = ev.participant
          const videoTrack = p.tracks.video?.persistentTrack
          const audioTrack = p.tracks.audio?.persistentTrack

          if (p.local) {
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = videoTrack ? new MediaStream([videoTrack]) : null
            }
          } else {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = videoTrack ? new MediaStream([videoTrack]) : null
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = audioTrack ? new MediaStream([audioTrack]) : null
            }
            if (audioTrack) {
              session.addRemote(new MediaStream([audioTrack]), setTranscript)
            }
          }
        })

        await call.join({ url: roomUrl, token })

        try {
          const localMic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          localMicRef.current = localMic
          session.startLocal(localMic, setTranscript)
        } catch {
          // Mic access for Deepgram failed — video call continues
        }
      } catch (err) {
        console.error('Daily.co init error:', err)
        setError('No se pudo iniciar la videollamada. Por favor recarga la página.')
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      sessionRef.current.stop()
      localMicRef.current?.getTracks().forEach((t) => t.stop())
      if (dailyCallInstance) {
        try { dailyCallInstance.leave().finally(() => { dailyCallInstance?.destroy(); dailyCallInstance = null }) } catch { /* ignore */ }
      }
      callRef.current = null
    }
  }, [roomUrl, token])

  async function handleEndCall() {
    if (dailyCallInstance) {
      try { await dailyCallInstance.leave() } catch { /* ignore */ }
      try { dailyCallInstance.destroy() } catch { /* ignore */ }
      dailyCallInstance = null
    }
    callRef.current = null
    const session = sessionRef.current
    session.stop()
    localMicRef.current?.getTracks().forEach((t) => t.stop())
    const fullTranscript = session.getTranscript() || transcript
    setPhase('processing')

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('claude-summary', {
        body: { transcript: fullTranscript },
      })
      if (!fnErr && data && !data.error) {
        setSummary(data.resumen ?? '')
        const aiMeds = data.medicamentos ?? []
        if (aiMeds.length > 0) { setMeds(aiMeds); setNoMeds(false) }
        else { setMeds([emptyMed()]); setNoMeds(true) }
        const aiExams = data.examenes ?? []
        if (aiExams.length > 0) { setExams(aiExams); setNoExams(false) }
        else { setExams([emptyExam()]); setNoExams(true) }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aiRefs = data.referencias ?? []
        if (aiRefs.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setReferrals(aiRefs.map((r: any) => ({
            specialty: r.specialty ?? '',
            reason:    r.reason    ?? '',
            urgency:   r.urgency   ?? 'rutinaria',
          })))
        }
        const aiControl = data.control
        if (aiControl?.recommended && aiControl?.months) {
          setScheduleFollowUp(true)
          setFollowUpMonths(aiControl.months)
          setFollowUpNote(aiControl.note ?? '')
        }
      } else {
        setAiError('No se pudo generar el resumen automático. Por favor completa los campos manualmente.')
      }
    } catch {
      setAiError('No se pudo generar el resumen automático. Por favor completa los campos manualmente.')
    }
    setPhase('review')
  }

  async function handleSaveAndComplete() {
    if (!summary.trim()) { setSaveError('El resumen de la consulta es obligatorio.'); return }
    if (!noMeds && meds.some((m) => !m.medicine_name.trim() || !m.dose.trim() || !m.instructions.trim())) {
      setSaveError('Completa todos los campos de los medicamentos o marca "No recetar".'); return
    }
    if (!noExams && exams.some((e) => !e.exam_type.trim())) {
      setSaveError('Completa el tipo de examen o marca "No ordenar exámenes".'); return
    }

    setSaving(true)
    setSaveError(null)

    // 1. Mark appointment completed
    const { error: apptErr } = await supabase
      .from('appointments')
      .update({ completed: true, completed_at: new Date().toISOString(), summary: summary.trim() })
      .eq('id', appointmentId)
    if (apptErr) { setSaveError('No se pudo completar la cita.'); setSaving(false); return }

    // 2. Prescription + items
    if (!noMeds && meds.length > 0) {
      const { data: prescData, error: prescErr } = await supabase
        .from('prescriptions')
        .insert({ appointment_id: appointmentId, patient_id: patientId, doctor_id: doctorId, status: 'pendiente' })
        .select('id').single()
      if (!prescErr && prescData) {
        await supabase.from('prescription_items').insert(
          meds.map((m) => ({
            prescription_id: prescData.id,
            medicine_name:   m.medicine_name.trim(),
            dose:            m.dose.trim(),
            instructions:    m.instructions.trim(),
          }))
        )
      }
    }

    // 3. Diagnostic orders
    if (!noExams && exams.length > 0) {
      const validExams = exams.filter((e) => e.exam_type.trim())
      if (validExams.length > 0) {
        await supabase.from('diagnostic_orders').insert(
          validExams.map((e) => ({
            appointment_id: appointmentId,
            patient_id:     patientId,
            doctor_id:      doctorId,
            exam_type:      e.exam_type.trim(),
            notes:          e.notes.trim() || null,
            status:         'pending',
          }))
        )
      }
    }

    // 4. Specialist referrals
    const validReferrals = referrals.filter((r) => r.specialty && r.reason.trim())
    if (validReferrals.length > 0) {
      await supabase.from('specialist_referrals').insert(
        validReferrals.map((r) => ({
          appointment_id:      appointmentId,
          patient_id:          patientId,
          referring_doctor_id: doctorId,
          specialty:           r.specialty,
          reason:              r.reason.trim(),
          urgency:             r.urgency,
          created_by_role:     'general',
        }))
      )
      // Fetch patient and doctor info to send notification email
      const { data: patientData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', patientId)
        .single()
      const { data: doctorData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', doctorId)
        .single()
      if (patientData?.email) {
        const referralList = validReferrals.map((r) => {
          const label = SPECIALIST_SPECIALTIES.find((s) => s.value === r.specialty)?.label ?? r.specialty
          const urgLabel = r.urgency === 'prioritaria' ? 'Prioritaria' : 'Rutinaria'
          return `<li style="margin:8px 0;"><strong>${label}</strong> — ${urgLabel}<br/><span style="color:#64748b;font-size:13px;">Motivo: ${r.reason}</span></li>`
        }).join('')
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: patientData.email,
              subject: '📋 Tienes nuevas referencias médicas — Contigo',
              html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:28px 32px;"><p style="margin:0;color:#fff;font-size:24px;font-weight:700;">contigo</p><p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Plataforma de Salud · Colombia</p></td></tr><tr><td style="background:#fff;padding:32px;"><p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📋 Nuevas referencias médicas</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${patientData.full_name ?? 'Paciente'},</p><p style="margin:0 0 12px;color:#334155;font-size:15px;">Tu médico Dr(a). ${doctorData?.full_name ?? 'Doctor'} te ha referido a:</p><ul style="margin:0 0 20px;padding-left:20px;color:#334155;font-size:14px;line-height:1.6;">${referralList}</ul><p style="margin:0 0 8px;color:#334155;font-size:14px;">Ya puedes agendar tu cita con el especialista en:</p><p style="margin:0 0 24px;"><a href="https://contigomedicina.com/paciente/referencias" style="color:#1e3a5f;font-weight:600;font-size:14px;">contigomedicina.com/paciente/referencias</a></p><p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p></td></tr><tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 Contigo · <a href="https://contigomedicina.com" style="color:#94a3b8;text-decoration:none;">contigomedicina.com</a></p></td></tr></table></td></tr></table></body></html>`,
            },
          })
        } catch { /* non-critical */ }
      }
    }

    // 5. Follow-up reminder
    if (scheduleFollowUp && followUpMonths) {
      const reminderDate = new Date()
      reminderDate.setMonth(reminderDate.getMonth() + followUpMonths)
      const reminderDateStr = reminderDate.toISOString().slice(0, 10)
      const { data: drData } = await supabase
        .from('profiles')
        .select('specialty')
        .eq('id', doctorId)
        .single()
      await supabase.from('follow_up_reminders').insert({
        appointment_id: appointmentId,
        patient_id:     patientId,
        doctor_id:      doctorId,
        specialty:      drData?.specialty ?? 'medicina_general',
        reminder_date:  reminderDateStr,
        months_until:   followUpMonths,
        note:           followUpNote.trim() || null,
        status:         'pending',
      })
    }

    // 6. Doctor earnings
    await supabase.from('doctor_earnings').insert({ doctor_id: doctorId, appointment_id: appointmentId, amount: 10 })

    setSaving(false)
    setPhase('done')
    setTimeout(onComplete, 1500)
  }

  function toggleMic() { callRef.current?.setLocalAudio(muted); setMuted(!muted) }
  function toggleCam() { callRef.current?.setLocalVideo(camOff); setCamOff(!camOff) }

  // ── Processing spinner ──
  if (phase === 'processing') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-700 font-semibold text-base">✨ Generando resumen con IA...</p>
        <p className="text-slate-400 text-sm">Analizando la transcripción de la consulta</p>
      </div>
    )
  }

  // ── Review form ──
  if (phase === 'review' || phase === 'done') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Revisión de consulta</h1>
            <p className="text-sm text-slate-500 mt-1">
              {aiError
                ? 'Completa los campos manualmente para finalizar la cita.'
                : 'Revisa y edita el resumen generado por IA antes de guardar.'}
            </p>
          </div>

          {phase === 'done' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold text-sm">
              ✅ Consulta completada y guardada
            </div>
          )}

          {aiError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              {aiError}
            </div>
          )}

          {/* Transcript (collapsed) */}
          {transcript && (
            <details className="bg-white border border-slate-200 rounded-xl">
              <summary className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer select-none">
                📝 Ver transcripción completa
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans max-h-40 overflow-y-auto">
                  {transcript}
                </pre>
              </div>
            </details>
          )}

          {/* Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              Resumen de la consulta <span className="text-red-500">*</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Describe el motivo de consulta y lo discutido..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
            />
          </div>

          {/* Medications */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Medicamentos recetados</p>
            {!noMeds && (
              <div className="space-y-3">
                {meds.map((med, i) => (
                  <div key={i} className="relative p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {meds.length > 1 && (
                      <button type="button"
                        onClick={() => setMeds((m) => m.filter((_, j) => j !== i))}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold transition-colors"
                        aria-label="Eliminar">×</button>
                    )}
                    <input type="text" value={med.medicine_name}
                      onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, medicine_name: e.target.value } : x))}
                      placeholder="Nombre del medicamento"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 mb-2 bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={med.dose}
                        onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))}
                        placeholder="Dosis (ej: 500mg)"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                      />
                      <input type="text" value={med.instructions}
                        onChange={(e) => setMeds((m) => m.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))}
                        placeholder="ej: 1 pastilla cada 8 horas"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                      />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setMeds((m) => [...m, emptyMed()])}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                  <span className="text-lg leading-none">+</span> Agregar medicamento
                </button>
              </div>
            )}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={noMeds} onChange={(e) => setNoMeds(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
              <span className="text-sm text-slate-600">No recetar medicamentos en esta cita</span>
            </label>
          </div>

          {/* Diagnostic exams */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">🔬 Exámenes diagnósticos</p>
            {!noExams && (
              <div className="space-y-3">
                {exams.map((exam, i) => (
                  <div key={i} className="relative p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    {exams.length > 1 && (
                      <button type="button"
                        onClick={() => setExams((e) => e.filter((_, j) => j !== i))}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold transition-colors"
                        aria-label="Eliminar">×</button>
                    )}
                    <input type="text" value={exam.exam_type}
                      onChange={(e) => setExams((ex) => ex.map((x, j) => j === i ? { ...x, exam_type: e.target.value } : x))}
                      placeholder="Tipo de examen (ej: Hemograma completo, Radiografía de tórax...)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                    />
                    <input type="text" value={exam.notes}
                      onChange={(e) => setExams((ex) => ex.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))}
                      placeholder="Instrucciones adicionales (opcional)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                    />
                  </div>
                ))}
                <button type="button" onClick={() => setExams((e) => [...e, emptyExam()])}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                  <span className="text-lg leading-none">+</span> Agregar examen
                </button>
              </div>
            )}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={noExams} onChange={(e) => setNoExams(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
              <span className="text-sm text-slate-600">No ordenar exámenes en esta cita</span>
            </label>
          </div>

          {/* Referrals section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">📋 Referir a especialista</p>
            {referrals.length > 0 && (
              <div className="space-y-3">
                {referrals.map((ref, i) => (
                  <div key={i} className="relative p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <button type="button"
                      onClick={() => setReferrals((r) => r.filter((_, j) => j !== i))}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold transition-colors"
                      aria-label="Eliminar">×</button>
                    <select value={ref.specialty}
                      onChange={(e) => setReferrals((r) => r.map((x, j) => j === i ? { ...x, specialty: e.target.value } : x))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white">
                      <option value="">— Especialidad —</option>
                      {SPECIALIST_SPECIALTIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <input type="text" value={ref.reason}
                      onChange={(e) => setReferrals((r) => r.map((x, j) => j === i ? { ...x, reason: e.target.value } : x))}
                      placeholder="Motivo de la referencia"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                    />
                    <div className="flex items-center gap-4 pt-1">
                      <p className="text-xs font-semibold text-slate-500">Urgencia:</p>
                      {(['rutinaria', 'prioritaria'] as const).map((u) => (
                        <label key={u} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="radio" name={`urgency-${i}`} value={u} checked={ref.urgency === u}
                            onChange={() => setReferrals((r) => r.map((x, j) => j === i ? { ...x, urgency: u } : x))}
                            className="accent-blue-600" />
                          <span className="text-sm text-slate-700 capitalize">{u === 'rutinaria' ? 'Rutinaria' : 'Prioritaria'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button"
              onClick={() => setReferrals((r) => [...r, emptyReferral()])}
              disabled={referrals.length >= 6}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors disabled:opacity-50">
              <span className="text-lg leading-none">+</span> Agregar referencia
            </button>
          </div>

          {/* Follow-up section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">📅 Programar control</p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={scheduleFollowUp}
                onChange={(e) => {
                  setScheduleFollowUp(e.target.checked)
                  if (!e.target.checked) { setFollowUpMonths(null); setFollowUpNote('') }
                }}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
              <span className="text-sm text-slate-700">¿Deseas programar un control para este paciente?</span>
            </label>
            {scheduleFollowUp && (
              <div className="space-y-3 pt-1" style={{ animation: 'modal-in 0.15s ease-out' }}>
                <p className="text-xs font-semibold text-slate-500">Control en:</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 12].map((m) => (
                    <button key={m} type="button"
                      onClick={() => setFollowUpMonths(followUpMonths === m ? null : m)}
                      className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                        followUpMonths === m
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                      }`}>
                      {m === 12 ? '1 año' : `${m} mes${m > 1 ? 'es' : ''}`}
                    </button>
                  ))}
                </div>
                <textarea value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)}
                  rows={2} placeholder="Nota para el paciente (opcional): Ej: Regresar para revisar resultado de exámenes"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none" />
                {followUpMonths && (
                  <p className="text-xs text-slate-500">
                    El paciente recibirá recordatorio el{' '}
                    <strong>{(() => {
                      const d = new Date()
                      d.setMonth(d.getMonth() + followUpMonths)
                      return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                    })()}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{saveError}</div>
          )}

          <div className="flex gap-3 pb-4">
            <button onClick={onLeave} disabled={saving || phase === 'done'}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Salir sin completar
            </button>
            <button onClick={handleSaveAndComplete} disabled={saving || phase === 'done' || !summary.trim()}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
              {saving ? 'Guardando...' : phase === 'done' ? '✅ Guardado' : 'Guardar y completar ✓'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Calling phase ──
  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col md:flex-row">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {error && (
        <div className="absolute top-4 left-4 right-4 md:right-auto md:max-w-sm bg-red-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-10 text-center">
          {error}
        </div>
      )}

      {/* ── Left: Video ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative p-3 pb-0">
          <video ref={remoteVideoRef} autoPlay playsInline
            className="w-full h-full object-cover rounded-2xl bg-slate-800" />
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-3 right-5 w-28 h-20 object-cover rounded-xl border-2 border-slate-600 bg-slate-700" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          <CtrlBtn onClick={toggleMic} active={muted} label={muted ? 'Act.' : 'Silenc.'} icon="🎤" />
          <CtrlBtn onClick={toggleCam} active={camOff} label={camOff ? 'Act.' : 'Cámara'} icon="📷" />
          <button onClick={handleEndCall}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-white transition-colors">
            <span className="text-base leading-none">📵</span>
            <span>Fin</span>
          </button>
        </div>
      </div>

      {/* ── Right: Transcript + shared files panel ── */}
      <div className="w-full md:w-[340px] bg-white flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 max-h-[40vh] md:max-h-none">
        <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">📝 Transcripción en vivo</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Grabando
          </span>
        </div>

        <div ref={transcriptRef}
          className="flex-1 overflow-y-auto p-4 text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
          {transcript || (
            <span className="text-slate-400 not-italic font-sans text-xs">
              La transcripción aparecerá aquí mientras hablan...
            </span>
          )}
        </div>

        {/* Patient shared files notifications */}
        {sharedFiles.length > 0 && (
          <div className="px-4 py-3 border-t border-blue-100 bg-blue-50 shrink-0 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Archivos del paciente</p>
            {sharedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-blue-800">
                <span>📎 {f.name}</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 underline shrink-0">
                  Ver →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CtrlBtn({ onClick, active, label, icon }: { onClick: () => void; active: boolean; label: string; icon: string }) {
  return (
    <button onClick={onClick}
      className={`w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
        active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      }`}>
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
