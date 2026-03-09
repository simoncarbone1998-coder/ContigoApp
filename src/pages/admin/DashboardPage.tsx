import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import type { Profile, Appointment } from '../../lib/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function formatTime(t: string) {
  return t.slice(0, 5)
}
function initials(name: string | null, email: string | null) {
  if (name) {
    const p = name.trim().split(' ').filter(Boolean)
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0][0].toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

type Tab = 'appointments' | 'patients' | 'doctors'

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('appointments')
  const [patients, setPatients] = useState<Profile[]>([])
  const [doctors, setDoctors] = useState<Profile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [pR, dR, aR] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'patient').order('full_name'),
      supabase.from('profiles').select('*').eq('role', 'doctor').order('full_name'),
      supabase.from('appointments').select('*, patient:patient_id(id, full_name, email), doctor:doctor_id(id, full_name, email), slot:slot_id(*)').order('created_at', { ascending: false }),
    ])
    if (pR.error || dR.error || aR.error) setError('No se pudo cargar la información. Intenta de nuevo.')
    else {
      setPatients((pR.data ?? []) as Profile[])
      setDoctors((dR.data ?? []) as Profile[])
      setAppointments((aR.data ?? []) as Appointment[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCancel(id: string) {
    setCancelling(id)
    setError(null)
    const { error: err } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    if (err) setError('No se pudo cancelar la cita. Intenta de nuevo.')
    else await fetchAll()
    setCancelling(null)
  }

  const stats = [
    { label: 'Pacientes', value: patients.length, bg: 'bg-blue-50', text: 'text-blue-700', icon: '👥' },
    { label: 'Médicos', value: doctors.length, bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '🩺' },
    { label: 'Citas totales', value: appointments.length, bg: 'bg-violet-50', text: 'text-violet-700', icon: '🗓️' },
    {
      label: 'Citas activas',
      value: appointments.filter((a) => a.status === 'confirmed').length,
      bg: 'bg-amber-50', text: 'text-amber-700', icon: '✅',
    },
  ]

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'appointments', label: 'Citas', count: appointments.length },
    { key: 'patients', label: 'Pacientes', count: patients.length },
    { key: 'doctors', label: 'Médicos', count: doctors.length },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel de Administración</h1>
          <p className="text-slate-500 text-sm mt-1">Vista general de toda la operación.</p>
        </div>

        {error && (
          <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-5`}>
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className={`text-3xl font-extrabold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs + table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  tab === t.key
                    ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {t.label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
              </div>
            ) : tab === 'patients' ? (
              <ProfileTable profiles={patients} emptyMsg="No hay pacientes registrados." />
            ) : tab === 'doctors' ? (
              <ProfileTable profiles={doctors} emptyMsg="No hay médicos registrados." />
            ) : (
              <AppointmentsTable appointments={appointments} cancelling={cancelling} onCancel={handleCancel} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ProfileTable({ profiles, emptyMsg }: { profiles: Profile[]; emptyMsg: string }) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-500 text-sm font-medium">{emptyMsg}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Usuario</th>
            <th className="text-left py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Correo</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3.5 pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-700 text-xs font-bold">{initials(p.full_name, p.email)}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{p.full_name ?? '—'}</span>
                </div>
              </td>
              <td className="py-3.5 text-slate-500">{p.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AppointmentsTable({
  appointments, cancelling, onCancel,
}: { appointments: Appointment[]; cancelling: string | null; onCancel: (id: string) => void }) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-500 text-sm font-medium">No hay citas registradas.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {['Paciente', 'Médico', 'Fecha y Hora', 'Estado', 'Acción'].map((h) => (
              <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr key={appt.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3.5 pr-4">
                <span className="font-semibold text-slate-900">
                  {appt.patient?.full_name ?? appt.patient?.email ?? '—'}
                </span>
              </td>
              <td className="py-3.5 pr-4 text-slate-600">
                {appt.doctor?.full_name ?? '—'}
              </td>
              <td className="py-3.5 pr-4 text-slate-500 whitespace-nowrap">
                {appt.slot ? `${formatDate(appt.slot.date)} · ${formatTime(appt.slot.start_time)}` : '—'}
              </td>
              <td className="py-3.5 pr-4">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  appt.status === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {appt.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                </span>
              </td>
              <td className="py-3.5">
                {appt.status === 'confirmed' && (
                  <button
                    onClick={() => onCancel(appt.id)}
                    disabled={cancelling === appt.id}
                    className="text-xs px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 font-medium"
                  >
                    {cancelling === appt.id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
