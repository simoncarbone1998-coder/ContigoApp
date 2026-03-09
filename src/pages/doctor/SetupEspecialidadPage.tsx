import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SPECIALTIES } from '../../lib/types'
import type { Specialty } from '../../lib/types'

export default function SetupEspecialidadPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Specialty | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !profile) return
    setSubmitting(true)
    setError(null)

    const { error: err } = await supabase
      .from('profiles')
      .update({ specialty: selected })
      .eq('id', profile.id)

    if (err) {
      setError('No se pudo guardar la especialidad. Intenta de nuevo.')
      setSubmitting(false)
      return
    }

    await refreshProfile()
    navigate('/doctor/agenda', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-teal-600 to-green-600 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">

        <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mx-auto mb-6">
          <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Configura tu especialidad</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Selecciona tu especialidad médica. Esto aparecerá en tu perfil y en los horarios que publiques.
        </p>

        {error && (
          <div className="mb-5 flex gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5">
            {SPECIALTIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSelected(s.value)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  selected === s.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center justify-between">
                  {s.label}
                  {selected === s.value && (
                    <svg className="w-4 h-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!selected || submitting}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-100"
          >
            {submitting ? 'Guardando...' : 'Confirmar especialidad'}
          </button>
        </form>
      </div>
    </div>
  )
}
