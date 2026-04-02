import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { specialtyLabel } from '../lib/types'
import type { Appointment } from '../lib/types'

const RATING_LABELS: Record<number, string> = {
  1: 'Muy mala', 2: 'Mala', 3: 'Regular', 4: 'Buena', 5: 'Excelente',
}

interface Props {
  appointment: Appointment
  patientId: string
  onClose: () => void
  onSubmitted: () => void
}

export default function FeedbackModal({ appointment, patientId, onClose, onSubmitted }: Props) {
  const [rating,     setRating]     = useState(0)
  const [hovered,    setHovered]    = useState(0)
  const [comment,    setComment]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit() {
    if (rating === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('appointment_feedback').insert({
      appointment_id: appointment.id,
      patient_id:     patientId,
      doctor_id:      appointment.doctor_id,
      rating,
      comment:        comment.trim() || null,
    })
    setSubmitting(false)
    if (err) {
      setError('No se pudo enviar la calificación. Intenta de nuevo.')
    } else {
      onSubmitted()
    }
  }

  const display = hovered || rating

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
      style={{ animation: 'backdrop-in 0.15s ease-out' }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
        style={{ animation: 'modal-in 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">⭐</div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">¿Cómo fue tu consulta?</h2>
          <p className="text-sm text-slate-500">Tu opinión nos ayuda a mejorar</p>
        </div>

        {/* Doctor card */}
        <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-bold text-sm">
              {(appointment.doctor?.full_name ?? 'D')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Dr(a). {appointment.doctor?.full_name ?? '—'}
            </p>
            <p className="text-xs text-slate-500">{specialtyLabel(appointment.doctor?.specialty)}</p>
          </div>
        </div>

        {/* Stars */}
        <div className="text-center mb-5">
          <div className="flex justify-center gap-1.5 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-4xl leading-none transition-transform hover:scale-110 focus:outline-none"
                style={{ color: star <= display ? '#f59e0b' : '#d1d5db' }}
                aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 h-4">
            {rating === 0 ? 'Toca para calificar' : RATING_LABELS[rating]}
          </p>
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="¿Quieres dejarnos algún comentario? (opcional)"
          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
        />
        <p className="text-xs text-slate-400 text-right mt-1 mb-5">{comment.length}/500</p>

        {error && (
          <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-100"
          >
            {submitting ? 'Enviando...' : 'Enviar calificación'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
