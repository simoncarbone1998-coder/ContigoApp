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
type MedRow  = { medicine_name: string; dose: string; instructions: string }
type ExamRow = { exam_type: string; notes: string }

const emptyMed  = (): MedRow  => ({ medicine_name: '', dose: '', instructions: '' })
const emptyExam = (): ExamRow => ({ exam_type: '', notes: '' })

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

    // 4. Doctor earnings
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
