import { useAuth } from '../../contexts/AuthContext'

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function RejectedApplicationPage() {
  const { profile, signOut } = useAuth()

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

          <h1 className="text-xl font-bold text-slate-900 mb-3">Tu aplicación no fue aprobada</h1>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            En este momento no podemos ofrecerte el plan actual de Contigo.
          </p>

          {/* We can't easily fetch the reapply_after date here without a separate query,
              so we read it from the application if we stored it on the profile
              For now show a generic message */}
          <ReapplySection profile={profile} />

          <p className="text-xs text-slate-400 mb-6">
            ¿Tienes preguntas?{' '}
            <a href="mailto:hola@contigomedicina.com" className="text-blue-600 hover:underline font-medium">
              hola@contigomedicina.com
            </a>
          </p>

          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

function ReapplySection({ profile }: { profile: { applied_at?: string | null } | null }) {
  if (!profile?.applied_at) return null

  // Estimate reapply_after as applied_at + 6 months (approximate)
  const applied = new Date(profile.applied_at)
  const reapply = new Date(applied)
  reapply.setMonth(reapply.getMonth() + 6)
  const now = new Date()

  if (reapply <= now) return null

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-sm">
      <p className="text-slate-600">
        Podrás volver a aplicar a partir del{' '}
        <strong className="text-slate-800">{formatDate(reapply.toISOString())}</strong>
      </p>
    </div>
  )
}
