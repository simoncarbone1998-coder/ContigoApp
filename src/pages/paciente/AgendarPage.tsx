import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import MiniCalendar from '../../components/MiniCalendar'
import { SPECIALTIES, specialtyLabel } from '../../lib/types'
import type { AvailabilitySlot, Specialty } from '../../lib/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) { return t.slice(0, 5) }

export default function PatientAgendarPage() {
  const { profile } = useAuth()

  // Step state
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | ''>('')
  const [slots, setSlots]       = useState<AvailabilitySlot[]>([])
  const [loading, setLoading]   = useState(false)

  // Calendar
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Booking modal
  const [bookingSlot, setBookingSlot] = useState<AvailabilitySlot | null>(null)
  const [reason, setReason]           = useState('')
  const [submitting, setSubmitting]   = useState(false)

  // Feedback
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Active appointments per specialty (to block double-booking)
  const [activeSpecialties, setActiveSpecialties] = useState<Set<string>>(new Set())

  const fetchActiveSpecialties = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('appointments')
      .select('id, slot:slot_id(specialty), doctor:doctor_id(specialty)')
      .eq('patient_id', profile.id)
      .eq('status', 'confirmed')
      .eq('completed', false)
    const set = new Set<string>()
    ;(data ?? []).forEach((a: any) => {
      const spec = a.slot?.specialty ?? a.doctor?.specialty
      if (spec) set.add(spec)
    })
    setActiveSpecialties(set)
  }, [profile])

  const fetchSlots = useCallback(async (specialty: Specialty) => {
    setLoading(true)
    setError(null)
    setSelectedDate(null)
    const { data, error: err } = await supabase
      .from('availability_slots')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url)')
      .eq('is_booked', false)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (err) {
      setError('No se pudieron cargar los horarios.')
      setSlots([])
    } else {
      // Filter by matching specialty and only keep slots at :00 or :30 starts
      const filtered = ((data ?? []) as AvailabilitySlot[]).filter(
        (s) =>
          (s.specialty === specialty || s.doctor?.specialty === specialty) &&
          (s.start_time.slice(3, 5) === '00' || s.start_time.slice(3, 5) === '30')
      )
      setSlots(filtered)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActiveSpecialties() }, [fetchActiveSpecialties])

  async function handleSpecialtyChange(spec: Specialty | '') {
    setSelectedSpecialty(spec)
    setSelectedDate(null)
    setBookingSlot(null)
    setSuccess(null)
    setError(null)
    if (spec) await fetchSlots(spec)
    else setSlots([])
  }

  async function handleBook() {
    if (!bookingSlot || !profile) return
    setSubmitting(true)
    setError(null)

    const { error: err } = await supabase.from('appointments').insert({
      patient_id: profile.id,
      doctor_id:  bookingSlot.doctor_id,
      slot_id:    bookingSlot.id,
      status:     'confirmed',
      reason:     reason.trim() || null,
    })

    if (err) {
      setError('No se pudo reservar la cita. Intenta con otro horario.')
    } else {
      setSuccess(
        `¡Cita confirmada con ${bookingSlot.doctor?.full_name ?? 'el doctor'} el ${formatDate(bookingSlot.date)} · ${formatTime(bookingSlot.start_time)}.`
      )
      setBookingSlot(null)
      setReason('')
      setSelectedDate(null)
      await fetchSlots(selectedSpecialty as Specialty)
      await fetchActiveSpecialties()
    }
    setSubmitting(false)
  }

  // Build dot map: days with available slots
  const dotMap: Record<string, 'available'> = {}
  slots.forEach((s) => { dotMap[s.date] = 'available' })

  const daySlots = selectedDate
    ? slots.filter((s) => s.date === selectedDate).sort((a, b) => a.start_time.localeCompare(b.start_time))
    : []

  const isBlocked = selectedSpecialty !== '' && activeSpecialties.has(selectedSpecialty)

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agendar Cita</h1>
          <p className="text-slate-500 text-sm mt-1">Elige especialidad, fecha y horario disponible.</p>
        </div>

        {/* Feedback banners */}
        {success && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <svg className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">¡Cita reservada!</p>
              <p className="text-emerald-700 mt-0.5">{success}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-5 h-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Step 1 — Specialty */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge n={1} active={true} />
            <h2 className="text-sm font-bold text-slate-900">Selecciona la especialidad</h2>
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => handleSpecialtyChange(e.target.value as Specialty | '')}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors bg-white"
          >
            <option value="">— Elige una especialidad —</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {isBlocked && (
            <div className="mt-3 flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Ya tienes una cita activa en {specialtyLabel(selectedSpecialty as Specialty)}. Cancela la cita actual antes de agendar una nueva.
            </div>
          )}
        </div>

        {/* Step 2 — Calendar (visible after specialty selected) */}
        {selectedSpecialty !== '' && !isBlocked && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <StepBadge n={2} active={true} />
              <h2 className="text-sm font-bold text-slate-900">Elige una fecha disponible</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 font-medium text-sm">No hay horarios disponibles para {specialtyLabel(selectedSpecialty as Specialty)}</p>
                <p className="text-slate-400 text-sm mt-1">Vuelve más tarde para ver nuevos horarios.</p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <MiniCalendar
                  year={calYear} month={calMonth}
                  dots={dotMap}
                  selected={selectedDate ?? undefined}
                  onSelectDate={(d) => {
                    setSelectedDate(d === selectedDate ? null : d)
                    setBookingSlot(null)
                  }}
                  onPrev={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
                    else setCalMonth(m => m - 1)
                  }}
                  onNext={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
                    else setCalMonth(m => m + 1)
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Time slots for selected day */}
        {selectedDate && daySlots.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <StepBadge n={3} active={true} />
              <h2 className="text-sm font-bold text-slate-900">
                Horarios disponibles · {formatDate(selectedDate)}
              </h2>
            </div>

            {/* Doctor info */}
            {daySlots[0]?.doctor && (
              <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-sm">
                    {(daySlots[0].doctor.full_name ?? 'D')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Dr(a). {daySlots[0].doctor.full_name}</p>
                  <p className="text-xs text-slate-500">{specialtyLabel(daySlots[0].doctor.specialty)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {daySlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => { setBookingSlot(slot); setReason(''); setSuccess(null) }}
                  className={`p-3 rounded-xl border text-center transition-colors ${
                    bookingSlot?.id === slot.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <p className="text-sm font-bold">{formatTime(slot.start_time)}</p>
                  <p className={`text-xs mt-0.5 ${bookingSlot?.id === slot.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    – {formatTime(slot.end_time)}
                  </p>
                </button>
              ))}
            </div>

            {bookingSlot && (
              <div className="mt-5 pt-5 border-t border-slate-100"
                style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <StepBadge n={4} active={true} />
                  <h3 className="text-sm font-bold text-slate-900">Motivo de consulta (opcional)</h3>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Describe brevemente el motivo de tu consulta..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                />
                <button
                  onClick={handleBook}
                  disabled={submitting}
                  className="mt-3 w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-100"
                >
                  {submitting ? 'Reservando...' : `Confirmar cita · ${formatTime(bookingSlot.start_time)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {selectedDate && daySlots.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center py-8"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <p className="text-slate-500 text-sm">No hay horarios disponibles para este día.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
      {n}
    </span>
  )
}
