import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminContext } from './AdminContext'
import type { Profile, Appointment, PatientApplication, UnderwritingRulebook } from '../../lib/types'
import type { Role } from '../../lib/types'
import { specialtyLabel } from '../../lib/types'

const SPECIALTY_LABELS: Record<string, string> = {
  medicina_general: 'Med. General', pediatria: 'Pediatría', cardiologia: 'Cardiología',
  dermatologia: 'Dermatología', ginecologia: 'Ginecología', ortopedia: 'Ortopedia', psicologia: 'Psicología',
}
const ROLE_LABELS: Record<Role, string> = { patient: 'Paciente', doctor: 'Médico', admin: 'Admin', laboratory: 'Laboratorio' }
const ROLE_COLORS: Record<Role, string> = {
  patient: 'bg-blue-50 text-blue-700 border-blue-200', doctor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  admin: 'bg-red-50 text-red-700 border-red-200', laboratory: 'bg-violet-50 text-violet-700 border-violet-200',
}

function formatDate(d: string) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
function formatTime(t: string) { return t.slice(0, 5) }
function initials(name: string | null, email: string | null) {
  if (name) { const p = name.trim().split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0][0].toUpperCase() }
  return (email?.[0] ?? '?').toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

function SidebarLink({ to, label, badge }: { to: string; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`
      }
      style={({ isActive }) => isActive ? { backgroundColor: 'rgba(255,255,255,0.15)' } : {}}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      {children}
    </div>
  )
}

function Sidebar({ pendingPatients, pendingDoctors, email, onSignOut, mobileOpen, onMobileClose }: {
  pendingPatients: number; pendingDoctors: number; email: string | null
  onSignOut: () => void; mobileOpen: boolean; onMobileClose: () => void
}) {
  const inner = (
    <div className="flex flex-col h-full" style={{ background: '#1e3a5f' }}>
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Contigo" className="h-8 w-auto brightness-0 invert" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div>
            <p className="text-white font-bold text-base leading-tight">contigo</p>
            <p className="text-white/50 text-[10px] leading-tight">Panel de administración</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0 overflow-y-auto">
        <SidebarSection label="Aprobaciones">
          <SidebarLink to="/admin/aprobaciones/pacientes" label="Pacientes" badge={pendingPatients} />
          <SidebarLink to="/admin/aprobaciones/medicos"   label="Médicos"   badge={pendingDoctors} />
        </SidebarSection>
        <SidebarSection label="Company Data">
          <SidebarLink to="/admin/data/metricas"      label="Métricas" />
          <SidebarLink to="/admin/data/usuarios"      label="Usuarios" />
          <SidebarLink to="/admin/data/citas"         label="Citas" />
          <SidebarLink to="/admin/data/calificaciones" label="Calificaciones" />
        </SidebarSection>
        <SidebarSection label="AI Bots">
          <SidebarLink to="/admin/bots/underwriting" label="Underwriting" />
          <SidebarLink to="/admin/bots/chat"         label="Chat IA" />
        </SidebarSection>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-white/50 text-xs truncate mb-2">{email ?? '—'}</p>
        <button onClick={onSignOut}
          className="text-white/60 hover:text-white text-xs font-medium transition-colors">
          Cerrar sesión →
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 fixed top-0 left-0 h-screen z-30">
        {inner}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative w-[220px] flex flex-col z-50">
            {inner}
          </aside>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LAYOUT (provider + shell)
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { profile: adminProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  // ── All shared state ────────────────────────────────────────────────────────
  const [allUsers,      setAllUsers]      = useState<Profile[]>([])
  const [appointments,  setAppointments]  = useState<Appointment[]>([])
  const [loading,       setLoading]       = useState(true)
  const [cancelling,    setCancelling]    = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [feedbacks,     setFeedbacks]     = useState<unknown[]>([])
  const [diagOrders,    setDiagOrders]    = useState<unknown[]>([])
  const [referralStats, setReferralStats] = useState<{ monthCount: number; topSpecialty: string | null }>({ monthCount: 0, topSpecialty: null })

  // Metrics extras
  const [monthlyApprovedPatients, setMonthlyApprovedPatients] = useState<{ month: string; count: number }[]>([])
  const [apptsBySpecialty,        setApptsBySpecialty]        = useState<{ specialty: string; count: number; pct: number }[]>([])
  const [doctorRatingsTable,      setDoctorRatingsTable]      = useState<{ id: string; name: string; specialty: string; totalAppts: number; avg: number }[]>([])

  // Pending doctors
  const [pendingDoctors, setPendingDoctors] = useState<Profile[]>([])
  const [rejectTarget,   setRejectTarget]   = useState<Profile | null>(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [processingId,   setProcessingId]   = useState<string | null>(null)

  // Labs
  const [allLabs,         setAllLabs]         = useState<unknown[]>([])
  const [labRejectTarget, setLabRejectTarget] = useState<unknown | null>(null)
  const [labRejectReason, setLabRejectReason] = useState('')
  const [labProcessingId, setLabProcessingId] = useState<string | null>(null)
  const [labDetail,       setLabDetail]       = useState<unknown | null>(null)

  // Applications
  const [applications,      setApplications]      = useState<PatientApplication[]>([])
  const [questionnaires,    setQuestionnaires]    = useState<Record<string, unknown>>({})
  const [appProcessingId,   setAppProcessingId]   = useState<string | null>(null)
  const [appRejectTarget,   setAppRejectTarget]   = useState<PatientApplication | null>(null)
  const [appRejectNote,     setAppRejectNote]     = useState('')
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({})
  const [historyFilter,     setHistoryFilter]     = useState<'all' | 'approved' | 'rejected'>('all')
  const [historySearch,     setHistorySearch]     = useState('')

  // Underwriting
  const [rulebooks,         setRulebooks]         = useState<UnderwritingRulebook[]>([])
  const [uwTab,             setUwTab]             = useState<'config' | 'simulator' | 'history'>('config')
  const [rbCostConsult,     setRbCostConsult]     = useState(40)
  const [rbCostMed,         setRbCostMed]         = useState(8)
  const [rbCostExam,        setRbCostExam]        = useState(12)
  const [rbIncome,          setRbIncome]          = useState(19)
  const [rbThresholdReview, setRbThresholdReview] = useState(1.0)
  const [rbThresholdReject, setRbThresholdReject] = useState(2.0)
  const [rbInstructions,    setRbInstructions]    = useState('')
  const [rbVersionName,     setRbVersionName]     = useState('')
  const [rbSaving,          setRbSaving]          = useState(false)
  const [rbCompare,         setRbCompare]         = useState<string | null>(null)
  const [simAge,            setSimAge]            = useState('')
  const [simSex,            setSimSex]            = useState('')
  const [simConditions,     setSimConditions]     = useState<string[]>([])
  const [simHospitalized,   setSimHospitalized]   = useState<boolean | null>(null)
  const [simTreatment,      setSimTreatment]      = useState<boolean | null>(null)
  const [simMeds,           setSimMeds]           = useState<boolean | null>(null)
  const [simSmoking,        setSimSmoking]        = useState('')
  const [simEps,            setSimEps]            = useState<boolean | null>(null)
  const [simRulebookId,     setSimRulebookId]     = useState('')
  const [simRunning,        setSimRunning]        = useState(false)
  const [simResult,         setSimResult]         = useState<unknown | null>(null)

  // Chat IA
  const [chatDocuments,    setChatDocuments]    = useState<unknown[]>([])
  const [chatConfig,       setChatConfig]       = useState<unknown | null>(null)
  const [chatLeads,        setChatLeads]        = useState<unknown[]>([])
  const [chatSubTab,       setChatSubTab]       = useState<'documents' | 'prompt' | 'simulator' | 'leads'>('documents')
  const [chatPrompt,       setChatPrompt]       = useState('')
  const [chatPromptSaving, setChatPromptSaving] = useState(false)
  const [chatUploading,    setChatUploading]    = useState(false)
  const [chatDeleteTarget, setChatDeleteTarget] = useState<string | null>(null)
  const [chatLeadDetail,   setChatLeadDetail]   = useState<unknown | null>(null)
  const [chatSimMsgs,      setChatSimMsgs]      = useState<{ role: 'user' | 'assistant'; content: string; id: string }[]>([])
  const [chatSimInput,     setChatSimInput]     = useState('')
  const [chatSimLoading,   setChatSimLoading]   = useState(false)
  const [chatSimUseCustom, setChatSimUseCustom] = useState(false)
  const chatSimHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Users
  const [userSearch,      setUserSearch]      = useState('')
  const [userRoleFilter,  setUserRoleFilter]  = useState<Role | 'all'>('all')
  const [roleChanging,    setRoleChanging]    = useState<string | null>(null)
  const [confirmTarget,   setConfirmTarget]   = useState<{ user: Profile; newRole: Role } | null>(null)
  const [confirmInput,    setConfirmInput]    = useState('')
  const [detailUser,      setDetailUser]      = useState<Profile | null>(null)
  const [detailApptCount, setDetailApptCount] = useState<number | null>(null)

  // Toast
  const [toast,      setToast]     = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch functions ─────────────────────────────────────────────────────────

  const fetchPending = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'doctor').eq('doctor_status', 'pending').order('created_at', { ascending: false })
    setPendingDoctors((data ?? []) as Profile[])
  }, [])

  const fetchLabs = useCallback(async () => {
    const { data } = await supabase.rpc('admin_get_all_labs')
    setAllLabs((data ?? []) as unknown[])
  }, [])

  const fetchApplications = useCallback(async () => {
    const { data } = await supabase
      .from('patient_applications')
      .select('*, patient:patient_id(id, full_name, email, city, phone), rulebook:rulebook_version_id(version, name)')
      .order('submitted_at', { ascending: false })
    setApplications((data ?? []) as PatientApplication[])
    if (data && data.length > 0) {
      const patientIds = data.map((a: PatientApplication) => a.patient_id)
      const { data: qs } = await supabase.from('health_questionnaire').select('*').in('patient_id', patientIds)
      const qMap: Record<string, unknown> = {}
      ;(qs ?? []).forEach((q: { patient_id: string }) => { qMap[q.patient_id] = q })
      setQuestionnaires(qMap)
    }
  }, [])

  const fetchRulebooks = useCallback(async () => {
    const { data } = await supabase.from('underwriting_rulebooks').select('*').order('version', { ascending: false })
    const rbs = (data ?? []) as UnderwritingRulebook[]
    setRulebooks(rbs)
    const active = rbs.find((r) => r.is_active)
    if (active) {
      setRbCostConsult(active.cost_per_consultation_usd)
      setRbCostMed(active.cost_per_medication_usd)
      setRbCostExam(active.cost_per_exam_usd)
      setRbIncome(active.monthly_income_usd)
      setRbThresholdReview(active.threshold_review)
      setRbThresholdReject(active.threshold_reject)
      setRbInstructions(active.ai_instructions)
      const nextVersion = (rbs[0]?.version ?? 1) + 1
      setRbVersionName(`v${nextVersion} - `)
      setSimRulebookId(active.id)
    }
  }, [])

  const fetchChatDocuments = useCallback(async () => {
    const { data } = await supabase.from('chat_documents').select('*').order('created_at', { ascending: false })
    setChatDocuments(data ?? [])
  }, [])

  const fetchChatConfig = useCallback(async () => {
    const { data } = await supabase.from('chat_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) { setChatConfig(data); setChatPrompt((data as { system_prompt: string }).system_prompt) }
  }, [])

  const fetchChatLeads = useCallback(async () => {
    const { data } = await supabase.from('chat_leads').select('*').order('created_at', { ascending: false })
    setChatLeads(data ?? [])
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const [uR, aR, fR, doR] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, patient:patient_id(id, full_name, email), doctor:doctor_id(id, full_name, email), slot:slot_id(*)').order('created_at', { ascending: false }),
      supabase.from('appointment_feedback').select('id, rating, comment, created_at, doctor_id, patient:patient_id(full_name), doctor:doctor_id(full_name, specialty), appointment:appointment_id(slot:slot_id(date, start_time))').order('created_at', { ascending: false }),
      supabase.from('diagnostic_orders').select('id, exam_type, status, created_at, patient:patient_id(full_name), doctor:doctor_id(full_name)').order('created_at', { ascending: false }),
    ])
    if (uR.error || aR.error) { setError('No se pudo cargar la información. Intenta de nuevo.') }
    else {
      const users = (uR.data ?? []) as Profile[]
      const appts = (aR.data ?? []) as Appointment[]
      setAllUsers(users)
      setAppointments(appts)
      setFeedbacks(fR.data ?? [])
      setDiagOrders(doR.data ?? [])

      // ── Metrics: monthly approved patients (last 6 months) ──
      const now = new Date()
      const months: { month: string; count: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push({ month: key, count: 0 })
      }
      users.filter((u) => u.role === 'patient' && (u.application_status === 'approved' || u.application_status === null))
        .forEach((u) => {
          const key = u.created_at.slice(0, 7)
          const m = months.find((x) => x.month === key)
          if (m) m.count++
        })
      setMonthlyApprovedPatients(months)

      // ── Metrics: appointments by specialty ──
      const specCount: Record<string, number> = {}
      appts.forEach((a) => {
        const spec = (a.doctor as { specialty?: string } | undefined)?.specialty ?? 'desconocido'
        specCount[spec] = (specCount[spec] ?? 0) + 1
      })
      const total = appts.length || 1
      setApptsBySpecialty(
        Object.entries(specCount)
          .sort((a, b) => b[1] - a[1])
          .map(([specialty, count]) => ({ specialty, count, pct: Math.round((count / total) * 100) }))
      )

      // ── Metrics: doctor ratings table ──
      const fbData = (fR.data ?? []) as { doctor_id: string; rating: number; doctor?: { full_name?: string; specialty?: string } }[]
      const rMap: Record<string, { name: string; specialty: string; ratings: number[]; appts: number }> = {}
      fbData.forEach((f) => {
        if (!rMap[f.doctor_id]) rMap[f.doctor_id] = { name: f.doctor?.full_name ?? '—', specialty: f.doctor?.specialty ?? '', ratings: [], appts: 0 }
        rMap[f.doctor_id].ratings.push(f.rating)
      })
      appts.forEach((a) => {
        const did = a.doctor_id
        if (rMap[did]) rMap[did].appts++
      })
      setDoctorRatingsTable(
        Object.entries(rMap)
          .map(([id, v]) => ({ id, name: v.name, specialty: v.specialty, totalAppts: v.appts, avg: v.ratings.reduce((a, b) => a + b, 0) / (v.ratings.length || 1) }))
          .sort((a, b) => b.avg - a.avg)
      )
    }

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const { data: monthRefs } = await supabase.from('specialist_referrals').select('specialty').gte('created_at', startOfMonth.toISOString())
    if (monthRefs) {
      const specCount: Record<string, number> = {}
      ;(monthRefs as { specialty: string }[]).forEach((r) => { specCount[r.specialty] = (specCount[r.specialty] ?? 0) + 1 })
      const top = Object.entries(specCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      setReferralStats({ monthCount: monthRefs.length, topSpecialty: top })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending(); fetchLabs(); fetchApplications(); fetchRulebooks(); fetchChatDocuments(); fetchChatConfig(); fetchChatLeads() }, [fetchPending, fetchLabs, fetchApplications, fetchRulebooks, fetchChatDocuments, fetchChatConfig, fetchChatLeads])
  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    if ((chatDocuments as { status: string }[]).some((d) => d.status === 'processing')) {
      const t = setInterval(fetchChatDocuments, 3000); return () => clearInterval(t)
    }
  }, [chatDocuments, fetchChatDocuments])
  useEffect(() => {
    if (!detailUser) { setDetailApptCount(null); return }
    supabase.from('appointments').select('id', { count: 'exact', head: true }).or(`patient_id.eq.${detailUser.id},doctor_id.eq.${detailUser.id}`).then(({ count }) => setDetailApptCount(count ?? 0))
  }, [detailUser])

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleApprove(doctor: Profile) {
    setProcessingId(doctor.id)
    await supabase.from('profiles').update({ doctor_status: 'approved', approved_at: new Date().toISOString() }).eq('id', doctor.id)
    try { await supabase.functions.invoke('send-email', { body: { to: doctor.email, subject: '✅ Tu cuenta ha sido aprobada — Contigo', html: `<p>¡Bienvenido a Contigo, Dr(a). ${doctor.full_name}! 🎉</p><p>Tu cuenta ha sido aprobada. Ya puedes iniciar sesión y empezar a recibir pacientes.</p><br/><p><a href="https://contigomedicina.com/login" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Iniciar sesión →</a></p><br/><p>El equipo de Contigo</p>` } }) } catch { /* non-critical */ }
    setPendingDoctors((prev) => prev.filter((d) => d.id !== doctor.id))
    setAllUsers((prev) => prev.map((u) => u.id === doctor.id ? { ...u, doctor_status: 'approved' as const } : u))
    showToast(`✅ ${doctor.full_name ?? doctor.email} aprobado exitosamente`)
    setProcessingId(null)
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    const doctor = rejectTarget; setProcessingId(doctor.id); setRejectTarget(null)
    await supabase.from('profiles').update({ doctor_status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: rejectReason.trim() || null }).eq('id', doctor.id)
    try { await supabase.functions.invoke('send-email', { body: { to: doctor.email, subject: 'Tu solicitud en Contigo', html: `<p>Hola Dr(a). ${doctor.full_name},</p><p>Hemos revisado tu solicitud y lamentablemente no podemos aprobarla en este momento.</p>${rejectReason.trim() ? `<p><strong>Motivo:</strong> ${rejectReason.trim()}</p>` : ''}<br/><p>Para más información escríbenos a <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p><br/><p>El equipo de Contigo</p>` } }) } catch { /* non-critical */ }
    setPendingDoctors((prev) => prev.filter((d) => d.id !== doctor.id))
    setAllUsers((prev) => prev.map((u) => u.id === doctor.id ? { ...u, doctor_status: 'rejected' as const } : u))
    showToast('Solicitud rechazada'); setRejectReason(''); setProcessingId(null)
  }

  async function handleAppApprove(app: PatientApplication) {
    setAppProcessingId(app.id)
    const now = new Date().toISOString()
    await supabase.from('patient_applications').update({ status: 'approved', reviewed_at: now, reviewed_by: adminProfile?.id ?? null }).eq('id', app.id)
    await supabase.from('profiles').update({ application_status: 'approved' }).eq('id', app.patient_id)
    try { await supabase.functions.invoke('send-email', { body: { to: app.patient?.email, subject: '✅ ¡Tu aplicación fue aprobada! — Contigo', html: `<p>¡Bienvenido/a ${app.patient?.full_name ?? ''}! Tu aplicación ha sido aprobada.</p><p>Ya puedes acceder a todos los beneficios de Contigo.</p><br/><p><a href="https://contigomedicina.com/login" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Ingresar →</a></p><br/><p>El equipo de Contigo</p>` } }) } catch { /* non-critical */ }
    setApplications((prev) => prev.map((a) => a.id === app.id ? { ...a, status: 'approved' as const } : a))
    showToast('✅ Paciente aprobado'); setAppProcessingId(null)
  }

  async function handleAppRejectConfirm() {
    if (!appRejectTarget) return
    const app = appRejectTarget; setAppProcessingId(app.id); setAppRejectTarget(null)
    const now = new Date().toISOString()
    const reapplyAfter = new Date(); reapplyAfter.setMonth(reapplyAfter.getMonth() + 6)
    const reapplyStr = reapplyAfter.toISOString().slice(0, 10)
    await supabase.from('patient_applications').update({ status: 'rejected', reviewed_at: now, reviewed_by: adminProfile?.id ?? null, admin_note: appRejectNote.trim() || null, reapply_after: reapplyStr }).eq('id', app.id)
    await supabase.from('profiles').update({ application_status: 'rejected' }).eq('id', app.patient_id)
    try {
      const reapplyFormatted = reapplyAfter.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
      await supabase.functions.invoke('send-email', { body: { to: app.patient?.email, subject: 'Tu aplicación en Contigo', html: `<p>Hola ${app.patient?.full_name ?? ''},</p><p>Hemos revisado tu aplicación y en este momento no podemos ofrecerte el plan actual de Contigo.</p><p>Podrás volver a aplicar a partir del <strong>${reapplyFormatted}</strong>.</p><br/><p>¿Tienes preguntas? <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p><br/><p>El equipo de Contigo</p>` } })
    } catch { /* non-critical */ }
    setApplications((prev) => prev.map((a) => a.id === app.id ? { ...a, status: 'rejected' as const } : a))
    showToast('Aplicación rechazada'); setAppRejectNote(''); setAppProcessingId(null)
  }

  async function handleSaveRulebook() {
    if (!rbVersionName.trim()) { showToast('Por favor indica el nombre de la versión'); return }
    setRbSaving(true)
    await supabase.from('underwriting_rulebooks').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const nextVersion = (rulebooks[0]?.version ?? 0) + 1
    const { data: newRb } = await supabase.from('underwriting_rulebooks').insert({ version: nextVersion, name: rbVersionName.trim(), is_active: true, cost_per_consultation_usd: rbCostConsult, cost_per_medication_usd: rbCostMed, cost_per_exam_usd: rbCostExam, monthly_income_usd: rbIncome, threshold_review: rbThresholdReview, threshold_reject: rbThresholdReject, ai_instructions: rbInstructions, created_by: adminProfile?.id ?? null }).select().single()
    await fetchRulebooks()
    if (newRb) setSimRulebookId((newRb as UnderwritingRulebook).id)
    showToast(`✅ Versión "${rbVersionName.trim()}" guardada y activada`); setRbSaving(false)
  }

  async function handleActivateRulebook(rb: UnderwritingRulebook) {
    await supabase.from('underwriting_rulebooks').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('underwriting_rulebooks').update({ is_active: true }).eq('id', rb.id)
    await fetchRulebooks(); showToast(`Versión "${rb.name}" activada`)
  }

  async function handleSimulate() {
    setSimRunning(true); setSimResult(null)
    try {
      const { data } = await supabase.functions.invoke('underwrite-patient', { body: { questionnaire: { age: simAge ? parseInt(simAge) : undefined, biological_sex: simSex || undefined, conditions: simConditions, hospitalized_last_12m: simHospitalized ?? false, active_treatment: simTreatment ?? false, regular_medications: simMeds ?? false, smoking_status: simSmoking || undefined, has_eps: simEps ?? false }, rulebook_id: simRulebookId || undefined, simulate: true } })
      setSimResult(data)
    } catch (err) { showToast('Error al ejecutar la simulación'); console.error(err) }
    finally { setSimRunning(false) }
  }

  async function handleUploadChatFile(files: FileList | null) {
    if (!files || files.length === 0) return
    const allowed = ['pdf', 'docx', 'txt']
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!allowed.includes(ext)) { showToast(`Tipo no soportado: ${file.name}`); continue }
      if (file.size > 10 * 1024 * 1024) { showToast(`Archivo demasiado grande: ${file.name}`); continue }
      setChatUploading(true)
      const pathId = crypto.randomUUID()
      const storagePath = `${pathId}/${file.name}`
      const { error: upErr } = await supabase.storage.from('chat-documents').upload(storagePath, file)
      if (upErr) { showToast(`Error al subir ${file.name}`); setChatUploading(false); continue }
      const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
      const { data: docData, error: insErr } = await supabase.from('chat_documents').insert({ name: file.name.replace(/\.[^.]+$/, ''), file_url: storagePath, file_name: file.name, file_type: ext, file_size: fmt(file.size), status: 'processing', uploaded_by: adminProfile?.id ?? null }).select().single()
      if (insErr || !docData) { showToast(`Error al registrar ${file.name}`); setChatUploading(false); continue }
      supabase.functions.invoke('process-document', { body: { document_id: (docData as { id: string }).id } }).catch(() => {})
      setTimeout(fetchChatDocuments, 4000)
      setChatUploading(false); showToast(`${file.name} subido, procesando...`); fetchChatDocuments()
    }
  }

  async function handleDeleteChatDocument(docId: string) {
    const doc = (chatDocuments as { id: string; file_url?: string }[]).find((d) => d.id === docId)
    if (doc?.file_url) await supabase.storage.from('chat-documents').remove([doc.file_url])
    await supabase.from('chat_documents').delete().eq('id', docId)
    setChatDeleteTarget(null); fetchChatDocuments(); showToast('Documento eliminado')
  }

  async function handleSaveChatPrompt() {
    if (!chatPrompt.trim()) return; setChatPromptSaving(true)
    const cfg = chatConfig as { id?: string } | null
    if (cfg?.id) { await supabase.from('chat_config').update({ system_prompt: chatPrompt.trim(), updated_by: adminProfile?.id ?? null, updated_at: new Date().toISOString() }).eq('id', cfg.id) }
    else { await supabase.from('chat_config').insert({ system_prompt: chatPrompt.trim(), is_active: true, updated_by: adminProfile?.id ?? null }) }
    await fetchChatConfig(); setChatPromptSaving(false); showToast('✅ Prompt guardado')
  }

  function handleResetChatPrompt() {
    setChatPrompt(`Eres un asistente de Contigo, una plataforma de salud colombiana. Tu rol es responder preguntas sobre el plan de salud de Contigo basándote ÚNICAMENTE en los documentos proporcionados.\n\nREGLAS:\n- Solo responde sobre lo que está en los documentos\n- Si no sabes algo, di "No tengo información sobre eso en este momento. Te recomiendo hablar con un asesor."\n- Nunca inventes información sobre precios, coberturas o condiciones que no estén en los documentos\n- Sé amable, conciso y profesional\n- Responde en el mismo idioma que usa el usuario\n- Máximo 3 párrafos por respuesta\n- No discutas temas fuera del plan de Contigo`)
    showToast('Prompt restablecido. Guarda para aplicar.')
  }

  async function handleChatSimSend() {
    const text = chatSimInput.trim(); if (!text || chatSimLoading) return
    const msgId = Date.now().toString()
    setChatSimMsgs(prev => [...prev, { role: 'user', content: text, id: msgId }]); setChatSimInput(''); setChatSimLoading(true)
    const prevHistory = [...chatSimHistoryRef.current]
    try {
      const { data, error } = await supabase.functions.invoke('chat', { body: { message: text, conversation_history: prevHistory.slice(-10), ...(chatSimUseCustom ? { custom_system_prompt: chatPrompt } : {}) } })
      if (error || !(data as { reply?: string })?.reply) throw new Error('No response')
      const reply = (data as { reply: string }).reply
      setChatSimMsgs(prev => [...prev, { role: 'assistant', content: reply, id: (Date.now() + 1).toString() }])
      chatSimHistoryRef.current = [...prevHistory, { role: 'user', content: text }, { role: 'assistant', content: reply }]
    } catch { setChatSimMsgs(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente.', id: (Date.now() + 1).toString() }]) }
    finally { setChatSimLoading(false) }
  }

  function exportChatLeadsCSV() {
    const rows = (chatLeads as { name?: string; email?: string; phone?: string; created_at: string }[]).map((l) => [`"${(l.name ?? '').replace(/"/g, '""')}"`, `"${(l.email ?? '').replace(/"/g, '""')}"`, `"${(l.phone ?? '').replace(/"/g, '""')}"`, `"${new Date(l.created_at).toLocaleDateString('es-CO')}"`].join(','))
    const csv = ['Nombre,Email,Teléfono,Fecha', ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'leads_chat.csv'; a.click(); URL.revokeObjectURL(url)
  }

  async function handleLabApprove(lab: { id: string; name: string; email: string }) {
    setLabProcessingId(lab.id)
    await supabase.rpc('admin_approve_lab', { p_id: lab.id })
    try { await supabase.functions.invoke('send-email', { body: { to: lab.email, subject: '✅ Tu centro ha sido aprobado — Contigo', html: `<p>¡Bienvenido a Contigo! Tu centro <strong>${lab.name}</strong> ha sido aprobado.</p><p>Ya puedes acceder al portal: <a href="https://contigomedicina.com/lab/login">contigomedicina.com/lab/login</a></p>` } }) } catch { /* non-critical */ }
    showToast(`✅ ${lab.name} aprobado exitosamente`); setLabProcessingId(null); fetchLabs()
  }

  async function handleLabRejectConfirm() {
    const lab = labRejectTarget as { id: string; name: string; email: string } | null
    if (!lab) return
    setLabProcessingId(lab.id); setLabRejectTarget(null)
    await supabase.rpc('admin_reject_lab', { p_id: lab.id, p_reason: labRejectReason.trim() || null })
    try { await supabase.functions.invoke('send-email', { body: { to: lab.email, subject: 'Tu solicitud en Contigo', html: `<p>Hola, lamentablemente no pudimos aprobar tu centro.</p>${labRejectReason.trim() ? `<p><strong>Motivo:</strong> ${labRejectReason.trim()}</p>` : ''}<p>Escríbenos a <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p>` } }) } catch { /* non-critical */ }
    showToast('Solicitud de lab rechazada'); setLabRejectReason(''); setLabProcessingId(null); fetchLabs()
  }

  async function handleCancel(id: string) {
    setCancelling(id); setError(null)
    const { error: err } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    if (err) setError('No se pudo cancelar la cita. Intenta de nuevo.'); else await fetchAll()
    setCancelling(null)
  }

  async function handleRoleChange() {
    if (!confirmTarget) return
    const { user, newRole } = confirmTarget
    if (newRole === 'admin' && confirmInput !== 'CONFIRMAR') return
    setRoleChanging(user.id)
    const { error: err } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (err) { setError('No se pudo cambiar el rol. Intenta de nuevo.') }
    else { setAllUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u)); showToast(`Rol de ${user.full_name ?? user.email} cambiado a ${ROLE_LABELS[newRole]}.`) }
    setRoleChanging(null); setConfirmTarget(null); setConfirmInput('')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const ratingsByDoctor: Record<string, number[]> = {}
  ;(feedbacks as { doctor_id: string; rating: number }[]).forEach((f) => {
    if (!ratingsByDoctor[f.doctor_id]) ratingsByDoctor[f.doctor_id] = []
    ratingsByDoctor[f.doctor_id].push(f.rating)
  })
  const doctorAvgMap: Record<string, number> = {}
  Object.entries(ratingsByDoctor).forEach(([id, ratings]) => { doctorAvgMap[id] = ratings.reduce((a, b) => a + b, 0) / ratings.length })
  const avgRating = (feedbacks as { rating: number }[]).length
    ? (feedbacks as { rating: number }[]).reduce((sum, f) => sum + f.rating, 0) / (feedbacks as { rating: number }[]).length
    : 0

  const pendingPatientCount = applications.filter((a) => a.status === 'pending').length
  const pendingDoctorCount  = pendingDoctors.length

  async function handleSignOut() { await signOut(); navigate('/login', { replace: true }) }

  if (!adminProfile) return <Navigate to="/login" replace />

  // ── Context value ───────────────────────────────────────────────────────────
  const ctxValue = {
    adminProfile, allUsers, appointments, loading, cancelling, error,
    feedbacks, diagOrders, referralStats, avgRating, doctorAvgMap,
    monthlyApprovedPatients, apptsBySpecialty, doctorRatingsTable,
    pendingDoctors, rejectTarget, setRejectTarget, rejectReason, setRejectReason, processingId,
    handleApprove, handleRejectConfirm,
    allLabs, labRejectTarget, setLabRejectTarget, labRejectReason, setLabRejectReason,
    labProcessingId, labDetail, setLabDetail, handleLabApprove, handleLabRejectConfirm,
    applications, questionnaires, appProcessingId, appRejectTarget, setAppRejectTarget,
    appRejectNote, setAppRejectNote, expandedQuestions, setExpandedQuestions,
    historyFilter, setHistoryFilter, historySearch, setHistorySearch,
    handleAppApprove, handleAppRejectConfirm,
    rulebooks, uwTab, setUwTab, rbCostConsult, setRbCostConsult, rbCostMed, setRbCostMed,
    rbCostExam, setRbCostExam, rbIncome, setRbIncome, rbThresholdReview, setRbThresholdReview,
    rbThresholdReject, setRbThresholdReject, rbInstructions, setRbInstructions,
    rbVersionName, setRbVersionName, rbSaving, rbCompare, setRbCompare,
    handleSaveRulebook, handleActivateRulebook,
    simAge, setSimAge, simSex, setSimSex, simConditions, setSimConditions,
    simHospitalized, setSimHospitalized, simTreatment, setSimTreatment,
    simMeds, setSimMeds, simSmoking, setSimSmoking, simEps, setSimEps,
    simRulebookId, setSimRulebookId, simRunning, simResult, handleSimulate,
    chatDocuments, chatConfig, chatLeads, chatSubTab, setChatSubTab,
    chatPrompt, setChatPrompt, chatPromptSaving, chatUploading,
    chatDeleteTarget, setChatDeleteTarget, chatLeadDetail, setChatLeadDetail,
    chatSimMsgs, chatSimInput, setChatSimInput, chatSimLoading,
    chatSimUseCustom, setChatSimUseCustom,
    handleUploadChatFile, handleDeleteChatDocument, handleSaveChatPrompt,
    handleResetChatPrompt, handleChatSimSend, exportChatLeadsCSV,
    userSearch, setUserSearch, userRoleFilter, setUserRoleFilter,
    roleChanging, confirmTarget, setConfirmTarget, confirmInput, setConfirmInput,
    detailUser, setDetailUser, detailApptCount, handleRoleChange,
    handleCancel, toast, showToast,
  }

  return (
    <AdminContext.Provider value={ctxValue}>
      <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>

        <Sidebar
          pendingPatients={pendingPatientCount}
          pendingDoctors={pendingDoctorCount}
          email={adminProfile.email}
          onSignOut={handleSignOut}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Offset for fixed sidebar on desktop */}
        <div className="flex-1 lg:ml-[220px] flex flex-col min-h-screen">
          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-20">
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Abrir menú">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-slate-800 text-sm">Panel de administración</span>
            {(pendingPatientCount + pendingDoctorCount) > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingPatientCount + pendingDoctorCount}
              </span>
            )}
          </div>

          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── Modals ── */}

      {confirmTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3"><div className="text-2xl">⚠️</div><div><h2 className="text-lg font-bold text-slate-900">Cambiar rol</h2><p className="text-sm text-slate-600 mt-1">¿Cambiar el rol de <strong>{confirmTarget.user.full_name ?? confirmTarget.user.email}</strong> a <strong>{ROLE_LABELS[confirmTarget.newRole]}</strong>?</p></div></div>
            {confirmTarget.newRole === 'admin' && (<div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3"><p className="text-sm font-semibold text-red-700">Advertencia: estás a punto de otorgar permisos de administrador completos a este usuario.</p><p className="text-xs text-red-600">Escribe <strong>CONFIRMAR</strong> para continuar:</p><input type="text" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} placeholder="CONFIRMAR" className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>)}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setConfirmTarget(null); setConfirmInput('') }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleRoleChange} disabled={roleChanging === confirmTarget.user.id || (confirmTarget.newRole === 'admin' && confirmInput !== 'CONFIRMAR')} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{roleChanging === confirmTarget.user.id ? 'Cambiando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {(labRejectTarget as { name?: string } | null)?.name && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3"><div className="text-2xl">🚫</div><div><h2 className="text-lg font-bold text-slate-900">Rechazar centro</h2><p className="text-sm text-slate-600 mt-1">¿Rechazar <strong>{(labRejectTarget as { name: string }).name}</strong>?</p></div></div>
            <div className="space-y-2"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo (opcional)</label><textarea value={labRejectReason} onChange={(e) => setLabRejectReason(e.target.value)} placeholder="Ej: Documentos ilegibles..." rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" /></div>
            <div className="flex gap-3 pt-1"><button onClick={() => { setLabRejectTarget(null); setLabRejectReason('') }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button onClick={handleLabRejectConfirm} disabled={labProcessingId === (labRejectTarget as { id: string }).id} className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Rechazar</button></div>
          </div>
        </div>
      )}

      {(labDetail as { name?: string } | null)?.name && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setLabDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{(labDetail as { name: string }).name}</h2><button onClick={() => setLabDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button></div>
            <div className="space-y-2 text-sm">
              {[{ label: 'Tipo', value: (labDetail as { type: string }).type === 'laboratorio' ? 'Laboratorio' : (labDetail as { type: string }).type === 'imagenes' ? 'Imágenes' : 'Ambos' }, { label: 'Ciudad', value: (labDetail as { city?: string }).city }, { label: 'Teléfono', value: (labDetail as { phone?: string }).phone }, { label: 'Email', value: (labDetail as { email?: string }).email }, { label: 'Exámenes', value: (labDetail as { exam_count?: number }).exam_count }, { label: 'Completados', value: (labDetail as { completed_count?: number }).completed_count }].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-1 border-b border-slate-100 last:border-0"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800 text-right">{value ?? '—'}</span></div>
              ))}
            </div>
            {((labDetail as { camara_comercio_url?: string; habilitacion_supersalud_url?: string; rut_url?: string }).camara_comercio_url || (labDetail as { habilitacion_supersalud_url?: string }).habilitacion_supersalud_url || (labDetail as { rut_url?: string }).rut_url) && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(labDetail as { camara_comercio_url?: string }).camara_comercio_url && <a href={(labDetail as { camara_comercio_url: string }).camara_comercio_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">📄 Cámara de Comercio</a>}
                {(labDetail as { habilitacion_supersalud_url?: string }).habilitacion_supersalud_url && <a href={(labDetail as { habilitacion_supersalud_url: string }).habilitacion_supersalud_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">📄 Habilitación</a>}
                {(labDetail as { rut_url?: string }).rut_url && <a href={(labDetail as { rut_url: string }).rut_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">📄 RUT</a>}
              </div>
            )}
          </div>
        </div>
      )}

      {appRejectTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3"><div className="text-2xl">🚫</div><div><h2 className="text-lg font-bold text-slate-900">Rechazar aplicación</h2><p className="text-sm text-slate-600 mt-1">¿Rechazar la aplicación de <strong>{appRejectTarget.patient?.full_name ?? appRejectTarget.patient?.email}</strong>?</p><p className="text-xs text-slate-400 mt-1">Podrá volver a aplicar en 6 meses.</p></div></div>
            <div className="space-y-2"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota interna (opcional)</label><textarea value={appRejectNote} onChange={(e) => setAppRejectNote(e.target.value)} placeholder="Ej: Alto riesgo por múltiples condiciones crónicas..." rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" /></div>
            <div className="flex gap-3 pt-1"><button onClick={() => { setAppRejectTarget(null); setAppRejectNote('') }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button onClick={handleAppRejectConfirm} disabled={appProcessingId === appRejectTarget.id} className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Rechazar</button></div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3"><div className="text-2xl">🚫</div><div><h2 className="text-lg font-bold text-slate-900">Rechazar solicitud</h2><p className="text-sm text-slate-600 mt-1">¿Rechazar la solicitud de <strong>{rejectTarget.full_name ?? rejectTarget.email}</strong>?</p></div></div>
            <div className="space-y-2"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo del rechazo (opcional)</label><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ej: La tarjeta profesional no es legible..." rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" /></div>
            <div className="flex gap-3 pt-1"><button onClick={() => { setRejectTarget(null); setRejectReason('') }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button onClick={handleRejectConfirm} disabled={processingId === rejectTarget.id} className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{processingId === rejectTarget.id ? 'Rechazando...' : 'Rechazar'}</button></div>
          </div>
        </div>
      )}

      {detailUser && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetailUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Detalle del usuario</h2><button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button></div>
            <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-blue-700 text-xl font-bold">{initials(detailUser.full_name, detailUser.email)}</span></div><div><p className="font-bold text-slate-900 text-base">{detailUser.full_name ?? '—'}</p><p className="text-slate-500 text-sm">{detailUser.email ?? '—'}</p><span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_COLORS[detailUser.role]}`}>{ROLE_LABELS[detailUser.role]}</span></div></div>
            <div className="border-t border-slate-100" />
            <div className="space-y-2.5 text-sm">
              {[{ label: 'Teléfono', value: detailUser.phone }, { label: 'Ciudad', value: detailUser.city }, { label: 'Fecha de nacimiento', value: detailUser.birth_date ? formatDate(detailUser.birth_date) : null }, { label: 'Registro', value: formatDate(detailUser.created_at.slice(0, 10)) }, ...(detailUser.role === 'doctor' ? [{ label: 'Especialidad', value: specialtyLabel(detailUser.specialty) }, { label: 'Universidad', value: detailUser.undergraduate_university }, { label: 'Posgrado', value: detailUser.postgraduate_specialty }] : [])].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4"><span className="text-slate-400 font-medium">{label}</span><span className="text-slate-800 text-right">{value ?? '—'}</span></div>
              ))}
              <div className="flex justify-between gap-4"><span className="text-slate-400 font-medium">Citas</span><span className="text-slate-800">{detailApptCount === null ? '...' : detailApptCount}</span></div>
            </div>
          </div>
        </div>
      )}

    </AdminContext.Provider>
  )
}

// Re-export helpers needed by section files
export { formatDate, formatTime, initials, ROLE_LABELS, ROLE_COLORS, SPECIALTY_LABELS }
