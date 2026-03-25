import { useEffect, useRef, useState } from 'react'
import Daily from '@daily-co/daily-js'

interface Props {
  roomUrl: string
  token: string
  onLeave: () => void
}

export default function PatientVideoCall({ roomUrl, token, onLeave }: Props) {
  const callRef        = useRef<ReturnType<typeof Daily.createCallObject> | null>(null)
  const initialized    = useRef(false)
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const [muted,  setMuted]  = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const existing = Daily.getCallInstance()
    if (existing) existing.destroy()

    const call = Daily.createCallObject()
    callRef.current = call

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

  function leave() {
    callRef.current?.leave()
    onLeave()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-10 max-w-sm text-center">
          {error}
        </div>
      )}

      {/* Videos */}
      <div className="flex-1 relative p-4">
        {/* Remote (doctor) — large */}
        <video
          ref={remoteVideoRef} autoPlay playsInline
          className="w-full h-full object-cover rounded-2xl bg-slate-800"
        />
        {/* Local (patient) — corner */}
        <video
          ref={localVideoRef} autoPlay playsInline muted
          className="absolute bottom-6 right-6 w-36 h-24 object-cover rounded-xl border-2 border-slate-600 bg-slate-700"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 py-6 bg-[#0f172a]">
        <button
          onClick={toggleMic}
          title={muted ? 'Activar micrófono' : 'Silenciar'}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            muted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
          }`}
        >
          <span className="text-lg leading-none">🎤</span>
          <span>{muted ? 'Act.' : 'Silenc.'}</span>
        </button>

        <button
          onClick={toggleCam}
          title={camOff ? 'Activar cámara' : 'Apagar cámara'}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            camOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
          }`}
        >
          <span className="text-lg leading-none">📷</span>
          <span>{camOff ? 'Act.' : 'Cámara'}</span>
        </button>

        <button
          onClick={leave}
          title="Terminar llamada"
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-white transition-colors"
        >
          <span className="text-lg leading-none">📵</span>
          <span>Salir</span>
        </button>
      </div>
    </div>
  )
}
