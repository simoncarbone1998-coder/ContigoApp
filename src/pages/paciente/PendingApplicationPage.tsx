import { useAuth } from '../../contexts/AuthContext'

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PendingApplicationPage() {
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
          {/* Clock illustration */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-3">Tu aplicación está en revisión</h1>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Estamos evaluando tu solicitud. Te notificaremos a{' '}
            <strong className="text-slate-700">{profile?.email}</strong>{' '}
            cuando tengamos una respuesta.
          </p>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Enviada el</span>
              <span className="font-semibold text-slate-800">
                {profile?.applied_at ? formatDate(profile.applied_at) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Tiempo estimado</span>
              <span className="font-semibold text-slate-800">48 horas hábiles</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Estado</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                En revisión
              </span>
            </div>
          </div>

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
