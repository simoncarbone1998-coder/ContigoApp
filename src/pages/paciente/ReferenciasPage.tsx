import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

const SPECIALTY_LABELS: Record<string, string> = {
  medicina_general: 'Medicina General',
  pediatria:        'Pediatría',
  cardiologia:      'Cardiología',
  dermatologia:     'Dermatología',
  ginecologia:      'Ginecología',
  ortopedia:        'Ortopedia',
  psicologia:       'Psicología',
}

const SPECIALTY_ICONS: Record<string, string> = {
  medicina_general: '🩺',
  pediatria:        '👶',
  cardiologia:      '❤️',
  dermatologia:     '🔬',
  ginecologia:      '🌸',
  ortopedia:        '🦴',
  psicologia:       '🧠',
}

function specLabel(s: string) { return SPECIALTY_LABELS[s] ?? s }
function specIcon(s: string)  { return SPECIALTY_ICONS[s] ?? '🏥' }

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Referral = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reminder = any

export default function ReferenciasPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [{ data: refs }, { data: rems }] = await Promise.all([
      supabase
        .from('specialist_referrals')
        .select('*, referring_doctor:referring_doctor_id(full_name)')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('follow_up_reminders')
        .select('*, doctor:doctor_id(full_name)')
        .eq('patient_id', profile.id)
        .order('reminder_date', { ascending: true }),
    ])
    setReferrals(refs ?? [])
    setReminders(rems ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  const activeRefs = referrals.filter((r: Referral) => r.status === 'active')
  const usedRefs   = referrals.filter((r: Referral) => r.status === 'used')
  const activeRems = reminders.filter((r: Reminder) => r.status === 'pending' || r.status === 'notified')
  const doneRems   = reminders.filter((r: Reminder) => r.status === 'booked')

  async function handleBookReferral(ref: Referral) {
    // Mark referral as used and navigate to booking
    await supabase.from('specialist_referrals').update({ status: 'used' }).eq('id', ref.id)
    navigate(`/paciente/agendar?specialty=${ref.specialty}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Referencias médicas</h1>
          <p className="text-slate-500 text-sm mt-1">Tus referencias y controles programados.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Empty state */}
            {activeRefs.length === 0 && activeRems.length === 0 && usedRefs.length === 0 && doneRems.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
                <span className="text-4xl block mb-3">📋</span>
                <p className="text-slate-700 font-semibold">No tienes referencias médicas activas.</p>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  Tu médico puede referirte a un especialista durante tu consulta.
                </p>
              </div>
            )}

            {/* Active referrals */}
            {activeRefs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Referencias activas</h2>
                {activeRefs.map((ref: Referral) => (
                  <div key={ref.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{specIcon(ref.specialty)}</span>
                        <p className="text-base font-bold text-slate-900">{specLabel(ref.specialty)}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        ref.urgency === 'prioritaria'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {ref.urgency === 'prioritaria' ? 'Prioritaria' : 'Rutinaria'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium">Doctor que refirió:</span> Dr(a). {ref.referring_doctor?.full_name ?? '—'}</p>
                      <p><span className="font-medium">Fecha:</span> {formatDate(ref.created_at.slice(0, 10))}</p>
                      <p><span className="font-medium">Motivo:</span> {ref.reason}</p>
                    </div>
                    <button
                      onClick={() => handleBookReferral(ref)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                    >
                      Agendar cita →
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* Active reminders */}
            {activeRems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Controles programados</h2>
                {activeRems.map((rem: Reminder) => (
                  <div key={rem.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{specIcon(rem.specialty)}</span>
                        <p className="text-base font-bold text-slate-900">{specLabel(rem.specialty)}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        rem.status === 'notified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {rem.status === 'notified' ? 'Puedes agendar' : 'Próximamente'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium">Doctor:</span> Dr(a). {rem.doctor?.full_name ?? '—'}</p>
                      <p><span className="font-medium">Fecha recomendada:</span> {formatDate(rem.reminder_date)}</p>
                      {rem.note && <p><span className="font-medium">Nota:</span> {rem.note}</p>}
                    </div>
                    {rem.status === 'notified' && (
                      <button
                        onClick={() => navigate(`/paciente/agendar?specialty=${rem.specialty}`)}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                      >
                        Agendar control →
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* History */}
            {(usedRefs.length > 0 || doneRems.length > 0) && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Historial</h2>
                {usedRefs.map((ref: Referral) => (
                  <div key={ref.id} className="bg-white rounded-2xl border border-slate-100 p-4 opacity-60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{specIcon(ref.specialty)}</span>
                        <p className="text-sm font-semibold text-slate-500">{specLabel(ref.specialty)}</p>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Usada</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">{ref.reason}</p>
                  </div>
                ))}
                {doneRems.map((rem: Reminder) => (
                  <div key={rem.id} className="bg-white rounded-2xl border border-slate-100 p-4 opacity-60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{specIcon(rem.specialty)}</span>
                        <p className="text-sm font-semibold text-slate-500">{specLabel(rem.specialty)}</p>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Agendado</span>
                    </div>
                    {rem.note && <p className="text-xs text-slate-400 mt-1.5">{rem.note}</p>}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
