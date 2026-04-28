import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

export default function RejectedApplicationPage() {
  const { signOut } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-3xl font-extrabold">
            <span style={{ color: '#86efac' }}>con</span>
            <span className="text-white">tigo</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-3">{t('patient.rejected.title')}</h1>

          <p className="text-slate-500 text-sm leading-relaxed mb-6 whitespace-pre-line">
            {t('patient.rejected.text')}
          </p>

          <p className="text-xs text-slate-400 mb-6">
            {t('common.questions')}{' '}
            <a href="mailto:hola@contigomedicina.com" className="text-blue-600 hover:underline font-medium">
              {t('common.contactEmail')}
            </a>
          </p>

          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t('patient.rejected.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
