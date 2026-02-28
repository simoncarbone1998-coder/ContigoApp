import { useState } from 'react'
import type { Appointment } from '../lib/types'

const STATUS_LABELS: Record<Appointment['status'], string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

const STATUS_STYLES: Record<Appointment['status'], string> = {
  pending:   'bg-amber-50  text-amber-700  ring-amber-200',
  confirmed: 'bg-green-50  text-green-700  ring-green-200',
  cancelled: 'bg-red-50    text-red-700    ring-red-200',
  completed: 'bg-gray-50   text-gray-600   ring-gray-200',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'p.\u00a0m.' : 'a.\u00a0m.'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

type Props = {
  appointment: Appointment | null
  loading: boolean
  cancelling: boolean
  onCancel: (id: string) => void
}

export default function ActiveAppointmentCard({ appointment, loading, cancelling, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false)

  function handleCancelClick() {
    setConfirming(true)
  }

  function handleConfirm() {
    if (appointment) onCancel(appointment.id)
    setConfirming(false)
  }

  function handleDismiss() {
    setConfirming(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Cita Actual</h3>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-100 rounded-full w-3/4" />
          <div className="h-4 bg-gray-100 rounded-full w-1/2" />
          <div className="h-4 bg-gray-100 rounded-full w-2/3" />
        </div>

      ) : appointment ? (
        <>
          {/* Details */}
          <div className="space-y-3 text-sm">
            <Row icon={<CalendarIcon />} label="Fecha">
              <span className="capitalize">{formatDate(appointment.appointment_date)}</span>
            </Row>
            <Row icon={<ClockIcon />} label="Hora">
              {formatTime(appointment.appointment_time)}
            </Row>
            <Row icon={<ClipboardIcon />} label="Motivo">
              {appointment.reason_for_visit}
            </Row>
            {appointment.symptoms_description && (
              <Row icon={<TextIcon />} label="Síntomas">
                {appointment.symptoms_description}
              </Row>
            )}
          </div>

          {/* Status badge */}
          <div className="mt-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${STATUS_STYLES[appointment.status]}`}>
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>

          {/* Cancel — two-step confirmation */}
          <div className="mt-5">
            {!confirming ? (
              <button
                onClick={handleCancelClick}
                disabled={cancelling}
                className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Cancelar cita
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700 font-medium mb-3">
                  ¿Seguro que deseas cancelar esta cita?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={cancelling}
                    className="flex-1 py-2 px-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={cancelling}
                    className="flex-1 py-2 px-3 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
                  >
                    No, volver
                  </button>
                </div>
              </div>
            )}
          </div>
        </>

      ) : (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-3">
            <CalendarIcon className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm text-gray-500">No tienes ninguna cita activa en este momento.</p>
        </div>
      )}
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-blue-400 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-gray-900">{children}</p>
      </div>
    </div>
  )
}

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )
}
