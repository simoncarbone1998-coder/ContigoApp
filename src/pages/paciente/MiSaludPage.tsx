import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import PatientVideoCall from '../../components/PatientVideoCall'
import FeedbackModal from '../../components/FeedbackModal'
import { specialtyLabel } from '../../lib/types'
import { useTranslation } from 'react-i18next'
import type { Appointment, AvailabilitySlot, Specialty } from '../../lib/types'
import { createDailyRoom, createDailyToken } from '../../services/dailyService'

// ── Constants ─────────────────────────────────────────────────────────────────

const SPECIALTY_ICONS: Record<string, string> = {
  medicina_general: '🩺',
  pediatria:        '👶',
  cardiologia:      '❤️',
  dermatologia:     '🔬',
  ginecologia:      '🌸',
  ortopedia:        '🦴',
  psicologia:       '🧠',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesUntil(slotDate: string, slotStartTime: string): number {
  return (new Date(`${slotDate}T${slotStartTime}`).getTime() - Date.now()) / 60000
}
function formatDate(d: string) { const [y,m,day]=d.split('-'); return `${day}/${m}/${y}` }
function formatTime(t: string) { return t.slice(0, 5) }
function formatTimeAMPM(t: string): string {
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, '0')} ${ampm}`
}
function docInitials(name: string | null | undefined): string {
  return (name ?? 'D').trim().split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'D'
}

function useDateFormatters() {
  const { t } = useTranslation()
  const daysLong  = t('days.long',   { returnObjects: true }) as string[]
  const monthsLong = t('months.long', { returnObjects: true }) as string[]
  const monthsShort = t('months.short', { returnObjects: true }) as string[]

  function formatDateLong(d: string): string {
    const [y, m, day] = d.split('-').map(Number)
    const date = new Date(y, m - 1, day)
    return `${daysLong[date.getDay()]} ${day} de ${monthsLong[m - 1]}`
  }
  function formatDateMedium(d: string): string {
    const [y, m, day] = d.split('-').map(Number)
    const date = new Date(y, m - 1, day)
    return `${daysLong[date.getDay()]} ${day} ${monthsShort[m - 1]}`
  }
  return { formatDateLong, formatDateMedium }
}

// ── Email helpers (fire-and-forget) ─────────────────────────────────────────

function emailWrap(body: string) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:28px 32px;"><p style="margin:0;color:#fff;font-size:24px;font-weight:700;">contigo</p><p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Plataforma de Salud · Colombia</p></td></tr><tr><td style="background:#fff;padding:32px;">${body}</td></tr><tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 Contigo</p></td></tr></table></td></tr></table></body></html>`
}

function detailCard(rows: [string, string][]) {
  const trs = rows.map(([label, val]) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">${label}</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${val}</td></tr>`
  ).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin:20px 0;border:1px solid #e2e8f0;">${trs}</table>`
}

async function sendConfirmationEmails(opts: {
  patientEmail: string; patientName: string
  doctorEmail?: string | null; doctorName: string; specialty: string
  fecha: string; hora: string; reason: string | null
}) {
  try {
    const card = detailCard([['📅 Fecha', opts.fecha],['⏰ Hora', opts.hora],['👨‍⚕️ Doctor', `Dr(a). ${opts.doctorName}`],['🏥 Especialidad', opts.specialty],['📝 Motivo', opts.reason || 'No especificado']])
    const jobs: Promise<unknown>[] = [
      supabase.functions.invoke('send-email', {
        body: { to: opts.patientEmail, subject: '✅ Tu cita médica está confirmada — Contigo',
          html: emailWrap(`<p style="margin:0 0 6px;color:#16a34a;font-size:22px;font-weight:700;">✅ Cita confirmada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${opts.patientName},</p>${card}<p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`) },
      }),
    ]
    if (opts.doctorEmail) {
      jobs.push(supabase.functions.invoke('send-email', {
        body: { to: opts.doctorEmail, subject: `📅 Nueva cita — ${opts.patientName}`,
          html: emailWrap(`<p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Nueva cita agendada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola Dr(a). ${opts.doctorName},</p>${card}<p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`) },
      }))
    }
    await Promise.all(jobs)
  } catch (err) { console.error('email error (non-blocking):', err) }
}

function sendRescheduleEmails(opts: {
  patientEmail: string; patientName: string
  doctorEmail?: string | null; doctorName: string
  specialty: string; fecha: string; hora: string
}) {
  const card = detailCard([['📅 Fecha', opts.fecha],['⏰ Hora', opts.hora],['🏥 Especialidad', opts.specialty]])
  const jobs: Promise<unknown>[] = [
    supabase.functions.invoke('send-email', {
      body: { to: opts.patientEmail, subject: '📅 Tu cita ha sido reprogramada — Contigo',
        html: emailWrap(`<p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Cita reprogramada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola ${opts.patientName},</p>${card}<p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`) },
    }),
  ]
  if (opts.doctorEmail) {
    jobs.push(supabase.functions.invoke('send-email', {
      body: { to: opts.doctorEmail, subject: `📅 Cita reprogramada — ${opts.patientName}`,
        html: emailWrap(`<p style="margin:0 0 6px;color:#1e3a5f;font-size:22px;font-weight:700;">📅 Cita reprogramada</p><p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hola Dr(a). ${opts.doctorName},</p>${card}<p style="margin:0;color:#94a3b8;font-size:13px;">El equipo de Contigo</p>`) },
    }))
  }
  Promise.all(jobs).catch(err => console.error('reschedule email error:', err))
}

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Referral = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reminder = any
type FbRecord = { rating: number; comment: string | null }

// ── Main Component ────────────────────────────────────────────────────────────

export default function MiSaludPage() {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const { formatDateLong, formatDateMedium } = useDateFormatters()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [upcomingAppts,     setUpcomingAppts]     = useState<Appointment[]>([])
  const [activeReferrals,   setActiveReferrals]   = useState<Referral[]>([])
  const [followUpReminders, setFollowUpReminders] = useState<Reminder[]>([])
  const [pastAppts,         setPastAppts]         = useState<Appointment[]>([])
  const [feedbacks,         setFeedbacks]         = useState<Record<string, FbRecord>>({})
  const [loading,           setLoading]           = useState(true)

  // ── Video ─────────────────────────────────────────────────────────────────
  const [videoAppt,    setVideoAppt]    = useState<Appointment | null>(null)
  const [videoToken,   setVideoToken]   = useState<string | null>(null)
  const [joiningVideo, setJoiningVideo] = useState(false)
  const [videoError,   setVideoError]   = useState<string | null>(null)

  // ── Cancel ────────────────────────────────────────────────────────────────
  const [cancelAppt,    setCancelAppt]    = useState<Appointment | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling,    setCancelling]    = useState(false)
  const [cancelError,   setCancelError]   = useState<string | null>(null)

  // ── Reschedule ───────────────────────────────────────────────────────────
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null)
  const [rscSlots,         setRscSlots]         = useState<AvailabilitySlot[]>([])
  const [rscLoading,       setRscLoading]       = useState(false)
  const [rscDate,          setRscDate]          = useState<string | null>(null)
  const [rscSlot,          setRscSlot]          = useState<AvailabilitySlot | null>(null)
  const [rscStep,          setRscStep]          = useState<'picker' | 'confirming'>('picker')
  const [rscSaving,        setRscSaving]        = useState(false)
  const [rscError,         setRscError]         = useState<string | null>(null)

  // ── Booking modal ─────────────────────────────────────────────────────────
  const [bookingOpen,        setBookingOpen]        = useState(false)
  const [bookingSpecialty,   setBookingSpecialty]   = useState<Specialty | ''>('')
  const [bookingFromReferral,setBookingFromReferral]= useState<Referral | null>(null)
  const [bookingSlots,       setBookingSlots]       = useState<AvailabilitySlot[]>([])
  const [bookingSlotsLoading,setBookingSlotsLoading]= useState(false)
  const [bookingSlot,        setBookingSlot]        = useState<AvailabilitySlot | null>(null)
  const [bookingStep,        setBookingStep]        = useState<1 | 2>(1)
  const [bookingReason,      setBookingReason]      = useState('')
  const [preFiles,           setPreFiles]           = useState<File[]>([])
  const preFileRef = useRef<HTMLInputElement>(null)
  const [bookingSubmitting,  setBookingSubmitting]  = useState(false)
  const [bookingError,       setBookingError]       = useState<string | null>(null)

  // ── History expand ────────────────────────────────────────────────────────
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedDiag,   setExpandedDiag]   = useState<Record<string, { orders: any[]; files: any[] }>>({})

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [feedbackAppt,  setFeedbackAppt]  = useState<Appointment | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const nowMs = Date.now()

    const [upR, refR, remR, pastR] = await Promise.all([
      supabase.from('appointments')
        .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url), slot:slot_id(*)')
        .eq('patient_id', profile.id)
        .eq('status', 'confirmed')
        .eq('completed', false),
      supabase.from('specialist_referrals')
        .select('*, referring_doctor:referring_doctor_id(full_name)')
        .eq('patient_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('follow_up_reminders')
        .select('*, doctor:doctor_id(full_name)')
        .eq('patient_id', profile.id)
        .eq('status', 'notified')
        .order('reminder_date', { ascending: true }),
      supabase.from('appointments')
        .select('*, doctor:doctor_id(id, full_name, email, specialty, avatar_url), slot:slot_id(*), prescriptions(id, prescription_items(medicine_name, dose, instructions))')
        .eq('patient_id', profile.id)
        .eq('completed', true)
        .eq('status', 'confirmed')
        .order('completed_at', { ascending: false }),
    ])

    // Upcoming: only future slots, sorted asc
    const upcoming = ((upR.data ?? []) as Appointment[])
      .filter(a => a.slot?.date != null && new Date(`${a.slot.date}T${a.slot.start_time}`).getTime() > nowMs)
      .sort((a, b) => {
        const da = `${a.slot!.date}T${a.slot!.start_time}`
        const db = `${b.slot!.date}T${b.slot!.start_time}`
        return da.localeCompare(db)
      })
    setUpcomingAppts(upcoming)
    setActiveReferrals(refR.data ?? [])
    setFollowUpReminders(remR.data ?? [])

    const past = (pastR.data ?? []) as Appointment[]
    setPastAppts(past)

    // Fetch feedbacks for past appts
    const apptIds = past.map(a => a.id)
    if (apptIds.length > 0) {
      const { data: fbs } = await supabase
        .from('appointment_feedback')
        .select('appointment_id, rating, comment')
        .in('appointment_id', apptIds)
      const fbMap: Record<string, FbRecord> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fbs ?? []).forEach((f: any) => { fbMap[f.appointment_id] = { rating: f.rating, comment: f.comment } })
      setFeedbacks(fbMap)
    }

    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-create Daily rooms for appointments within 10 minutes
  useEffect(() => {
    if (upcomingAppts.length === 0) return
    for (const appt of upcomingAppts) {
      if (!appt.slot || appt.daily_room_url) continue
      const mins = minutesUntil(appt.slot.date, appt.slot.start_time)
      if (mins <= 10 && mins > -60) {
        createDailyRoom(appt.id)
          .then(({ name, url }) =>
            supabase.from('appointments').update({
              daily_room_name: name, daily_room_url: url,
              room_created_at: new Date().toISOString(),
            }).eq('id', appt.id)
          )
          .then(() => fetchData())
          .catch(() => { /* silently skip */ })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingAppts])

  // ── Video ─────────────────────────────────────────────────────────────────

  async function handleJoinVideo(appt: Appointment) {
    if (!appt.slot) return
    setJoiningVideo(true)
    setVideoError(null)
    try {
      let roomName = appt.daily_room_name
      let roomUrl  = appt.daily_room_url
      if (!roomUrl) {
        const room = await createDailyRoom(appt.id)
        roomName = room.name; roomUrl = room.url
        await supabase.from('appointments').update({
          daily_room_name: roomName, daily_room_url: roomUrl,
          room_created_at: new Date().toISOString(),
        }).eq('id', appt.id)
      }
      const token = await createDailyToken(roomName!, false)
      setVideoAppt({ ...appt, daily_room_url: roomUrl, daily_room_name: roomName })
      setVideoToken(token)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : t('patient.miSalud.video.cannotCreate'))
    }
    setJoiningVideo(false)
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  function openCancelModal(appt: Appointment) {
    setCancelAppt(appt)
    setConfirmCancel(false)
    setCancelError(null)
  }

  async function handleCancel() {
    if (!cancelAppt) return
    setCancelling(true)
    setCancelError(null)
    const { error: err } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', cancelAppt.id)
    if (err) { setCancelError(t('patient.miSalud.cancel.cannotCancel')); setCancelling(false); return }
    setCancelAppt(null)
    setConfirmCancel(false)
    await fetchData()
    setCancelling(false)
  }

  // ── Reschedule ───────────────────────────────────────────────────────────

  async function openRescheduleModal(appt: Appointment) {
    setReschedulingAppt(appt)
    setRscDate(null); setRscSlot(null)
    setRscStep('picker'); setRscError(null); setRscSaving(false)
    setRscLoading(true)
    const specialty = appt.doctor?.specialty
    if (!specialty) { setRscLoading(false); return }
    const { data } = await supabase
      .from('availability_slots')
      .select('*, doctor:doctor_id(id, full_name, email, specialty)')
      .eq('is_booked', false)
      .order('date', { ascending: true }).order('start_time', { ascending: true })
    const nowMs = Date.now()
    const filtered = ((data ?? []) as AvailabilitySlot[]).filter(s =>
      s.id !== appt.slot_id &&
      (s.specialty === specialty || s.doctor?.specialty === specialty) &&
      (s.start_time.slice(3, 5) === '00' || s.start_time.slice(3, 5) === '30') &&
      new Date(`${s.date}T${s.start_time}`).getTime() > nowMs
    )
    setRscSlots(filtered)
    setRscLoading(false)
  }

  async function handleConfirmReschedule() {
    if (!reschedulingAppt || !rscSlot || !profile) return
    setRscSaving(true); setRscError(null)
    const { error: insertErr } = await supabase.from('appointments').insert({
      patient_id: profile.id, doctor_id: rscSlot.doctor_id,
      slot_id: rscSlot.id, status: 'confirmed', reason: reschedulingAppt.reason,
    })
    if (insertErr) {
      setRscError(t('patient.miSalud.reschedule.cannotChange'))
      setRscSaving(false); return
    }
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', reschedulingAppt.id)
    if (profile.email) {
      sendRescheduleEmails({
        patientEmail: profile.email,
        patientName:  profile.full_name ?? 'Paciente',
        doctorEmail:  rscSlot.doctor?.email,
        doctorName:   rscSlot.doctor?.full_name ?? 'Doctor',
        specialty:    specialtyLabel(rscSlot.doctor?.specialty),
        fecha:        formatDate(rscSlot.date),
        hora:         `${formatTime(rscSlot.start_time)} – ${formatTime(rscSlot.end_time)}`,
      })
    }
    setReschedulingAppt(null)
    setRscSaving(false)
    setSuccessToast(t('patient.miSalud.reschedule.successToast'))
    setTimeout(() => setSuccessToast(null), 5000)
    await fetchData()
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  async function fetchBookingSlots(spec: Specialty) {
    setBookingSlotsLoading(true)
    const todayStr = new Date().toISOString().slice(0, 10)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 14)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const { data } = await supabase
      .from('availability_slots')
      .select('*, doctor:doctor_id(id, full_name, email, specialty)')
      .eq('is_booked', false)
      .gte('date', todayStr)
      .lte('date', cutoffStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    const nowMs = Date.now()
    const filtered = ((data ?? []) as AvailabilitySlot[]).filter(s =>
      (s.specialty === spec || s.doctor?.specialty === spec) &&
      (s.start_time.slice(3, 5) === '00' || s.start_time.slice(3, 5) === '30') &&
      new Date(`${s.date}T${s.start_time}`).getTime() > nowMs
    )
    setBookingSlots(filtered)
    setBookingSlotsLoading(false)
  }

  function openBooking(opts: { specialty?: Specialty; fromReferral?: Referral } = {}) {
    const spec = (opts.specialty ?? 'medicina_general') as Specialty
    setBookingSpecialty(spec)
    setBookingFromReferral(opts.fromReferral ?? null)
    setBookingSlot(null)
    setBookingStep(1)
    setBookingReason('')
    setPreFiles([])
    setBookingError(null)
    setBookingOpen(true)
    fetchBookingSlots(spec)
  }

  async function handleBook() {
    if (!bookingSlot || !profile) return
    setBookingSubmitting(true); setBookingError(null)
    const { data: apptData, error: err } = await supabase.from('appointments').insert({
      patient_id: profile.id,
      doctor_id:  bookingSlot.doctor_id,
      slot_id:    bookingSlot.id,
      status:     'confirmed',
      reason:     bookingReason.trim() || null,
    }).select('id').single()
    if (err) {
      setBookingError(t('patient.miSalud.booking.cannotBook'))
      setBookingSubmitting(false); return
    }
    // Upload pre-appointment files (fire-and-forget)
    if (apptData?.id && preFiles.length > 0) {
      const apptId = apptData.id
      preFiles.forEach(async (file) => {
        const ext  = file.name.split('.').pop()
        const path = `pre/${profile.id}/${apptId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('diagnostic-files').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('diagnostic-files').getPublicUrl(path)
          await supabase.from('diagnostic_files').insert({
            appointment_id: apptId, patient_id: profile.id,
            file_url: publicUrl, file_name: file.name,
            file_size: `${(file.size / 1024).toFixed(0)} KB`, stage: 'pre_appointment',
          })
        }
      })
    }
    // Confirmation emails (fire-and-forget)
    if (profile.email) {
      sendConfirmationEmails({
        patientEmail: profile.email,
        patientName:  profile.full_name ?? 'Paciente',
        doctorEmail:  bookingSlot.doctor?.email,
        doctorName:   bookingSlot.doctor?.full_name ?? 'Doctor',
        specialty:    specialtyLabel(bookingSlot.doctor?.specialty ?? bookingSpecialty as Specialty),
        fecha:        formatDate(bookingSlot.date),
        hora:         `${formatTime(bookingSlot.start_time)} – ${formatTime(bookingSlot.end_time)}`,
        reason:       bookingReason.trim() || null,
      })
    }
    // Mark referral as used
    if (bookingFromReferral?.urgency !== undefined) {
      await supabase.from('specialist_referrals').update({ status: 'used' }).eq('id', bookingFromReferral.id)
    }
    setBookingOpen(false)
    setSuccessToast(t('patient.miSalud.booking.successToast'))
    setTimeout(() => setSuccessToast(null), 5000)
    await fetchData()
    setBookingSubmitting(false)
  }

  // ── History expand ────────────────────────────────────────────────────────

  async function handleExpandAppt(apptId: string) {
    if (expandedApptId === apptId) { setExpandedApptId(null); return }
    setExpandedApptId(apptId)
    if (expandedDiag[apptId]) return
    const [ordersRes, filesRes] = await Promise.all([
      supabase.from('diagnostic_orders')
        .select('id, exam_type, status, notes, created_at')
        .eq('appointment_id', apptId)
        .order('created_at', { ascending: true }),
      supabase.from('diagnostic_files')
        .select('id, file_name, file_url, stage, uploaded_at')
        .eq('appointment_id', apptId)
        .in('stage', ['pre_appointment', 'during_call'])
        .order('uploaded_at', { ascending: true }),
    ])
    setExpandedDiag(prev => ({
      ...prev,
      [apptId]: { orders: ordersRes.data ?? [], files: filesRes.data ?? [] },
    }))
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const isNewPatient  = !loading && upcomingAppts.length === 0 && pastAppts.length === 0
  const hasUpcoming   = upcomingAppts.length > 0
  const hasReferrals  = activeReferrals.length > 0 || followUpReminders.length > 0
  const hasPast       = pastAppts.length > 0
  const hasHadGeneral = pastAppts.some(a => a.doctor?.specialty === 'medicina_general')

  // Group booking slots by date
  const slotsByDate = bookingSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})
  const sortedBookingDates = Object.keys(slotsByDate).sort()

  // Group reschedule slots by date
  const rscSlotsByDate = rscSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})
  const sortedRscDates = Object.keys(rscSlotsByDate).sort()

  // ── Video full-screen ────────────────────────────────────────────────────

  if (videoAppt && videoToken && videoAppt.daily_room_url) {
    return (
      <PatientVideoCall
        roomUrl={videoAppt.daily_room_url}
        token={videoToken}
        appointmentId={videoAppt.id}
        patientId={profile?.id ?? ''}
        onLeave={() => { setVideoAppt(null); setVideoToken(null); fetchData() }}
      />
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('patient.miSalud.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('patient.miSalud.subtitle')}</p>
        </div>

        {/* Success toast */}
        {successToast && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <svg className="w-5 h-5 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successToast}
          </div>
        )}
        {feedbackToast && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            {feedbackToast}
          </div>
        )}

        {loading ? (
          /* Loading skeleton */
          <div className="space-y-4 animate-pulse">
            <div className="h-36 bg-white rounded-2xl border border-slate-100" />
            <div className="h-24 bg-white rounded-2xl border border-slate-100" />
            <div className="h-48 bg-white rounded-2xl border border-slate-100" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── STATE 1: New patient ── */}
            {isNewPatient && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-3xl" aria-hidden="true">🏥</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{t('patient.miSalud.welcomeTitle')}</h2>
                  <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                    {t('patient.miSalud.welcomeText')}
                  </p>
                </div>
                <button onClick={() => openBooking()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-blue-100">
                  {t('patient.miSalud.bookAppointment')}
                </button>
              </div>
            )}

            {/* ── STATE 2: Upcoming appointments ── */}
            {hasUpcoming && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('patient.miSalud.upcomingTitle')}</h2>

                {/* Featured card */}
                {(() => {
                  const appt = upcomingAppts[0]
                  const slot = appt.slot
                  const mins = slot ? minutesUntil(slot.date, slot.start_time) : Infinity
                  const canJoin = mins <= 5 && mins > -60
                  const joinLabel = joiningVideo
                    ? t('patient.miSalud.connecting')
                    : canJoin
                    ? t('patient.miSalud.joinConsultation')
                    : mins > 60
                    ? t('patient.miSalud.availableIn', { time: `${Math.ceil(mins / 60)}h` })
                    : t('patient.miSalud.availableIn', { time: `${Math.ceil(Math.max(mins, 1))} min` })

                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                      style={{ borderLeft: '3px solid #1e3a5f' }}>
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <span className="text-white font-bold text-sm">{docInitials(appt.doctor?.full_name)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-bold text-slate-900">
                                Dr(a). {appt.doctor?.full_name ?? '—'}
                              </p>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {specialtyLabel(appt.doctor?.specialty)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {slot ? `${formatDateLong(slot.date)} · ${formatTimeAMPM(slot.start_time)}` : '—'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                              <span className="text-xs font-semibold text-emerald-700">{t('patient.miSalud.confirmed')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleJoinVideo(appt)}
                            disabled={!canJoin || joiningVideo}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                              canJoin
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-100'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            📹 {joinLabel}
                          </button>
                          <button onClick={() => openRescheduleModal(appt)}
                            className="sm:flex-none px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            {t('patient.miSalud.reschedule')}
                          </button>
                          <button onClick={() => openCancelModal(appt)}
                            className="sm:flex-none px-4 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                            {t('patient.miSalud.cancel')}
                          </button>
                        </div>
                        {videoError && (
                          <p className="text-xs text-red-600 text-center mt-2">{videoError}</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Secondary upcoming */}
                {upcomingAppts.slice(1).map(appt => (
                  <div key={appt.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          Dr(a). {appt.doctor?.full_name ?? '—'} · {specialtyLabel(appt.doctor?.specialty)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {appt.slot
                            ? `${formatDateLong(appt.slot.date)} · ${formatTimeAMPM(appt.slot.start_time)}`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openCancelModal(appt)}
                      className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
                      {t('patient.miSalud.cancel')}
                    </button>
                  </div>
                ))}

                {/* Agendar otra */}
                <div className="pt-1">
                  <button onClick={() => openBooking()}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold">+</span>
                    {t('patient.miSalud.bookAnother')}
                  </button>
                  {hasHadGeneral && (
                    <p className="text-xs text-slate-400 mt-1.5 ml-7">
                      {t('patient.miSalud.specialistNote')}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* If has past but no upcoming: show agendar button */}
            {!isNewPatient && !hasUpcoming && (
              <div>
                <button onClick={() => openBooking()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-blue-100">
                  {t('patient.miSalud.bookBtn')}
                </button>
              </div>
            )}

            {/* ── STATE 3: Active referrals ── */}
            {hasReferrals && (
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('patient.miSalud.activeReferrals')}</h2>
                  <p className="text-xs text-slate-400 mt-1">{t('patient.miSalud.referralsNote')}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activeReferrals.map(ref => (
                    <div key={ref.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{SPECIALTY_ICONS[ref.specialty] ?? '🏥'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{specialtyLabel(ref.specialty)}</p>
                          <p className="text-xs text-slate-500">
                            Referido por Dr(a). {ref.referring_doctor?.full_name ?? '—'}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          ref.urgency === 'prioritaria'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {ref.urgency === 'prioritaria' ? t('patient.miSalud.priority') : t('patient.miSalud.routine')}
                        </span>
                      </div>
                      <button onClick={() => openBooking({ specialty: ref.specialty, fromReferral: ref })}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                        {t('patient.miSalud.bookReferral')}
                      </button>
                    </div>
                  ))}

                  {followUpReminders.map(rem => (
                    <div key={rem.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{SPECIALTY_ICONS[rem.specialty] ?? '🏥'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            Control recomendado: {specialtyLabel(rem.specialty)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Dr(a). {rem.doctor?.full_name ?? '—'} recomienda un control
                          </p>
                        </div>
                      </div>
                      <button onClick={() => openBooking({ specialty: rem.specialty })}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                        {t('patient.miSalud.bookControl')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── STATE 4: Past appointments ── */}
            {hasPast && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('patient.miSalud.historyTitle')}</h2>
                <ul className="space-y-2">
                  {pastAppts.map(appt => {
                    const isExpanded  = expandedApptId === appt.id
                    const fb          = feedbacks[appt.id]
                    const noAtendida  = appt.summary === 'Cita no atendida - cerrada automáticamente'
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const medItems    = (appt as any).prescriptions?.[0]?.prescription_items ?? []
                    const diag        = expandedDiag[appt.id]

                    return (
                      <li key={appt.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                        {/* Collapsed header */}
                        <button
                          onClick={() => handleExpandAppt(appt.id)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="text-sm font-semibold text-slate-900">
                                Dr(a). {appt.doctor?.full_name ?? '—'}
                              </p>
                              {noAtendida ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                  {t('patient.miSalud.notAttended')}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  {specialtyLabel(appt.doctor?.specialty)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              {appt.slot ? `${formatDate(appt.slot.date)} · ${formatTimeAMPM(appt.slot.start_time)}` : '—'}
                            </p>
                          </div>
                          {!noAtendida && (
                            <span className="shrink-0 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                              {t('patient.miSalud.completed')}
                            </span>
                          )}
                          <svg className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4"
                            style={{ animation: 'modal-in 0.15s ease-out' }}>

                            {/* Motivo */}
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('patient.miSalud.consultationReason')}</p>
                              <p className="text-sm text-slate-700">
                                {appt.reason ?? <span className="text-slate-400 italic">{t('patient.miSalud.notSpecified')}</span>}
                              </p>
                            </div>

                            {/* Resumen */}
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('patient.miSalud.medicalSummary')}</p>
                              {noAtendida ? (
                                <div className="flex items-start gap-2.5 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                  <svg className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                  </svg>
                                  <p className="text-sm font-semibold text-orange-800">{t('patient.miSalud.notAttendedText')}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 leading-relaxed">
                                  {appt.summary ?? <span className="text-slate-400 italic">{t('patient.miSalud.noSummary')}</span>}
                                </p>
                              )}
                            </div>

                            {/* Medications */}
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('patient.miSalud.prescribedMeds')}</p>
                              {medItems.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {medItems.map((item: { medicine_name: string; dose: string; instructions: string }, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                      <span className="text-blue-400 font-bold mt-0.5 shrink-0">•</span>
                                      <div>
                                        <span className="font-semibold text-slate-900">{item.medicine_name}</span>
                                        <span className="text-slate-500"> — {item.dose}</span>
                                        {item.instructions && <p className="text-xs text-slate-400 mt-0.5">{item.instructions}</p>}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-400 italic">{t('patient.miSalud.noMeds')}</p>
                              )}
                            </div>

                            {/* Diagnostic orders */}
                            {diag?.orders.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('patient.miSalud.orderedExams')}</p>
                                <ul className="space-y-1.5">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {diag.orders.map((order: any) => (
                                    <li key={order.id} className="flex items-center justify-between gap-3 text-sm">
                                      <span className="text-slate-800 font-medium">{order.exam_type}</span>
                                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                      }`}>
                                        {order.status === 'completed' ? t('patient.miSalud.examCompleted') : t('patient.miSalud.examPending')}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Rating */}
                            {!noAtendida && (
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{t('patient.miSalud.yourRating')}</p>
                                {fb ? (
                                  <div className="space-y-1">
                                    <StarsDisplay rating={fb.rating} />
                                    {fb.comment && <p className="text-xs text-slate-500 italic">"{fb.comment}"</p>}
                                    <p className="text-xs text-slate-400">{t('patient.miSalud.ratedSent')}</p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setExpandedApptId(null); setFeedbackAppt(appt) }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                                  >
                                    {t('patient.miSalud.rateConsultation')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ── Booking modal ─────────────────────────────────────────────────────── */}
      {bookingOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !bookingSubmitting) setBookingOpen(false) }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-[480px] max-h-[92vh] overflow-y-auto"
            style={{ animation: 'modal-in 0.2s ease-out' }}>

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('patient.miSalud.booking.title')}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{specialtyLabel(bookingSpecialty as Specialty)}</p>
              </div>
              <button onClick={() => !bookingSubmitting && setBookingOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3 px-6 py-3">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${bookingStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
                <span className="text-xs text-slate-500 hidden sm:block">{t('patient.miSalud.booking.step1')}</span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${bookingStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
                <span className="text-xs text-slate-500 hidden sm:block">{t('patient.miSalud.booking.step2')}</span>
              </div>
            </div>

            {/* Step 1: Date & time */}
            {bookingStep === 1 && (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-bold text-slate-700 mb-4">{t('patient.miSalud.booking.chooseDateTitle')}</h3>
                {bookingSlotsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-6 h-6 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : sortedBookingDates.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 font-medium text-sm">{t('patient.miSalud.booking.noSlots')}</p>
                    <p className="text-slate-400 text-sm mt-1">{t('patient.miSalud.booking.tryLater')}</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortedBookingDates.map(d => (
                      <div key={d}>
                        <p className="text-sm font-semibold text-slate-700 mb-2">{formatDateMedium(d)}</p>
                        <div className="flex flex-wrap gap-2">
                          {slotsByDate[d].map(slot => (
                            <button
                              key={slot.id}
                              onClick={() => { setBookingSlot(slot); setBookingStep(2) }}
                              className="px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                            >
                              {formatTimeAMPM(slot.start_time)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Reason */}
            {bookingStep === 2 && bookingSlot && (
              <div className="px-6 pb-6 space-y-4" style={{ animation: 'modal-in 0.15s ease-out' }}>
                {/* Slot info */}
                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-sm font-semibold text-blue-900">{formatDateLong(bookingSlot.date)}</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {formatTimeAMPM(bookingSlot.start_time)}
                  </p>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    {t('patient.miSalud.booking.chooseReasonTitle')}
                  </label>
                  <textarea
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                    rows={3}
                    placeholder={t('patient.miSalud.booking.reasonPlaceholder')}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                  />
                  <p className={`text-xs mt-1 text-right ${bookingReason.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {t('patient.miSalud.booking.minChars', { count: bookingReason.trim().length })}
                  </p>
                </div>

                {/* File upload */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {t('patient.miSalud.booking.prevDocs')} <span className="normal-case font-normal text-slate-400">({t('common.optional')})</span>
                  </p>
                  <button type="button" onClick={() => preFileRef.current?.click()}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-blue-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {t('patient.miSalud.booking.uploadFile')}
                  </button>
                  <input ref={preFileRef} type="file" multiple
                    accept="application/pdf,image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).filter(f => f.size <= 10 * 1024 * 1024)
                      setPreFiles(prev => [...prev, ...files])
                      e.target.value = ''
                    }} />
                  {preFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {preFiles.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                          <span className="flex-1 truncate">📄 {f.name}</span>
                          <button onClick={() => setPreFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-slate-400 hover:text-red-500 transition-colors font-bold">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{bookingError}</div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setBookingStep(1)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                    {t('patient.miSalud.booking.backBtn')}
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={bookingSubmitting || bookingReason.trim().length < 10}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-100"
                  >
                    {bookingSubmitting ? t('patient.miSalud.booking.confirming') : t('patient.miSalud.booking.confirmBtn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cancel modal ──────────────────────────────────────────────────────── */}
      {cancelAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !cancelling) { setCancelAppt(null); setConfirmCancel(false) } }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            {!confirmCancel ? (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-2">{t('patient.miSalud.cancel.appointmentDetail')}</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Dr(a). {cancelAppt.doctor?.full_name ?? '—'} · {cancelAppt.slot ? `${formatDateLong(cancelAppt.slot.date)} · ${formatTimeAMPM(cancelAppt.slot.start_time)}` : ''}
                </p>
                <div className="space-y-2.5">
                  <button onClick={() => { setCancelAppt(null); openRescheduleModal(cancelAppt) }}
                    className="w-full py-3 rounded-xl border-2 border-blue-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                    {t('patient.miSalud.cancel.rescheduleInstead')}
                  </button>
                  <button onClick={() => setConfirmCancel(true)}
                    className="w-full py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                    {t('patient.miSalud.cancel.cancelAppointment')}
                  </button>
                  <button onClick={() => setCancelAppt(null)}
                    className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                    {t('patient.miSalud.cancel.close')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-2xl mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 text-center mb-1">{t('patient.miSalud.cancel.confirmTitle')}</h2>
                <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                  Dr(a). {cancelAppt.doctor?.full_name ?? '—'}<br />
                  {cancelAppt.slot ? `${formatDateLong(cancelAppt.slot.date)} · ${formatTimeAMPM(cancelAppt.slot.start_time)}` : ''}
                </p>
                {cancelError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{cancelError}</div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setConfirmCancel(false)} disabled={cancelling}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    {t('patient.miSalud.cancel.noGoBack')}
                  </button>
                  <button onClick={handleCancel} disabled={cancelling}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {cancelling ? t('patient.miSalud.cancel.cancelling') : t('patient.miSalud.cancel.yesCancelBtn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reschedule modal ──────────────────────────────────────────────────── */}
      {reschedulingAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !rscSaving) setReschedulingAppt(null) }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-[480px] max-h-[92vh] overflow-y-auto"
            style={{ animation: 'modal-in 0.2s ease-out' }}>

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('patient.miSalud.reschedule.title')}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{specialtyLabel(reschedulingAppt.doctor?.specialty)}</p>
              </div>
              <button onClick={() => !rscSaving && setReschedulingAppt(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {rscStep === 'picker' ? (
              <div className="px-6 py-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">{t('patient.miSalud.reschedule.chooseNew')}</h3>
                {rscLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-6 h-6 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : sortedRscDates.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 text-sm">{t('patient.miSalud.reschedule.noSlots')}</p>
                    <button onClick={() => setReschedulingAppt(null)}
                      className="mt-4 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      {t('common.close')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortedRscDates.map(d => (
                      <div key={d}>
                        <p className={`text-sm font-semibold mb-2 ${rscDate === d ? 'text-blue-600' : 'text-slate-700'}`}>{formatDateMedium(d)}</p>
                        <div className="flex flex-wrap gap-2">
                          {rscSlotsByDate[d].map(slot => (
                            <button
                              key={slot.id}
                              onClick={() => { setRscDate(d); setRscSlot(slot) }}
                              className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                                rscSlot?.id === slot.id
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                              }`}
                            >
                              {formatTimeAMPM(slot.start_time)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {rscSlot && (
                      <button onClick={() => setRscStep('confirming')}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                        style={{ animation: 'modal-in 0.15s ease-out' }}>
                        {t('patient.miSalud.reschedule.confirmChange')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-6 py-5" style={{ animation: 'modal-in 0.15s ease-out' }}>
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-2xl mx-auto mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 text-center mb-2">{t('patient.miSalud.reschedule.confirmTitle')}</h2>
                <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                  {t('patient.miSalud.reschedule.newAppointment')} <strong className="text-slate-700">{rscSlot ? formatDateLong(rscSlot.date) : ''}</strong>{' '}
                  {t('patient.miSalud.reschedule.at')} <strong className="text-slate-700">{rscSlot ? formatTimeAMPM(rscSlot.start_time) : ''}</strong>
                </p>
                {rscError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{rscError}</div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setRscStep('picker')} disabled={rscSaving}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    {t('patient.miSalud.reschedule.back')}
                  </button>
                  <button onClick={handleConfirmReschedule} disabled={rscSaving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
                    {rscSaving ? t('patient.miSalud.reschedule.changing') : t('patient.miSalud.reschedule.yesChange')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Feedback modal ────────────────────────────────────────────────────── */}
      {feedbackAppt && profile && (
        <FeedbackModal
          appointment={feedbackAppt}
          patientId={profile.id}
          onClose={() => setFeedbackAppt(null)}
          onSubmitted={() => {
            setFeedbackAppt(null)
            setFeedbackToast(t('patient.miSalud.feedback.thankYou'))
            setTimeout(() => setFeedbackToast(null), 4000)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-base leading-none">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  )
}
