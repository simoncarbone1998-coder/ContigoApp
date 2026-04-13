import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, Appointment, PatientApplication, UnderwritingRulebook } from '../../lib/types'
import type { Role } from '../../lib/types'
import { specialtyLabel } from '../../lib/types'

const SPECIALTY_LABELS_ADMIN: Record<string, string> = {
  medicina_general: 'Med. General',
  pediatria:        'Pediatría',
  cardiologia:      'Cardiología',
  dermatologia:     'Dermatología',
  ginecologia:      'Ginecología',
  ortopedia:        'Ortopedia',
  psicologia:       'Psicología',
}

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

const ROLE_LABELS: Record<Role, string> = { patient: 'Paciente', doctor: 'Médico', admin: 'Admin', laboratory: 'Laboratorio' }
const ROLE_COLORS: Record<Role, string> = {
  patient:    'bg-blue-50 text-blue-700 border-blue-200',
  doctor:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  admin:      'bg-red-50 text-red-700 border-red-200',
  laboratory: 'bg-violet-50 text-violet-700 border-violet-200',
}

type Tab = 'appointments' | 'users' | 'ratings' | 'exams' | 'laboratories' | 'applications' | 'underwriting'

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
  const [referralStats, setReferralStats] = useState<{ monthCount: number; topSpecialty: string | null }>({ monthCount: 0, topSpecialty: null })

  // Pending doctors
  const [pendingDoctors, setPendingDoctors] = useState<Profile[]>([])
  const [rejectTarget,   setRejectTarget]   = useState<Profile | null>(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [processingId,   setProcessingId]   = useState<string | null>(null)

  // Labs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allLabs,         setAllLabs]         = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [labRejectTarget, setLabRejectTarget] = useState<any | null>(null)
  const [labRejectReason, setLabRejectReason] = useState('')
  const [labProcessingId, setLabProcessingId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [labDetail,       setLabDetail]       = useState<any | null>(null)

  // Applications state
  const [applications,       setApplications]       = useState<PatientApplication[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questionnaires,     setQuestionnaires]     = useState<Record<string, any>>({})
  const [appProcessingId,    setAppProcessingId]    = useState<string | null>(null)
  const [appRejectTarget,    setAppRejectTarget]    = useState<PatientApplication | null>(null)
  const [appRejectNote,      setAppRejectNote]      = useState('')
  const [expandedQuestions,  setExpandedQuestions]  = useState<Record<string, boolean>>({})
  const [historyFilter,      setHistoryFilter]      = useState<'all' | 'approved' | 'rejected'>('all')
  const [historySearch,      setHistorySearch]      = useState('')

  // Underwriting state
  const [rulebooks,          setRulebooks]          = useState<UnderwritingRulebook[]>([])
  const [uwTab,              setUwTab]              = useState<'config' | 'simulator' | 'history'>('config')
  const [rbCostConsult,      setRbCostConsult]      = useState(40)
  const [rbCostMed,          setRbCostMed]          = useState(8)
  const [rbCostExam,         setRbCostExam]         = useState(12)
  const [rbIncome,           setRbIncome]           = useState(19)
  const [rbThresholdReview,  setRbThresholdReview]  = useState(1.0)
  const [rbThresholdReject,  setRbThresholdReject]  = useState(2.0)
  const [rbInstructions,     setRbInstructions]     = useState('')
  const [rbVersionName,      setRbVersionName]      = useState('')
  const [rbSaving,           setRbSaving]           = useState(false)
  const [rbCompare,          setRbCompare]          = useState<string | null>(null)
  // Simulator state
  const [simAge,             setSimAge]             = useState('')
  const [simSex,             setSimSex]             = useState('')
  const [simConditions,      setSimConditions]      = useState<string[]>([])
  const [simHospitalized,    setSimHospitalized]    = useState<boolean | null>(null)
  const [simTreatment,       setSimTreatment]       = useState<boolean | null>(null)
  const [simMeds,            setSimMeds]            = useState<boolean | null>(null)
  const [simSmoking,         setSimSmoking]         = useState('')
  const [simEps,             setSimEps]             = useState<boolean | null>(null)
  const [simRulebookId,      setSimRulebookId]      = useState('')
  const [simRunning,         setSimRunning]         = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [simResult,          setSimResult]          = useState<any | null>(null)

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
    // Fetch questionnaires for those patients
    if (data && data.length > 0) {
      const patientIds = data.map((a: PatientApplication) => a.patient_id)
      const { data: qs } = await supabase
        .from('health_questionnaire')
        .select('*')
        .in('patient_id', patientIds)
      const qMap: Record<string, unknown> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(qs ?? []).forEach((q: any) => { qMap[q.patient_id] = q })
      setQuestionnaires(qMap)
    }
  }, [])

  const fetchRulebooks = useCallback(async () => {
    const { data } = await supabase
      .from('underwriting_rulebooks')
      .select('*')
      .order('version', { ascending: false })
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

  async function handleLabApprove(lab: { id: string; name: string; email: string }) {
    setLabProcessingId(lab.id)
    await supabase.rpc('admin_approve_lab', { p_id: lab.id })
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: lab.email,
          subject: '✅ Tu centro ha sido aprobado — Contigo',
          html: `<p>¡Bienvenido a Contigo! Tu centro <strong>${lab.name}</strong> ha sido aprobado.</p><p>Ya puedes acceder al portal: <a href="https://contigomedicina.com/lab/login">contigomedicina.com/lab/login</a></p>`,
        },
      })
    } catch { /* non-critical */ }
    showToast(`✅ ${lab.name} aprobado exitosamente`)
    setLabProcessingId(null)
    fetchLabs()
  }

  async function handleLabRejectConfirm() {
    if (!labRejectTarget) return
    const lab = labRejectTarget
    setLabProcessingId(lab.id)
    setLabRejectTarget(null)
    await supabase.rpc('admin_reject_lab', { p_id: lab.id, p_reason: labRejectReason.trim() || null })
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: lab.email,
          subject: 'Tu solicitud en Contigo',
          html: `<p>Hola, lamentablemente no pudimos aprobar tu centro.</p>${labRejectReason.trim() ? `<p><strong>Motivo:</strong> ${labRejectReason.trim()}</p>` : ''}<p>Escríbenos a <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p>`,
        },
      })
    } catch { /* non-critical */ }
    showToast('Solicitud de lab rechazada')
    setLabRejectReason('')
    setLabProcessingId(null)
    fetchLabs()
  }

  useEffect(() => { fetchPending(); fetchLabs(); fetchApplications(); fetchRulebooks() }, [fetchPending, fetchLabs, fetchApplications, fetchRulebooks])

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

  // ── Application approve ──────────────────────────────────────────────────
  async function handleAppApprove(app: PatientApplication) {
    setAppProcessingId(app.id)
    const now = new Date().toISOString()
    await supabase.from('patient_applications').update({ status: 'approved', reviewed_at: now, reviewed_by: adminProfile?.id ?? null }).eq('id', app.id)
    await supabase.from('profiles').update({ application_status: 'approved' }).eq('id', app.patient_id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: app.patient?.email,
          subject: '✅ ¡Tu aplicación fue aprobada! — Contigo',
          html: `
            <p>¡Bienvenido/a ${app.patient?.full_name ?? ''}! Tu aplicación ha sido aprobada.</p>
            <p>Ya puedes acceder a todos los beneficios de Contigo.</p>
            <br/>
            <p><a href="https://contigomedicina.com/login" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Ingresar →</a></p>
            <br/>
            <p>El equipo de Contigo</p>
          `,
        },
      })
    } catch { /* non-critical */ }
    setApplications((prev) => prev.map((a) => a.id === app.id ? { ...a, status: 'approved' as const } : a))
    showToast('✅ Paciente aprobado')
    setAppProcessingId(null)
  }

  // ── Application reject ───────────────────────────────────────────────────
  async function handleAppRejectConfirm() {
    if (!appRejectTarget) return
    const app = appRejectTarget
    setAppProcessingId(app.id)
    setAppRejectTarget(null)
    const now = new Date().toISOString()
    const reapplyAfter = new Date()
    reapplyAfter.setMonth(reapplyAfter.getMonth() + 6)
    const reapplyStr = reapplyAfter.toISOString().slice(0, 10)
    await supabase.from('patient_applications').update({
      status: 'rejected', reviewed_at: now, reviewed_by: adminProfile?.id ?? null,
      admin_note: appRejectNote.trim() || null, reapply_after: reapplyStr,
    }).eq('id', app.id)
    await supabase.from('profiles').update({ application_status: 'rejected' }).eq('id', app.patient_id)
    try {
      const reapplyFormatted = reapplyAfter.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
      await supabase.functions.invoke('send-email', {
        body: {
          to: app.patient?.email,
          subject: 'Tu aplicación en Contigo',
          html: `
            <p>Hola ${app.patient?.full_name ?? ''},</p>
            <p>Hemos revisado tu aplicación y en este momento no podemos ofrecerte el plan actual de Contigo.</p>
            <p>Podrás volver a aplicar a partir del <strong>${reapplyFormatted}</strong>.</p>
            <br/>
            <p>¿Tienes preguntas? <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p>
            <br/>
            <p>El equipo de Contigo</p>
          `,
        },
      })
    } catch { /* non-critical */ }
    setApplications((prev) => prev.map((a) => a.id === app.id ? { ...a, status: 'rejected' as const } : a))
    showToast('Aplicación rechazada')
    setAppRejectNote('')
    setAppProcessingId(null)
  }

  // ── Save new rulebook version ─────────────────────────────────────────────
  async function handleSaveRulebook() {
    if (!rbVersionName.trim()) { showToast('Por favor indica el nombre de la versión'); return }
    setRbSaving(true)
    // Deactivate all existing
    await supabase.from('underwriting_rulebooks').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const nextVersion = (rulebooks[0]?.version ?? 0) + 1
    const { data: newRb } = await supabase.from('underwriting_rulebooks').insert({
      version: nextVersion,
      name: rbVersionName.trim(),
      is_active: true,
      cost_per_consultation_usd: rbCostConsult,
      cost_per_medication_usd: rbCostMed,
      cost_per_exam_usd: rbCostExam,
      monthly_income_usd: rbIncome,
      threshold_review: rbThresholdReview,
      threshold_reject: rbThresholdReject,
      ai_instructions: rbInstructions,
      created_by: adminProfile?.id ?? null,
    }).select().single()
    await fetchRulebooks()
    if (newRb) setSimRulebookId((newRb as UnderwritingRulebook).id)
    showToast(`✅ Versión "${rbVersionName.trim()}" guardada y activada`)
    setRbSaving(false)
  }

  // ── Activate a rulebook version ──────────────────────────────────────────
  async function handleActivateRulebook(rb: UnderwritingRulebook) {
    await supabase.from('underwriting_rulebooks').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('underwriting_rulebooks').update({ is_active: true }).eq('id', rb.id)
    await fetchRulebooks()
    showToast(`Versión "${rb.name}" activada`)
  }

  // ── Run simulator ────────────────────────────────────────────────────────
  async function handleSimulate() {
    setSimRunning(true)
    setSimResult(null)
    try {
      const { data } = await supabase.functions.invoke('underwrite-patient', {
        body: {
          questionnaire: {
            age: simAge ? parseInt(simAge) : undefined,
            biological_sex: simSex || undefined,
            conditions: simConditions,
            hospitalized_last_12m: simHospitalized ?? false,
            active_treatment: simTreatment ?? false,
            regular_medications: simMeds ?? false,
            smoking_status: simSmoking || undefined,
            has_eps: simEps ?? false,
          },
          rulebook_id: simRulebookId || undefined,
          simulate: true,
        },
      })
      setSimResult(data)
    } catch (err) {
      showToast('Error al ejecutar la simulación')
      console.error(err)
    } finally {
      setSimRunning(false)
    }
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

    // Fetch referral stats
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const { data: monthRefs } = await supabase
      .from('specialist_referrals')
      .select('specialty')
      .gte('created_at', startOfMonth.toISOString())
    if (monthRefs) {
      const specCount: Record<string, number> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      monthRefs.forEach((r: any) => { specCount[r.specialty] = (specCount[r.specialty] ?? 0) + 1 })
      const top = Object.entries(specCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      setReferralStats({ monthCount: monthRefs.length, topSpecialty: top })
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
    { label: 'Referencias este mes', value: referralStats.monthCount, bg: 'bg-amber-50', text: 'text-amber-700', icon: '📋' },
    {
      label: 'Especialidad más referida',
      value: referralStats.topSpecialty ? (SPECIALTY_LABELS_ADMIN[referralStats.topSpecialty] ?? referralStats.topSpecialty) : '—',
      bg: 'bg-pink-50', text: 'text-pink-700', icon: '🏥',
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

  const pendingApps = applications.filter((a) => a.status === 'pending')

  const tabs: { key: Tab; label: string; count: number; badge?: boolean }[] = [
    { key: 'applications', label: 'Aplicaciones',    count: pendingApps.length, badge: pendingApps.length > 0 },
    { key: 'appointments', label: 'Citas',           count: appointments.length },
    { key: 'users',        label: 'Usuarios',         count: allUsers.length },
    { key: 'ratings',      label: 'Calificaciones',   count: feedbacks.length },
    { key: 'exams',        label: 'Exámenes',         count: diagOrders.length },
    { key: 'laboratories', label: 'Laboratorios',     count: allLabs.length },
    { key: 'underwriting', label: 'Underwriting',     count: rulebooks.length },
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

      {/* Lab reject modal */}
      {labRejectTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🚫</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rechazar centro</h2>
                <p className="text-sm text-slate-600 mt-1">¿Rechazar <strong>{labRejectTarget.name}</strong>?</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo (opcional)</label>
              <textarea value={labRejectReason} onChange={(e) => setLabRejectReason(e.target.value)}
                placeholder="Ej: Documentos ilegibles..." rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setLabRejectTarget(null); setLabRejectReason('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleLabRejectConfirm} disabled={labProcessingId === labRejectTarget.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lab detail modal */}
      {labDetail && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setLabDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{labDetail.name}</h2>
              <button onClick={() => setLabDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Tipo',     value: labDetail.type === 'laboratorio' ? 'Laboratorio' : labDetail.type === 'imagenes' ? 'Imágenes' : 'Ambos' },
                { label: 'Ciudad',   value: labDetail.city },
                { label: 'Teléfono',value: labDetail.phone },
                { label: 'Email',    value: labDetail.email },
                { label: 'Exámenes',value: labDetail.exam_count },
                { label: 'Completados', value: labDetail.completed_count },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 text-right">{value ?? '—'}</span>
                </div>
              ))}
            </div>
            {/* Document links */}
            {(labDetail.camara_comercio_url || labDetail.habilitacion_supersalud_url || labDetail.rut_url) && (
              <div className="flex flex-wrap gap-2 pt-2">
                {labDetail.camara_comercio_url && (
                  <a href={labDetail.camara_comercio_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                    📄 Cámara de Comercio
                  </a>
                )}
                {labDetail.habilitacion_supersalud_url && (
                  <a href={labDetail.habilitacion_supersalud_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                    📄 Habilitación
                  </a>
                )}
                {labDetail.rut_url && (
                  <a href={labDetail.rut_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                    📄 RUT
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Application reject modal */}
      {appRejectTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🚫</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rechazar aplicación</h2>
                <p className="text-sm text-slate-600 mt-1">
                  ¿Rechazar la aplicación de <strong>{appRejectTarget.patient?.full_name ?? appRejectTarget.patient?.email}</strong>?
                </p>
                <p className="text-xs text-slate-400 mt-1">Podrá volver a aplicar en 6 meses.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota interna (opcional)</label>
              <textarea value={appRejectNote} onChange={(e) => setAppRejectNote(e.target.value)}
                placeholder="Ej: Alto riesgo por múltiples condiciones crónicas..." rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setAppRejectTarget(null); setAppRejectNote('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleAppRejectConfirm} disabled={appProcessingId === appRejectTarget.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                Rechazar
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
          <div className="flex flex-wrap border-b border-slate-100 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  tab === t.key
                    ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {t.label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  t.badge
                    ? 'bg-red-500 text-white'
                    : tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
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
            ) : tab === 'applications' ? (
              <ApplicationsSection
                applications={applications}
                questionnaires={questionnaires}
                processingId={appProcessingId}
                expandedQuestions={expandedQuestions}
                onToggleQuestions={(id) => setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }))}
                historyFilter={historyFilter}
                onHistoryFilterChange={setHistoryFilter}
                historySearch={historySearch}
                onHistorySearchChange={setHistorySearch}
                onApprove={handleAppApprove}
                onReject={(app) => { setAppRejectTarget(app); setAppRejectNote('') }}
              />
            ) : tab === 'underwriting' ? (
              <UnderwritingSection
                rulebooks={rulebooks}
                uwTab={uwTab}
                onUwTabChange={setUwTab}
                rbCostConsult={rbCostConsult} onRbCostConsultChange={setRbCostConsult}
                rbCostMed={rbCostMed} onRbCostMedChange={setRbCostMed}
                rbCostExam={rbCostExam} onRbCostExamChange={setRbCostExam}
                rbIncome={rbIncome} onRbIncomeChange={setRbIncome}
                rbThresholdReview={rbThresholdReview} onRbThresholdReviewChange={setRbThresholdReview}
                rbThresholdReject={rbThresholdReject} onRbThresholdRejectChange={setRbThresholdReject}
                rbInstructions={rbInstructions} onRbInstructionsChange={setRbInstructions}
                rbVersionName={rbVersionName} onRbVersionNameChange={setRbVersionName}
                rbSaving={rbSaving} onSaveRulebook={handleSaveRulebook}
                rbCompare={rbCompare} onRbCompareChange={setRbCompare}
                onActivateRulebook={handleActivateRulebook}
                simAge={simAge} onSimAgeChange={setSimAge}
                simSex={simSex} onSimSexChange={setSimSex}
                simConditions={simConditions} onSimConditionsChange={setSimConditions}
                simHospitalized={simHospitalized} onSimHospitalizedChange={setSimHospitalized}
                simTreatment={simTreatment} onSimTreatmentChange={setSimTreatment}
                simMeds={simMeds} onSimMedsChange={setSimMeds}
                simSmoking={simSmoking} onSimSmokingChange={setSimSmoking}
                simEps={simEps} onSimEpsChange={setSimEps}
                simRulebookId={simRulebookId} onSimRulebookIdChange={setSimRulebookId}
                simRunning={simRunning} onSimulate={handleSimulate}
                simResult={simResult}
              />
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
            ) : tab === 'laboratories' ? (
              allLabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="text-4xl mb-3">🔬</span>
                  <p className="text-sm font-medium">No hay laboratorios registrados aún.</p>
                </div>
              ) : (
                <LabsSection
                  labs={allLabs}
                  processingId={labProcessingId}
                  onApprove={handleLabApprove}
                  onReject={(lab) => { setLabRejectTarget(lab); setLabRejectReason('') }}
                  onDetail={setLabDetail}
                />
              )
            ) : (
              <AppointmentsTable appointments={appointments} cancelling={cancelling} onCancel={handleCancel} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'hace menos de 1 hora'
  if (diffH < 24) return `hace ${diffH} hora${diffH > 1 ? 's' : ''}`
  const diffD = Math.floor(diffH / 24)
  return `hace ${diffD} día${diffD > 1 ? 's' : ''}`
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function hoursRemaining(iso: string): string {
  const deadlineMs = new Date(iso).getTime() + 48 * 3600000
  const remaining = deadlineMs - Date.now()
  if (remaining <= 0) return '¡Vencida!'
  const h = Math.floor(remaining / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h restantes`
  return `${h}h restantes`
}

function RatioBadge({ ratio, threshReview, threshReject }: { ratio: number; threshReview: number; threshReject: number }) {
  const cls = ratio <= threshReview
    ? 'bg-green-100 text-green-700'
    : ratio <= threshReject
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{ratio.toFixed(2)}x</span>
}

function RecoBadge({ rec }: { rec: string }) {
  const map: Record<string, string> = { approve: 'bg-green-100 text-green-700', review: 'bg-amber-100 text-amber-700', reject: 'bg-red-100 text-red-700' }
  const label: Record<string, string> = { approve: 'APROBAR', review: 'REVISAR', reject: 'RECHAZAR' }
  return <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${map[rec] ?? 'bg-slate-100 text-slate-600'}`}>{label[rec] ?? rec.toUpperCase()}</span>
}

function ScenarioIcon({ viable }: { viable: boolean }) {
  return viable
    ? <span className="text-green-600 font-bold">✅</span>
    : <span className="text-red-500 font-bold">❌</span>
}

const CONDITIONS_LIST = [
  'Diabetes', 'Hipertensión arterial', 'Enfermedad cardíaca o coronaria',
  'Cáncer activo o en tratamiento', 'Enfermedad renal crónica',
  'Enfermedad pulmonar crónica (EPOC, asma severa)',
  'Enfermedad autoinmune (lupus, artritis reumatoide)', 'VIH/SIDA',
]

// ── Applications Section ─────────────────────────────────────────────────────

function ApplicationsSection({
  applications, questionnaires, processingId, expandedQuestions, onToggleQuestions,
  historyFilter, onHistoryFilterChange, historySearch, onHistorySearchChange,
  onApprove, onReject,
}: {
  applications: PatientApplication[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questionnaires: Record<string, any>
  processingId: string | null
  expandedQuestions: Record<string, boolean>
  onToggleQuestions: (id: string) => void
  historyFilter: 'all' | 'approved' | 'rejected'
  onHistoryFilterChange: (v: 'all' | 'approved' | 'rejected') => void
  historySearch: string
  onHistorySearchChange: (v: string) => void
  onApprove: (app: PatientApplication) => void
  onReject: (app: PatientApplication) => void
}) {
  const [appTab, setAppTab] = useState<'pending' | 'history'>('pending')
  const pending  = applications.filter((a) => a.status === 'pending')
  const reviewed = applications.filter((a) => a.status !== 'pending')

  const filteredHistory = reviewed.filter((a) => {
    const matchStatus = historyFilter === 'all' || a.status === historyFilter
    const q = historySearch.toLowerCase()
    const matchSearch = !q
      || (a.patient?.full_name ?? '').toLowerCase().includes(q)
      || (a.patient?.email ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-3">
        <button onClick={() => setAppTab('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${appTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Pendientes
          {pending.length > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setAppTab('history')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${appTab === 'history' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Historial ({reviewed.length})
        </button>
      </div>

      {appTab === 'pending' ? (
        pending.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <span className="text-4xl mb-3">✅</span>
            <p className="text-sm font-medium">No hay aplicaciones pendientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pending.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                questionnaire={questionnaires[app.patient_id]}
                processingId={processingId}
                expanded={expandedQuestions[app.id] ?? false}
                onToggleExpand={() => onToggleQuestions(app.id)}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={historySearch} onChange={(e) => onHistorySearchChange(e.target.value)}
                placeholder="Buscar por nombre o correo..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <select value={historyFilter} onChange={(e) => onHistoryFilterChange(e.target.value as 'all' | 'approved' | 'rejected')}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Todos</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No hay aplicaciones que coincidan.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Paciente', 'Fecha', 'Rec. IA', 'Ratio', 'Decisión', 'Nota'].map((h) => (
                      <th key={h} className="text-left py-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((app) => (
                    <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-slate-900">{app.patient?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{app.patient?.email}</p>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-500 whitespace-nowrap text-xs">{new Date(app.submitted_at).toLocaleDateString('es-CO')}</td>
                      <td className="py-3.5 pr-4">{app.ai_recommendation ? <RecoBadge rec={app.ai_recommendation} /> : '—'}</td>
                      <td className="py-3.5 pr-4">{app.ai_ratio != null ? `${app.ai_ratio.toFixed(2)}x` : '—'}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {app.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500 text-xs max-w-[200px] truncate">{app.admin_note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ApplicationCard({
  app, questionnaire, processingId, expanded, onToggleExpand, onApprove, onReject
}: {
  app: PatientApplication
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questionnaire: any
  processingId: string | null
  expanded: boolean
  onToggleExpand: () => void
  onApprove: (app: PatientApplication) => void
  onReject: (app: PatientApplication) => void
}) {
  const age = questionnaire ? calcAge(questionnaire.date_of_birth) : null
  const threshReview = 1.0
  const threshReject = 2.0

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-slate-900 text-base">
              {app.patient?.full_name ?? '—'}{age != null ? `, ${age} años` : ''}
              {app.patient?.city ? ` — ${app.patient.city}` : ''}
            </p>
            <p className="text-sm text-slate-500">{app.patient?.email}</p>
            <p className="text-xs text-slate-400 mt-1">{timeAgo(app.submitted_at)} · {hoursRemaining(app.submitted_at)}</p>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">🤖 Análisis actuarial IA</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Recomendación</p>
            {app.ai_recommendation ? <RecoBadge rec={app.ai_recommendation} /> : <span className="text-slate-400 text-xs">—</span>}
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Probabilidad alto costo</p>
            <p className="font-bold text-slate-800">{app.ai_score != null ? `${app.ai_score}%` : '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Costo esperado trim.</p>
            <p className="font-bold text-slate-800">{app.ai_cost_expected_usd != null ? `$${app.ai_cost_expected_usd} USD` : '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Ratio costo/ingreso</p>
            {app.ai_ratio != null
              ? <RatioBadge ratio={app.ai_ratio} threshReview={threshReview} threshReject={threshReject} />
              : <span className="text-slate-400 text-xs">—</span>}
          </div>
        </div>

        {/* Drivers */}
        {app.ai_drivers && app.ai_drivers.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Drivers principales</p>
            <ul className="space-y-1">
              {app.ai_drivers.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="text-slate-400">•</span>
                  <span><strong>{d.factor}</strong> — +${d.impact_usd} USD · {d.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sensitivity table */}
        {app.ai_sensitivity?.scenarios && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Análisis de sensibilidad</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {['Escenario', 'Costo', 'Ratio'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {app.ai_sensitivity.scenarios.map((sc, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{sc.name}</td>
                      <td className="px-3 py-2 font-medium">${sc.cost_usd}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1">
                          {sc.ratio.toFixed(2)}x <ScenarioIcon viable={sc.viable} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reasoning */}
        {app.ai_reasoning && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Razonamiento IA</p>
            <p className="text-xs text-blue-800 leading-relaxed">{app.ai_reasoning}</p>
          </div>
        )}

        {app.rulebook && (
          <p className="text-xs text-slate-400">Rulebook: {app.rulebook.name}</p>
        )}
      </div>

      {/* Health questionnaire (expandable) */}
      {questionnaire && (
        <div className="border-b border-slate-100">
          <button onClick={onToggleExpand}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <span>Ver datos del paciente</span>
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && (
            <div className="px-6 pb-4 grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Fecha de nacimiento', value: questionnaire.date_of_birth },
                { label: 'Sexo biológico', value: questionnaire.biological_sex },
                { label: 'Condiciones', value: (questionnaire.conditions ?? []).join(', ') || 'Ninguna' },
                { label: 'Hospitalizado 12m', value: questionnaire.hospitalized_last_12m ? `Sí${questionnaire.hospitalization_reason ? `: ${questionnaire.hospitalization_reason}` : ''}` : 'No' },
                { label: 'Tratamiento activo', value: questionnaire.active_treatment ? 'Sí' : 'No' },
                { label: 'Medicamentos regulares', value: questionnaire.regular_medications ? `Sí${questionnaire.medications_detail ? `: ${questionnaire.medications_detail}` : ''}` : 'No' },
                { label: 'Tabaquismo', value: questionnaire.smoking_status },
                { label: 'EPS activa', value: questionnaire.has_eps ? 'Sí' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 font-medium mb-0.5">{label}</p>
                  <p className="text-slate-700">{value ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 flex gap-3">
        <button onClick={() => onApprove(app)} disabled={processingId === app.id}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
          {processingId === app.id ? '...' : '✅ Aprobar'}
        </button>
        <button onClick={() => onReject(app)} disabled={processingId === app.id}
          className="flex-1 py-2.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold transition-colors disabled:opacity-50">
          ❌ Rechazar
        </button>
      </div>
    </div>
  )
}

// ── Underwriting Section ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UnderwritingSection(props: any) {
  const {
    rulebooks, uwTab, onUwTabChange,
    rbCostConsult, onRbCostConsultChange,
    rbCostMed, onRbCostMedChange,
    rbCostExam, onRbCostExamChange,
    rbIncome, onRbIncomeChange,
    rbThresholdReview, onRbThresholdReviewChange,
    rbThresholdReject, onRbThresholdRejectChange,
    rbInstructions, onRbInstructionsChange,
    rbVersionName, onRbVersionNameChange,
    rbSaving, onSaveRulebook,
    rbCompare, onRbCompareChange,
    onActivateRulebook,
    simAge, onSimAgeChange,
    simSex, onSimSexChange,
    simConditions, onSimConditionsChange,
    simHospitalized, onSimHospitalizedChange,
    simTreatment, onSimTreatmentChange,
    simMeds, onSimMedsChange,
    simSmoking, onSimSmokingChange,
    simEps, onSimEpsChange,
    simRulebookId, onSimRulebookIdChange,
    simRunning, onSimulate,
    simResult,
  } = props

  const activeRulebook = rulebooks.find((r: UnderwritingRulebook) => r.is_active)
  const incomeInput = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  function toggleSimCondition(cond: string) {
    onSimConditionsChange((prev: string[]) =>
      prev.includes(cond) ? prev.filter((c: string) => c !== cond) : [...prev, cond]
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap border-b border-slate-100 pb-3">
        {[['config', 'Configuración activa'], ['simulator', 'Simulador'], ['history', 'Historial de versiones']].map(([key, label]) => (
          <button key={key} onClick={() => onUwTabChange(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${uwTab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {key === 'simulator' ? '🧪 ' : key === 'history' ? '📋 ' : '⚙️ '}{label}
          </button>
        ))}
      </div>

      {/* TAB: Config */}
      {uwTab === 'config' && (
        <div className="space-y-6 max-w-2xl">
          {activeRulebook && (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-blue-700 font-semibold">
              Versión activa: {activeRulebook.name}
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Modelo de costos (USD)</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Costo por consulta', value: rbCostConsult, onChange: onRbCostConsultChange },
                { label: 'Costo por medicamentos', value: rbCostMed, onChange: onRbCostMedChange },
                { label: 'Costo por examen', value: rbCostExam, onChange: onRbCostExamChange },
                { label: 'Ingreso mensual', value: rbIncome, onChange: onRbIncomeChange },
              ].map(({ label, value, onChange }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                      className={incomeInput + ' pl-7'} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Umbrales de decisión</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ratio para revisión manual</label>
                <input type="number" step="0.1" value={rbThresholdReview} onChange={(e) => onRbThresholdReviewChange(parseFloat(e.target.value) || 0)} className={incomeInput} />
                <p className="text-xs text-slate-400 mt-1">Si costo esperado {'>'} Xx el ingreso → revisar</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ratio para rechazo</label>
                <input type="number" step="0.1" value={rbThresholdReject} onChange={(e) => onRbThresholdRejectChange(parseFloat(e.target.value) || 0)} className={incomeInput} />
                <p className="text-xs text-slate-400 mt-1">Si costo esperado {'>'} Xx el ingreso → rechazar</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Instrucciones para la IA</label>
            <textarea value={rbInstructions} onChange={(e) => onRbInstructionsChange(e.target.value)}
              rows={8} className={incomeInput + ' resize-y'}
              placeholder="Escribe en lenguaje natural cómo quieres que la IA evalúe el riesgo..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre de esta versión</label>
            <input type="text" value={rbVersionName} onChange={(e) => onRbVersionNameChange(e.target.value)}
              placeholder='Ej: "v2 - Ajuste julio 2026"' className={incomeInput} />
          </div>

          <button onClick={onSaveRulebook} disabled={rbSaving}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
            {rbSaving ? 'Guardando...' : '💾 Guardar como nueva versión'}
          </button>
        </div>
      )}

      {/* TAB: Simulator */}
      {uwTab === 'simulator' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <h3 className="font-bold text-slate-800">Perfil del paciente</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Edad</label>
              <input type="number" value={simAge} onChange={(e) => onSimAgeChange(e.target.value)}
                placeholder="ej: 45" className={incomeInput} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Sexo biológico</label>
              <div className="flex gap-2 flex-wrap">
                {[['masculino', 'Masculino'], ['femenino', 'Femenino'], ['otro', 'Otro']].map(([v, l]) => (
                  <label key={v} className={`px-3 py-2 rounded-xl border-2 cursor-pointer text-sm transition-colors ${simSex === v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="simSex" value={v} checked={simSex === v} onChange={() => onSimSexChange(v)} className="sr-only" />{l}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Condiciones médicas</label>
              <div className="space-y-1.5">
                {CONDITIONS_LIST.map((cond) => (
                  <label key={cond} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer text-xs transition-colors ${simConditions.includes(cond) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={simConditions.includes(cond)} onChange={() => toggleSimCondition(cond)} className="w-3.5 h-3.5 text-blue-600 rounded" />
                    <span>{cond}</span>
                  </label>
                ))}
              </div>
            </div>

            {[
              { label: 'Hospitalizado en últimos 12m', value: simHospitalized, onChange: onSimHospitalizedChange, name: 'simHosp' },
              { label: 'Tratamiento médico activo', value: simTreatment, onChange: onSimTreatmentChange, name: 'simTreat' },
              { label: 'Medicamentos regulares', value: simMeds, onChange: onSimMedsChange, name: 'simMeds' },
              { label: 'EPS activa', value: simEps, onChange: onSimEpsChange, name: 'simEps' },
            ].map(({ label, value, onChange, name }) => (
              <div key={name}>
                <label className="block text-xs font-semibold text-slate-500 mb-2">{label}</label>
                <div className="flex gap-2">
                  {[['true', 'Sí'], ['false', 'No']].map(([v, l]) => (
                    <label key={v} className={`px-3 py-2 rounded-xl border-2 cursor-pointer text-sm transition-colors ${String(value) === v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600'}`}>
                      <input type="radio" name={name} checked={String(value) === v} onChange={() => onChange(v === 'true')} className="sr-only" />{l}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Tabaquismo</label>
              <div className="grid grid-cols-2 gap-2">
                {[['no_fumo', 'No fumo'], ['exfumador', 'Exfumador'], ['ocasional', 'Ocasional'], ['regular', 'Regular']].map(([v, l]) => (
                  <label key={v} className={`p-2.5 rounded-xl border-2 cursor-pointer text-xs text-center transition-colors ${simSmoking === v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="simSmoking" checked={simSmoking === v} onChange={() => onSimSmokingChange(v)} className="sr-only" />{l}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Evaluar con rulebook</label>
              <select value={simRulebookId} onChange={(e) => onSimRulebookIdChange(e.target.value)} className={incomeInput}>
                {rulebooks.map((rb: UnderwritingRulebook) => (
                  <option key={rb.id} value={rb.id}>{rb.name}{rb.is_active ? ' (activo)' : ''}</option>
                ))}
              </select>
            </div>

            <button onClick={onSimulate} disabled={simRunning}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {simRunning ? (
                <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Evaluando...</>
              ) : '🤖 Evaluar con IA →'}
            </button>
          </div>

          {/* Results panel */}
          <div>
            {simResult ? (
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Resultado de simulación</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Recomendación</p>
                    <RecoBadge rec={simResult.recommendation} />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Probabilidad alto costo</p>
                    <p className="font-bold text-slate-800">{Math.round((simResult.probability_high_cost ?? 0) * 100)}%</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Costo esperado</p>
                    <p className="font-bold text-slate-800">${simResult.cost_breakdown?.total_expected_cost_usd ?? '—'} USD</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Ratio</p>
                    {simResult.ratio != null
                      ? <RatioBadge ratio={simResult.ratio} threshReview={1.0} threshReject={2.0} />
                      : <span className="text-slate-400 text-xs">—</span>}
                  </div>
                </div>

                {simResult.cost_breakdown && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Desglose de costos</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li>• Consultas: <strong>${simResult.cost_breakdown.consultations_cost}</strong> ({simResult.cost_breakdown.consultations_per_quarter}/trimestre)</li>
                      <li>• Medicamentos: <strong>${simResult.cost_breakdown.medications_cost}</strong> ({simResult.cost_breakdown.medications_per_month}/mes)</li>
                      <li>• Exámenes: <strong>${simResult.cost_breakdown.exams_cost}</strong> ({simResult.cost_breakdown.exams_per_quarter}/trimestre)</li>
                    </ul>
                  </div>
                )}

                {simResult.sensitivity_analysis?.scenarios && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Análisis de sensibilidad</p>
                    <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-500">Escenario</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-500">Costo</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-500">Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.sensitivity_analysis.scenarios.map((sc: { name: string; cost_usd: number; ratio: number; viable: boolean }, i: number) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2">{sc.name}</td>
                            <td className="px-3 py-2 font-medium">${sc.cost_usd}</td>
                            <td className="px-3 py-2"><span className="flex items-center gap-1">{sc.ratio.toFixed(2)}x <ScenarioIcon viable={sc.viable} /></span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {simResult.sensitivity_analysis.breakeven_ratio_explanation && (
                      <p className="text-xs text-slate-500 mt-2 italic">{simResult.sensitivity_analysis.breakeven_ratio_explanation}</p>
                    )}
                  </div>
                )}

                {simResult.reasoning && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Razonamiento completo</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{simResult.reasoning}</p>
                  </div>
                )}

                {simResult.rulebook && (
                  <p className="text-xs text-slate-400">Rulebook usado: {simResult.rulebook.name}</p>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                <p className="text-3xl mb-3">🤖</p>
                <p className="text-sm font-medium">Completa el perfil y haz clic en "Evaluar con IA" para ver el resultado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: History */}
      {uwTab === 'history' && (
        <div className="space-y-4">
          {rulebooks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No hay versiones de rulebook.</div>
          ) : (
            <>
              {rbCompare && (
                <RulebookCompare
                  active={rulebooks.find((r: UnderwritingRulebook) => r.is_active)!}
                  other={rulebooks.find((r: UnderwritingRulebook) => r.id === rbCompare)!}
                  onClose={() => onRbCompareChange(null)}
                />
              )}
              <div className="space-y-3">
                {rulebooks.map((rb: UnderwritingRulebook) => (
                  <div key={rb.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900">{rb.name}</p>
                        {rb.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Activa</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        v{rb.version} · Creada el {new Date(rb.created_at).toLocaleDateString('es-CO')} ·
                        Consulta: ${rb.cost_per_consultation_usd} · Umbrales: {rb.threshold_review}x / {rb.threshold_reject}x
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!rb.is_active && (
                        <>
                          <button onClick={() => onActivateRulebook(rb)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
                            Activar
                          </button>
                          <button onClick={() => onRbCompareChange(rb.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-colors">
                            Comparar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RulebookCompare({ active, other, onClose }: { active: UnderwritingRulebook; other: UnderwritingRulebook; onClose: () => void }) {
  if (!active || !other) return null
  const fields: { label: string; key: keyof UnderwritingRulebook }[] = [
    { label: 'Costo consulta', key: 'cost_per_consultation_usd' },
    { label: 'Costo medicamentos', key: 'cost_per_medication_usd' },
    { label: 'Costo examen', key: 'cost_per_exam_usd' },
    { label: 'Ingreso mensual', key: 'monthly_income_usd' },
    { label: 'Umbral revisión', key: 'threshold_review' },
    { label: 'Umbral rechazo', key: 'threshold_reject' },
  ]
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-slate-800 text-sm">Comparación de versiones</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-amber-200">
              <th className="text-left py-2 pr-4 font-semibold text-slate-500">Parámetro</th>
              <th className="text-left py-2 pr-4 font-semibold text-slate-500">{active.name} (Activa)</th>
              <th className="text-left py-2 font-semibold text-slate-500">{other.name}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(({ label, key }) => {
              const aVal = active[key]
              const bVal = other[key]
              const changed = aVal !== bVal
              return (
                <tr key={key} className={`border-b border-amber-100 ${changed ? 'bg-yellow-100' : ''}`}>
                  <td className="py-2 pr-4 text-slate-600 font-medium">{label}</td>
                  <td className="py-2 pr-4 text-slate-800">{String(aVal)}</td>
                  <td className="py-2 text-slate-800">{String(bVal)}{changed ? ' ←' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

const LAB_TYPE_LABELS: Record<string, string> = {
  laboratorio: 'Laboratorio clínico',
  imagenes:    'Imágenes diagnósticas',
  ambos:       'Lab + Imágenes',
}
const LAB_STATUS_COLORS: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}
const LAB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LabsSection({ labs, processingId, onApprove, onReject, onDetail }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labs: any[]
  processingId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApprove: (lab: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReject: (lab: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDetail: (lab: any) => void
}) {
  const pending  = labs.filter((l) => l.status === 'pending')
  const approved = labs.filter((l) => l.status === 'approved')

  return (
    <div className="space-y-4">
      {/* Pending labs */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-teal-100 bg-teal-50">
            <span className="text-lg">🔬</span>
            <h2 className="text-base font-bold text-slate-900">Centros aliados pendientes de aprobación</h2>
            <span className="bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map((lab) => (
              <div key={lab.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-semibold text-slate-900">{lab.name}</p>
                  <p className="text-sm text-slate-500">{lab.email} · {lab.city}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{LAB_TYPE_LABELS[lab.type] ?? lab.type}</p>
                  {/* Exams */}
                  {lab.exams && lab.exams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {lab.exams.slice(0, 5).map((e: { exam_name: string }) => (
                        <span key={e.exam_name} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{e.exam_name}</span>
                      ))}
                      {lab.exams.length > 5 && <span className="text-xs text-slate-400">+{lab.exams.length - 5} más</span>}
                    </div>
                  )}
                  {/* Document links */}
                  <div className="flex gap-2 mt-2">
                    {lab.camara_comercio_url && (
                      <a href={lab.camara_comercio_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50">Cámara de Comercio</a>
                    )}
                    {lab.habilitacion_supersalud_url && (
                      <a href={lab.habilitacion_supersalud_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50">Habilitación</a>
                    )}
                    {lab.rut_url && (
                      <a href={lab.rut_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50">RUT</a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onApprove(lab)} disabled={processingId === lab.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {processingId === lab.id ? '...' : 'Aprobar'}
                  </button>
                  <button onClick={() => onReject(lab)} disabled={processingId === lab.id}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active labs */}
      {approved.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Centros activos ({approved.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Centro', 'Tipo', 'Ciudad', 'Exámenes', 'Completados', 'Estado', ''].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approved.map((lab) => (
                  <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{lab.name}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">{LAB_TYPE_LABELS[lab.type] ?? lab.type}</td>
                    <td className="py-3.5 px-4 text-slate-500">{lab.city ?? '—'}</td>
                    <td className="py-3.5 px-4 text-slate-700">{lab.exam_count}</td>
                    <td className="py-3.5 px-4 text-slate-700">{lab.completed_count}</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${LAB_STATUS_COLORS[lab.status]}`}>
                        {LAB_STATUS_LABELS[lab.status]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button onClick={() => onDetail(lab)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors font-medium">
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
