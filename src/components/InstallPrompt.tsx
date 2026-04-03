import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'contigo-install-dismissed'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<Event | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleInstall() {
    if (!prompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prompt as any).prompt()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prompt as any).userChoice.then(() => {
      setVisible(false)
      setPrompt(null)
    })
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex items-center gap-4">
        <span className="text-2xl shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Instala Contigo en tu celular</p>
          <p className="text-xs text-slate-500 mt-0.5">Accede más rápido, como una app nativa.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors font-medium"
          >
            Ahora no
          </button>
          <button
            onClick={handleInstall}
            className="text-xs px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
