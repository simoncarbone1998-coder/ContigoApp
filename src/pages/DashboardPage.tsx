import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Appointment } from '../lib/types'
import type { User } from '@supabase/supabase-js'
import ActiveAppointmentCard from '../components/ActiveAppointmentCard'
import BookingForm from '../components/BookingForm'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser]                 = useState<User | null>(null)
  const [appointment, setAppointment]   = useState<Appointment | null>(null)
  const [loadingAppt, setLoadingAppt]   = useState(true)
  const [cancelling, setCancelling]     = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
  }, [])

  const fetchActiveAppointment = useCallback(async () => {
    setLoadingAppt(true)
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
    setAppointment((data?.[0] as Appointment) ?? null)
    setLoadingAppt(false)
  }, [])

  useEffect(() => {
    fetchActiveAppointment()
  }, [fetchActiveAppointment])

  async function handleCancel(id: string) {
    setCancelling(true)
    await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
    setCancelling(false)
    fetchActiveAppointment()
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.user_name as string | undefined) ??
    user?.email

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div className="min-h-screen bg-blue-50">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">ContigoApp</span>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5 pb-16">

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName ?? 'Foto de perfil'}
                className="w-14 h-14 rounded-full ring-2 ring-blue-100"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-600 font-bold text-xl">
                  {(displayName ?? 'P')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900 text-lg leading-tight">
                {displayName ?? '—'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{user?.email ?? '—'}</p>
              <span className="mt-1.5 inline-block text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                Paciente
              </span>
            </div>
          </div>
        </div>

        {/* Active appointment */}
        <ActiveAppointmentCard
          appointment={appointment}
          loading={loadingAppt}
          cancelling={cancelling}
          onCancel={handleCancel}
        />

        {/* Booking panel */}
        {!loadingAppt && (
          appointment ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Agendar Nueva Cita</h3>
              <p className="text-sm text-gray-500">
                Tienes una cita activa. Cancélala primero para poder agendar una nueva.
              </p>
            </div>
          ) : user ? (
            <BookingForm userId={user.id} onBooked={fetchActiveAppointment} />
          ) : null
        )}

      </main>
    </div>
  )
}
