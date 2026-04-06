import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, Appointment } from '../../lib/types'
import type { Role } from '../../lib/types'
import { specialtyLabel } from '../../lib/types'

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

const ROLE_LABELS: Record<Role, string> = { patient: 'Paciente', doctor: 'Médico', admin: 'Admin' }
const ROLE_COLORS: Record<Role, string> = {
  patient: 'bg-blue-50 text-blue-700 border-blue-200',
  doctor:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  admin:   'bg-red-50 text-red-700 border-red-200',
}

type Tab = 'appointments' | 'users' | 'ratings' | 'exams'

export default function AdminDashboard() {
  const { profile: adminProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('appointments')
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [diagOrders, setDiagOrders] = useState<any[]>([])

  // Pending doctors
  const [pendingDoctors, setPendingDoctors] = useState<Profile[]>([])
  const [rejectTarget,   setRejectTarget]   = useState<Profile | null>(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [processingId,   setProcessingId]   = useState<string | null>(null)

  // User management state
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<Role | 'all'>('all')
  const [roleChanging, setRoleChanging] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ user: Profile; newRole: Role } | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [detailUser, setDetailUser] = useState<Profile | null>(null)
  const [detailApptCount, setDetailApptCount] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const fetchPending = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'doctor').eq('doctor_status', 'pending').order('created_at', { ascending: false })
    setPendingDoctors((data ?? []) as Profile[])
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  async function handleApprove(doctor: Profile) {
    setProcessingId(doctor.id)
    await supabase.from('profiles').update({ doctor_status: 'approved', approved_at: new Date().toISOString() }).eq('id', doctor.id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: doctor.email,
          subject: '✅ Tu cuenta ha sido aprobada — Contigo',
          html: `
            <p>¡Bienvenido a Contigo, Dr(a). ${doctor.full_name}! 🎉</p>
            <p>Tu cuenta ha sido aprobada. Ya puedes iniciar sesión y empezar a recibir pacientes.</p>
            <br/>
            <p><a href="https://contigomedicina.com/login" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Iniciar sesión →</a></p>
            <br/>
            <p>El equipo de Contigo</p>
          `,
        },
      })
    } catch { /* non-critical */ }
    setPendingDoctors((prev) => prev.filter((d) => d.id !== doctor.id))
    setAllUsers((prev) => prev.map((u) => u.id === doctor.id ? { ...u, doctor_status: 'approved' as const } : u))
    showToast(`✅ ${doctor.full_name ?? doctor.email} aprobado exitosamente`)
    setProcessingId(null)
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    const doctor = rejectTarget
    setProcessingId(doctor.id)
    setRejectTarget(null)
    await supabase.from('profiles').update({ doctor_status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: rejectReason.trim() || null }).eq('id', doctor.id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: doctor.email,
          subject: 'Tu solicitud en Contigo',
          html: `
            <p>Hola Dr(a). ${doctor.full_name},</p>
            <p>Hemos revisado tu solicitud y lamentablemente no podemos aprobarla en este momento.</p>
            ${rejectReason.trim() ? `<p><strong>Motivo:</strong> ${rejectReason.trim()}</p>` : ''}
            <br/>
            <p>Para más información escríbenos a <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p>
            <br/>
            <p>El equipo de Contigo</p>
          `,
        },
      })
    } catch { /* non-critical */ }
    setPendingDoctors((prev) => prev.filter((d) => d.id !== doctor.id))
    setAllUsers((prev) => prev.map((u) => u.id === doctor.id ? { ...u, doctor_status: 'rejected' as const } : u))
    showToast('Solicitud rechazada')
    setRejectReason('')
    setProcessingId(null)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [uR, aR, fR, doR] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, patient:patient_id(id, full_name, email), doctor:doctor_id(id, full_name, email), slot:slot_id(*)').order('created_at', { ascending: false }),
      supabase.from('appointment_feedback')
        .select('id, rating, comment, created_at, doctor_id, patient:patient_id(full_name), doctor:doctor_id(full_name), appointment:appointment_id(slot:slot_id(date, start_time))')
        .order('created_at', { ascending: false }),
      supabase.from('diagnostic_orders')
        .select('id, exam_type, status, created_at, patient:patient_id(full_name), doctor:doctor_id(full_name)')
        .order('created_at', { ascending: false }),
    ])
    if (uR.error || aR.error) setError('No se pudo cargar la información. Intenta de nuevo.')
    else {
      setAllUsers((uR.data ?? []) as Profile[])
      setAppointments((aR.data ?? []) as Appointment[])
      setFeedbacks(fR.data ?? [])
      setDiagOrders(doR.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Fetch appointment count when detail modal opens
  useEffect(() => {
    if (!detailUser) { setDetailApptCount(null); return }
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .or(`patient_id.eq.${detailUser.id},doctor_id.eq.${detailUser.id}`)
      .then(({ count }) => setDetailApptCount(count ?? 0))
  }, [detailUser])

  async function handleCancel(id: string) {
    setCancelling(id)
    setError(null)
    const { error: err } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    if (err) setError('No se pudo cancelar la cita. Intenta de nuevo.')
    else await fetchAll()
    setCancelling(null)
  }

  async function handleRoleChange() {
    if (!confirmTarget) return
    const { user, newRole } = confirmTarget
    // Extra guard: require typing "CONFIRMAR" for admin promotion
    if (newRole === 'admin' && confirmInput !== 'CONFIRMAR') return
    setRoleChanging(user.id)
    const { error: err } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (err) {
      setError('No se pudo cambiar el rol. Intenta de nuevo.')
    } else {
      setAllUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
      showToast(`Rol de ${user.full_name ?? user.email} cambiado a ${ROLE_LABELS[newRole]}.`)
    }
    setRoleChanging(null)
    setConfirmTarget(null)
    setConfirmInput('')
  }

  const patients = allUsers.filter((u) => u.role === 'patient')
  const doctors  = allUsers.filter((u) => u.role === 'doctor')

  const stats = [
    { label: 'Pacientes',    value: patients.length,     bg: 'bg-blue-50',    text: 'text-blue-700',    icon: '👥' },
    { label: 'Médicos',      value: doctors.length,      bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '🩺' },
    { label: 'Citas totales', value: appointments.length, bg: 'bg-violet-50',  text: 'text-violet-700',  icon: '🗓️' },
    {
      label: 'Citas activas',
      value: appointments.filter((a) => a.status === 'confirmed').length,
      bg: 'bg-amber-50', text: 'text-amber-700', icon: '✅',
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctorAvgMap: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratingsByDoctor: Record<string, number[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedbacks.forEach((f: any) => {
    if (!ratingsByDoctor[f.doctor_id]) ratingsByDoctor[f.doctor_id] = []
    ratingsByDoctor[f.doctor_id].push(f.rating)
  })
  Object.entries(ratingsByDoctor).forEach(([id, ratings]) => {
    doctorAvgMap[id] = ratings.reduce((a, b) => a + b, 0) / ratings.length
  })

  const avgRating = feedbacks.length
    ? (feedbacks.reduce((sum: number, f: any) => sum + f.rating, 0) / feedbacks.length)
    : 0

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'appointments', label: 'Citas',          count: appointments.length },
    { key: 'users',        label: 'Usuarios',        count: allUsers.length },
    { key: 'ratings',      label: 'Calificaciones',  count: feedbacks.length },
    { key: 'exams',        label: 'Exámenes',        count: diagOrders.length },
  ]

  // Filtered users for users tab
  const filteredUsers = allUsers.filter((u) => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
    const q = userSearch.toLowerCase()
    const matchesSearch = !q
      || (u.full_name ?? '').toLowerCase().includes(q)
      || (u.email ?? '').toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Role change confirmation modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Cambiar rol</h2>
                <p className="text-sm text-slate-600 mt-1">
                  ¿Cambiar el rol de <strong>{confirmTarget.user.full_name ?? confirmTarget.user.email}</strong> a{' '}
                  <strong>{ROLE_LABELS[confirmTarget.newRole]}</strong>?
                </p>
              </div>
            </div>

            {confirmTarget.newRole === 'admin' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">
                  Advertencia: estás a punto de otorgar permisos de administrador completos a este usuario.
                  Tendrá acceso total al panel de administración.
                </p>
                <p className="text-xs text-red-600">Escribe <strong>CONFIRMAR</strong> para continuar:</p>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setConfirmTarget(null); setConfirmInput('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRoleChange}
                disabled={
                  roleChanging === confirmTarget.user.id ||
                  (confirmTarget.newRole === 'admin' && confirmInput !== 'CONFIRMAR')
                }
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {roleChanging === confirmTarget.user.id ? 'Cambiando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject doctor modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🚫</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rechazar solicitud</h2>
                <p className="text-sm text-slate-600 mt-1">
                  ¿Rechazar la solicitud de <strong>{rejectTarget.full_name ?? rejectTarget.email}</strong>?
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Motivo del rechazo (opcional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: La tarjeta profesional no es legible, por favor enviar una nueva..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={processingId === rejectTarget.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processingId === rejectTarget.id ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {detailUser && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetailUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Detalle del usuario</h2>
              <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-700 text-xl font-bold">{initials(detailUser.full_name, detailUser.email)}</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">{detailUser.full_name ?? '—'}</p>
                <p className="text-slate-500 text-sm">{detailUser.email ?? '—'}</p>
                <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_COLORS[detailUser.role]}`}>
                  {ROLE_LABELS[detailUser.role]}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Teléfono', value: detailUser.phone },
                { label: 'Ciudad', value: detailUser.city },
                { label: 'Fecha de nacimiento', value: detailUser.birth_date ? formatDate(detailUser.birth_date) : null },
                { label: 'Registro', value: formatDate(detailUser.created_at.slice(0, 10)) },
                ...(detailUser.role === 'doctor' ? [
                  { label: 'Especialidad', value: specialtyLabel(detailUser.specialty) },
                  { label: 'Universidad', value: detailUser.undergraduate_university },
                  { label: 'Posgrado', value: detailUser.postgraduate_specialty },
                ] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-slate-400 font-medium">{label}</span>
                  <span className="text-slate-800 text-right">{value ?? '—'}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <span className="text-slate-400 font-medium">Citas</span>
                <span className="text-slate-800">
                  {detailApptCount === null ? '...' : detailApptCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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

        {/* Pending doctors section */}
        {pendingDoctors.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <h2 className="text-base font-bold text-slate-900">Médicos pendientes de aprobación</h2>
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingDoctors.length}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {pendingDoctors.map((doctor) => (
                <div key={doctor.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-emerald-700 text-sm font-bold">{initials(doctor.full_name, doctor.email)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{doctor.full_name ?? '—'}</p>
                      <p className="text-sm text-slate-500">{doctor.email}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                        {doctor.specialty && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{specialtyLabel(doctor.specialty)}</span>
                        )}
                        {doctor.undergraduate_university && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md">{doctor.undergraduate_university}</span>
                        )}
                        {doctor.medical_license && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md">T.P. {doctor.medical_license}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(doctor)}
                      disabled={processingId === doctor.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processingId === doctor.id ? '...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => { setRejectTarget(doctor); setRejectReason('') }}
                      disabled={processingId === doctor.id}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            ) : tab === 'users' ? (
              <UsersSection
                users={filteredUsers}
                search={userSearch}
                onSearchChange={setUserSearch}
                roleFilter={userRoleFilter}
                onRoleFilterChange={setUserRoleFilter}
                currentAdminId={adminProfile?.id ?? null}
                roleChanging={roleChanging}
                onRoleChange={(user, newRole) => { setConfirmTarget({ user, newRole }); setConfirmInput('') }}
                onDetail={setDetailUser}
                ratingMap={doctorAvgMap}
              />
            ) : tab === 'ratings' ? (
              <RatingsSection feedbacks={feedbacks} avgRating={avgRating} />
            ) : tab === 'exams' ? (
              <ExamsSection orders={diagOrders} />
            ) : (
              <AppointmentsTable appointments={appointments} cancelling={cancelling} onCancel={handleCancel} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function UsersSection({
  users, search, onSearchChange, roleFilter, onRoleFilterChange,
  currentAdminId, roleChanging, onRoleChange, onDetail, ratingMap,
}: {
  users: Profile[]
  search: string
  onSearchChange: (v: string) => void
  roleFilter: Role | 'all'
  onRoleFilterChange: (v: Role | 'all') => void
  currentAdminId: string | null
  roleChanging: string | null
  onRoleChange: (user: Profile, newRole: Role) => void
  onDetail: (user: Profile) => void
  ratingMap: Record<string, number>
}) {
  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as Role | 'all')}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="all">Todos los roles</option>
          <option value="patient">Pacientes</option>
          <option value="doctor">Médicos</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm font-medium">No hay usuarios que coincidan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Usuario', 'Correo', 'Rol', 'Registro', 'Cambiar rol', ''].map((h) => (
                  <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === currentAdminId
                const [y, m, d] = u.created_at.slice(0, 10).split('-')
                return (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    {/* Name + avatar */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-blue-700 text-xs font-bold">{initials(u.full_name, u.email)}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">{u.full_name ?? '—'}</span>
                          {u.role === 'doctor' && ratingMap[u.id] !== undefined && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <StarsDisplay rating={Math.round(ratingMap[u.id])} />
                              <span className="text-xs text-slate-400">{ratingMap[u.id].toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 pr-4 text-slate-500">{u.email ?? '—'}</td>

                    {/* Role badge */}
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border w-fit ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                        {u.role === 'doctor' && u.doctor_status && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border w-fit ${
                            u.doctor_status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : u.doctor_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {u.doctor_status === 'approved' ? 'Aprobado' : u.doctor_status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Registration date */}
                    <td className="py-3.5 pr-4 text-slate-500 whitespace-nowrap">{`${d}/${m}/${y}`}</td>

                    {/* Role change dropdown */}
                    <td className="py-3.5 pr-4">
                      {isMe ? (
                        <span className="text-xs text-slate-300 italic">tú</span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={roleChanging === u.id}
                          onChange={(e) => onRoleChange(u, e.target.value as Role)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:opacity-50"
                        >
                          <option value="patient">Hacer paciente</option>
                          <option value="doctor">Hacer médico</option>
                          <option value="admin">Hacer admin</option>
                        </select>
                      )}
                    </td>

                    {/* Detail button */}
                    <td className="py-3.5">
                      <button
                        onClick={() => onDetail(u)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors font-medium whitespace-nowrap"
                      >
                        Ver perfil
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-sm leading-none">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RatingsSection({ feedbacks, avgRating }: { feedbacks: any[]; avgRating: number }) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <p className="text-2xl mb-2">⭐</p>
          <p className="text-3xl font-extrabold text-amber-700">
            {feedbacks.length > 0 ? avgRating.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Promedio general</p>
        </div>
        <div className="bg-violet-50 rounded-2xl border border-violet-100 p-5">
          <p className="text-2xl mb-2">💬</p>
          <p className="text-3xl font-extrabold text-violet-700">{feedbacks.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Total calificaciones</p>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm font-medium">No hay calificaciones registradas aún.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Médico', 'Paciente', 'Fecha', 'Calificación', 'Comentario'].map((h) => (
                  <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f: any) => {
                const slotDate = f.appointment?.slot?.date
                const slotTime = f.appointment?.slot?.start_time
                return (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">
                      {f.doctor?.full_name ?? '—'}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-600">
                      {f.patient?.full_name ?? '—'}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-500 whitespace-nowrap">
                      {slotDate ? (() => {
                        const [y, m, d] = slotDate.split('-')
                        return `${d}/${m}/${y}${slotTime ? ` · ${slotTime.slice(0, 5)}` : ''}`
                      })() : '—'}
                    </td>
                    <td className="py-3.5 pr-4">
                      <StarsDisplay rating={f.rating} />
                    </td>
                    <td className="py-3.5 text-slate-500 max-w-xs truncate">
                      {f.comment ?? <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExamsSection({ orders }: { orders: any[] }) {
  const pending   = orders.filter((o) => o.status === 'pending').length
  const scheduled = orders.filter((o) => o.status === 'scheduled').length
  const completed = orders.filter((o) => o.status === 'completed').length

  const examStats = [
    { label: 'Total órdenes', value: orders.length, bg: 'bg-violet-50', text: 'text-violet-700', icon: '🔬' },
    { label: 'Pendientes',    value: pending,        bg: 'bg-orange-50', text: 'text-orange-700', icon: '⏳' },
    { label: 'Agendados',     value: scheduled,      bg: 'bg-blue-50',   text: 'text-blue-700',   icon: '📅' },
    { label: 'Completados',   value: completed,      bg: 'bg-emerald-50',text: 'text-emerald-700',icon: '✅' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {examStats.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-4`}>
            <p className="text-xl mb-1">{s.icon}</p>
            <p className={`text-2xl font-extrabold ${s.text}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm font-medium">No hay órdenes de exámenes registradas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Paciente', 'Médico', 'Examen', 'Estado', 'Fecha'].map((h) => (
                  <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => {
                const [y, m, d] = o.created_at.slice(0, 10).split('-')
                return (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">{o.patient?.full_name ?? '—'}</td>
                    <td className="py-3.5 pr-4 text-slate-600">{o.doctor?.full_name ?? '—'}</td>
                    <td className="py-3.5 pr-4 text-slate-700">{o.exam_type}</td>
                    <td className="py-3.5 pr-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        o.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : o.status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {o.status === 'completed' ? 'Completado' : o.status === 'scheduled' ? 'Agendado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-500 whitespace-nowrap">{`${d}/${m}/${y}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
