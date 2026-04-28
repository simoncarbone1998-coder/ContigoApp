import { useTranslation } from 'react-i18next'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'

  function toggle(l: 'es' | 'en') {
    i18n.changeLanguage(l)
  }

  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 shrink-0">
      <button
        onClick={() => toggle('es')}
        className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
        style={
          lang === 'es'
            ? { background: '#1e3a5f', color: '#fff' }
            : { background: 'transparent', color: '#94a3b8' }
        }
      >
        ES
      </button>
      <button
        onClick={() => toggle('en')}
        className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
        style={
          lang === 'en'
            ? { background: '#1e3a5f', color: '#fff' }
            : { background: 'transparent', color: '#94a3b8' }
        }
      >
        EN
      </button>
    </div>
  )
}
