import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PendingApplicationPage() {
  const { profile, signOut } = useAuth()
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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-3">{t('patient.pending.title')}</h1>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            {t('patient.pending.text', { email: profile?.email ?? '' })}
          </p>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{t('patient.pending.submittedOn')}</span>
              <span className="font-semibold text-slate-800">
                {profile?.applied_at ? formatDate(profile.applied_at) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{t('patient.pending.estimatedTime')}</span>
              <span className="font-semibold text-slate-800">{t('patient.pending.estimatedTimeValue')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{t('patient.pending.status')}</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {t('patient.pending.inReview')}
              </span>
            </div>
          </div>

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
            {t('patient.pending.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
