import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getLabSession, logoutLab } from '../../lib/labAuth'

export default function LabRejectedPage() {
  const navigate = useNavigate()
  const session  = getLabSession()
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    supabase.rpc('get_lab_by_id', { p_id: session.id }).then(({ data }) => {
      if (data?.rejection_reason) setReason(data.rejection_reason)
    })
  }, [session])

  function handleLogout() {
    logoutLab()
    navigate('/lab/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <img src="/logo.png" alt="Contigo" className="w-14 h-14 rounded-2xl mb-8 shadow-md" />

      <div className="w-full max-w-md space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h1 className="text-xl font-bold text-slate-900">Tu solicitud no fue aprobada</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Lamentablemente no pudimos aprobar tu centro en este momento.
          </p>
          {reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-left">
              <p className="font-semibold mb-1">Motivo:</p>
              <p>{reason}</p>
            </div>
          )}
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-slate-400">
            Para más información escríbenos a{' '}
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
