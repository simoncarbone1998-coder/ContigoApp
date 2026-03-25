import { useEffect, useRef, useState } from 'react'
import Daily from '@daily-co/daily-js'
import { supabase } from '../lib/supabase'

interface Props {
  roomUrl: string
  token: string
  appointmentId: string
  doctorId: string
  onComplete: () => void
  onLeave: () => void
}

type TranscriptLine = { speaker: 'Doctor' | 'Paciente'; text: string }

export default function DoctorVideoCall({ roomUrl, token, appointmentId, doctorId, onComplete, onLeave }: Props) {
  const callRef        = useRef<ReturnType<typeof Daily.createCallObject> | null>(null)
  const initialized    = useRef(false)
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localSessionId = useRef<string | null>(null)

  const [muted,  setMuted]  = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [transcriptText, setTranscriptText] = useState('')
  const [summary,        setSummary]        = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showLeaveWarning, setShowLeaveWarning] = useState(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const existing = Daily.getCallInstance()
    if (existing) existing.destroy()

    const call = Daily.createCallObject()
    callRef.current = call

    call.on('joined-meeting', (ev) => {
      if (ev?.participants?.local) {
        localSessionId.current = ev.participants.local.session_id
      }
    })

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
      }
    })

    // Transcription — graceful fallback if plan doesn't support it
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call.on('transcription-message' as any, (ev: any) => {
        if (!ev?.text) return
        const isLocal = ev.participantId === localSessionId.current
        const line: TranscriptLine = { speaker: isLocal ? 'Doctor' : 'Paciente', text: ev.text }
        setTranscriptText((prev) => `${prev}${line.speaker}: ${line.text}\n`)
      })
    } catch {
      // Transcription unavailable — textarea stays empty for manual notes
    }

    call.join({ url: roomUrl, token }).catch(() => {
      setError('Por favor permite el acceso a tu cámara y micrófono para iniciar la consulta.')
    })

    return () => {
      initialized.current = false
      call.leave().finally(() => { call.destroy() })
      callRef.current = null
    }
  }, [roomUrl, token])

  function toggleMic() {
    callRef.current?.setLocalAudio(muted)
    setMuted(!muted)
  }
  function toggleCam() {
    callRef.current?.setLocalVideo(camOff)
    setCamOff(!camOff)
  }

  function tryLeave() {
    if (!summary.trim()) {
      setShowLeaveWarning(true)
    } else {
      callRef.current?.leave()
      onLeave()
    }
  }

  async function handleSaveAndComplete() {
    if (!summary.trim()) {
      setSaveError('El resumen final es obligatorio antes de guardar.')
      return
    }
    setSaving(true)
    setSaveError(null)

    const { error: apptErr } = await supabase
      .from('appointments')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        summary: summary.trim(),
      })
      .eq('id', appointmentId)

    if (apptErr) {
      setSaveError('No se pudo completar la cita. Intenta de nuevo.')
      setSaving(false)
      return
    }

    await supabase
      .from('doctor_earnings')
      .insert({ doctor_id: doctorId, appointment_id: appointmentId, amount: 10 })

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      callRef.current?.leave()
      onComplete()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col md:flex-row">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* ── Left: Video ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {error && (
          <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 bg-red-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-10 text-center">
            {error}
          </div>
        )}
        {saved && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-10 whitespace-nowrap">
            ✅ Consulta completada y guardada
          </div>
        )}

        {/* Remote video — large */}
        <div className="flex-1 relative p-3 pb-0">
          <video
            ref={remoteVideoRef} autoPlay playsInline
            className="w-full h-full object-cover rounded-2xl bg-slate-800"
          />
          {/* Local — corner */}
          <video
            ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-3 right-5 w-28 h-20 object-cover rounded-xl border-2 border-slate-600 bg-slate-700"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-4 bg-[#0f172a]">
          <button
            onClick={toggleMic}
            title={muted ? 'Activar micrófono' : 'Silenciar'}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              muted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            <span className="text-base leading-none">🎤</span>
            <span>{muted ? 'Act.' : 'Silenc.'}</span>
          </button>

          <button
            onClick={toggleCam}
            title={camOff ? 'Activar cámara' : 'Apagar cámara'}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              camOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            <span className="text-base leading-none">📷</span>
            <span>{camOff ? 'Act.' : 'Cámara'}</span>
          </button>

          <button
            onClick={tryLeave}
            title="Terminar llamada"
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-white transition-colors"
          >
            <span className="text-base leading-none">📵</span>
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* ── Right: Notes panel ── */}
      <div className="w-full md:w-[380px] bg-white flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 max-h-[55vh] md:max-h-none">
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">📝 Notas de consulta</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Live transcription */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Transcripción en vivo
            </p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              rows={8}
              placeholder="Escribe tus notas aquí..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
            />
          </div>

          {/* Final summary */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Resumen final <span className="text-red-500">*</span>
            </p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="Escribe el resumen de la consulta..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
            />
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {saveError}
            </div>
          )}

          <button
            onClick={handleSaveAndComplete}
            disabled={saving || saved || !summary.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Guardando...' : saved ? '✅ Guardado' : 'Guardar y completar ✓'}
          </button>
        </div>
      </div>

      {/* Leave without saving warning */}
      {showLeaveWarning && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">¿Salir sin guardar?</h3>
            <p className="text-sm text-slate-500 mb-5">
              El resumen no ha sido guardado. ¿Seguro que quieres terminar la llamada?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveWarning(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => { callRef.current?.leave(); onLeave() }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
