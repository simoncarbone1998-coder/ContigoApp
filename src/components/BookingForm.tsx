import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30',
]

function formatSlot(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'p.\u00a0m.' : 'a.\u00a0m.'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

type Props = {
  userId: string
  onBooked: () => void
}

export default function BookingForm({ userId, onBooked }: Props) {
  const [date, setDate]         = useState('')
  const [time, setTime]         = useState<string | null>(null)
  const [reason, setReason]     = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time || !reason.trim()) return

    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('appointments').insert({
      user_id:              userId,
      appointment_date:     date,
      appointment_time:     time,
      reason_for_visit:     reason.trim(),
      symptoms_description: symptoms.trim() || null,
    })

    setSubmitting(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Ya tienes una cita activa. Cancélala antes de agendar una nueva.')
      } else {
        setError('Ocurrió un error al agendar la cita. Por favor, intenta de nuevo.')
      }
      return
    }

    setDate('')
    setTime(null)
    setReason('')
    setSymptoms('')
    onBooked()
  }

  const canSubmit = !!date && !!time && !!reason.trim() && !submitting

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-5">Agendar Nueva Cita</h3>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Date */}
        <div>
          <label htmlFor="appt-date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Fecha
          </label>
          <input
            id="appt-date"
            type="date"
            value={date}
            min={todayISO()}
            onChange={e => setDate(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Time slots */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Hora disponible</p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map(slot => (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                  time === slot
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {formatSlot(slot)}
              </button>
            ))}
          </div>
          {!time && (
            <p className="mt-2 text-xs text-gray-400">Selecciona una hora disponible</p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="appt-reason" className="block text-sm font-medium text-gray-700 mb-1.5">
            Motivo de la consulta
          </label>
          <input
            id="appt-reason"
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ej: Consulta general, control de presión arterial…"
            required
            maxLength={200}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Symptoms */}
        <div>
          <label htmlFor="appt-symptoms" className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripción de síntomas{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            id="appt-symptoms"
            value={symptoms}
            onChange={e => setSymptoms(e.target.value)}
            placeholder="Describe brevemente tus síntomas o cualquier información relevante para el médico…"
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Agendando…' : 'Confirmar cita'}
        </button>
      </form>
    </div>
  )
}
