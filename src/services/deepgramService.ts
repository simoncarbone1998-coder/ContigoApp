import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

const API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY as string

// Each video call creates its own session via createTranscriptionSession()
// Module-level state is NOT used so patient and doctor sessions don't conflict.

type OnUpdate = (text: string) => void

interface Session {
  startLocal: (stream: MediaStream, onUpdate: OnUpdate) => void
  addRemote: (stream: MediaStream, onUpdate: OnUpdate) => void
  stop: () => void
  getTranscript: () => string
}

function getMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function createTranscriptionSession(): Session {
  let fullTranscript = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connections: any[] = []
  const recorders: MediaRecorder[] = []
  let remoteStarted = false

  function startConnection(stream: MediaStream, label: string, onUpdate: OnUpdate) {
    try {
      const dg = createClient(API_KEY)
      const conn = dg.listen.live({
        language: 'es',
        model: 'nova-2',
        punctuate: true,
        interim_results: false, // only final results to keep display clean
        smart_format: true,
      })

      conn.on(LiveTranscriptionEvents.Open, () => {
        const mimeType = getMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            try { conn.send(e.data) } catch { /* closed */ }
          }
        }
        recorder.start(300)
        recorders.push(recorder)
      })

      conn.on(LiveTranscriptionEvents.Transcript, (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (data as any)?.channel?.alternatives?.[0]?.transcript
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isFinal = (data as any)?.is_final
        if (t?.trim() && isFinal) {
          fullTranscript += `${label} ${t}\n`
          onUpdate(fullTranscript)
        }
      })

      conn.on(LiveTranscriptionEvents.Error, () => { /* graceful fallback */ })

      connections.push(conn)
    } catch {
      // Deepgram unavailable — graceful fallback, textarea stays empty
    }
  }

  return {
    startLocal(stream, onUpdate) {
      startConnection(stream, '🩺 Doctor:', onUpdate)
    },

    addRemote(stream, onUpdate) {
      if (remoteStarted) return
      remoteStarted = true
      startConnection(stream, '👤 Paciente:', onUpdate)
    },

    stop() {
      recorders.forEach((r) => { try { r.stop() } catch { /* */ } })
      connections.forEach((c) => { try { c.finish() } catch { /* */ } })
      recorders.length = 0
      connections.length = 0
    },

    getTranscript() {
      return fullTranscript
    },
  }
}
