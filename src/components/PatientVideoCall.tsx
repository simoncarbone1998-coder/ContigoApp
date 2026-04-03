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
  patientId: string
  onLeave: () => void
}

export default function PatientVideoCall({ roomUrl, token, appointmentId, patientId, onLeave }: Props) {
  const callRef        = useRef<ReturnType<typeof Daily.createCallObject> | null>(null)
  const localMicRef    = useRef<MediaStream | null>(null)
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef  = useRef<HTMLDivElement>(null)
  const duringFileRef  = useRef<HTMLInputElement>(null)

  const sessionRef = useRef(createTranscriptionSession())

  const [muted,      setMuted]      = useState(false)
  const [camOff,     setCamOff]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')

  // During-call file uploads
  const [duringFiles,    setDuringFiles]    = useState<{ name: string }[]>([])
  const [uploadingDuring, setUploadingDuring] = useState(false)

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

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
          // No mic for Deepgram — video call continues
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

  function toggleMic() { callRef.current?.setLocalAudio(muted); setMuted(!muted) }
  function toggleCam() { callRef.current?.setLocalVideo(camOff); setCamOff(!camOff) }

  function leave() {
    sessionRef.current.stop()
    localMicRef.current?.getTracks().forEach((t) => t.stop())
    callRef.current?.leave()
    onLeave()
  }

  async function handleDuringFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return  // silently skip oversized
    setUploadingDuring(true)
    e.target.value = ''

    const ext  = file.name.split('.').pop()
    const path = `during/${patientId}/${appointmentId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('diagnostic-files')
      .upload(path, file, { upsert: true })

    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('diagnostic-files').getPublicUrl(path)
      await supabase.from('diagnostic_files').insert({
        appointment_id: appointmentId,
        patient_id:     patientId,
        file_url:       publicUrl,
        file_name:      file.name,
        file_size:      `${(file.size / 1024).toFixed(0)} KB`,
        stage:          'during_call',
      })
      setDuringFiles((prev) => [...prev, { name: file.name }])
    }
    setUploadingDuring(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col md:flex-row">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-10 text-center max-w-sm mx-auto">
          {error}
        </div>
      )}

      {/* ── Left: Video ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative p-3 pb-0">
          {/* Remote (doctor) — large */}
          <video ref={remoteVideoRef} autoPlay playsInline
            className="w-full h-full object-cover rounded-2xl bg-slate-800" />
          {/* Local (patient) — corner */}
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-3 right-5 w-32 h-24 object-cover rounded-xl border-2 border-slate-600 bg-slate-700" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5 py-5">
          <button onClick={toggleMic} title={muted ? 'Activar micrófono' : 'Silenciar'}
            className={`w-13 h-13 w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              muted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}>
            <span className="text-base leading-none">🎤</span>
            <span>{muted ? 'Act.' : 'Silenc.'}</span>
          </button>
          <button onClick={toggleCam} title={camOff ? 'Activar cámara' : 'Apagar cámara'}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              camOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}>
            <span className="text-base leading-none">📷</span>
            <span>{camOff ? 'Act.' : 'Cámara'}</span>
          </button>
          <button onClick={leave} title="Terminar llamada"
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-white transition-colors">
            <span className="text-base leading-none">📵</span>
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* ── Right: Transcript + file upload panel ── */}
      <div className="w-full md:w-[300px] bg-white flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 max-h-[40vh] md:max-h-none">
        <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">📝 Transcripción</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            En consulta
          </span>
        </div>

        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto p-4 text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap"
        >
          {transcript || (
            <span className="text-slate-400 not-italic font-sans text-xs">
              La transcripción aparecerá aquí mientras hablan...
            </span>
          )}
        </div>

        {/* File upload section */}
        <div className="px-4 py-3 border-t border-slate-100 shrink-0 space-y-2">
          <button
            onClick={() => duringFileRef.current?.click()}
            disabled={uploadingDuring}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-blue-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
          >
            {uploadingDuring ? (
              <><div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin" /> Subiendo...</>
            ) : (
              <>📎 Subir examen durante consulta</>
            )}
          </button>
          <input
            ref={duringFileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handleDuringFileChange}
          />
          {duringFiles.map((f, i) => (
            <p key={i} className="text-xs text-emerald-700 truncate">✅ {f.name} enviado al doctor</p>
          ))}
        </div>
      </div>
    </div>
  )
}
