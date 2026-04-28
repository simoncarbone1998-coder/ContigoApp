import { useAuth } from '../../contexts/AuthContext'
import { specialtyLabel } from '../../lib/types'
import { useTranslation } from 'react-i18next'

export default function DoctorPendingPage() {
  const { profile, signOut } = useAuth()
  const { t } = useTranslation()

  const isPending  = !profile?.doctor_status || profile.doctor_status === 'pending'
  const isRejected = profile?.doctor_status === 'rejected'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <img src="/logo.png" alt="Contigo" className="w-16 h-16 rounded-2xl mb-8 shadow-md" />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          {isPending ? (
            <>
              <div className="text-5xl mb-2">⏳</div>
              <h1 className="text-xl font-bold text-slate-900">{t('doctor.pending.reviewingTitle')}</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                {t('doctor.pending.reviewingText')}
              </p>
            </>
          ) : isRejected ? (
            <>
              <div className="text-5xl mb-2">❌</div>
              <h1 className="text-xl font-bold text-slate-900">{t('doctor.pending.rejectedTitle')}</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                {t('doctor.pending.rejectedText')}
              </p>
              {profile?.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-left">
                  <p className="font-semibold mb-1">{t('doctor.pending.rejectionReason')}</p>
                  <p>{profile.rejection_reason}</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {(profile?.specialty || profile?.undergraduate_university || profile?.medical_license) && (
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">{t('doctor.pending.submittedInfo')}</p>
            <div className="space-y-3 text-sm">
              {profile.specialty && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t('doctor.pending.specialtyLabel')}</span>
                  <span className="font-semibold text-slate-800 text-right">{specialtyLabel(profile.specialty)}</span>
                </div>
              )}
              {profile.undergraduate_university && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t('doctor.pending.universityLabel')}</span>
                  <span className="font-semibold text-slate-800 text-right">{profile.undergraduate_university}</span>
                </div>
              )}
              {profile.medical_license && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t('doctor.pending.licenseLabel')}</span>
                  <span className="font-semibold text-slate-800 text-right">{profile.medical_license}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-center space-y-4">
          <p className="text-sm text-slate-400">
            {t('common.questions')}{' '}
            <a href="mailto:hola@contigomedicina.com" className="text-blue-600 hover:underline font-medium">
              {t('common.contactEmail')}
            </a>
          </p>
          <button
            onClick={signOut}
            className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t('doctor.pending.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
