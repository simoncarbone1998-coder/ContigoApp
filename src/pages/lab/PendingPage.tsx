import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLabContext } from '../../contexts/LabContext'

export default function LabPendingPage() {
  const navigate  = useNavigate()
  const { lab }   = useLabContext()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <img src="/logo.png" alt="Contigo" className="w-14 h-14 rounded-2xl mb-8 shadow-md" />

      <div className="w-full max-w-md space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">⏳</div>
          <h1 className="text-xl font-bold text-slate-900">Tu solicitud está siendo revisada</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Nuestro equipo verificará tus documentos y credenciales.
            Este proceso puede tomar <strong>1–3 días hábiles</strong>.
            Te notificaremos por email cuando tu centro sea aprobado.
          </p>
        </div>

        {lab && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Información enviada</p>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Centro',  value: lab.name },
                { label: 'Tipo',    value: lab.type === 'laboratorio' ? 'Laboratorio clínico' : lab.type === 'imagenes' ? 'Imágenes diagnósticas' : 'Centro de diagnóstico e imágenes' },
                { label: 'Ciudad',  value: lab.city },
                { label: 'Correo',  value: lab.email },
              ].map(({ label, value }) => value && (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center space-y-4">
          <p className="text-sm text-slate-400">
            ¿Tienes preguntas?{' '}
            <a href="mailto:hola@contigomedicina.com" className="text-blue-600 hover:underline font-medium">
              hola@contigomedicina.com
            </a>
          </p>
          <button onClick={handleLogout}
            className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
