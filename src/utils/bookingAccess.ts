import { supabase } from '../lib/supabase'

export interface BookingAccessResult {
  canBook: boolean
  reason?: 'general_required' | 'referral_required'
  message?: string
  referral?: Record<string, unknown>
}

export async function checkBookingAccess(patientId: string, specialty: string): Promise<BookingAccessResult> {
  // Medicina General is always open
  if (specialty === 'medicina_general') {
    return { canBook: true }
  }

  // 1. Check if patient has at least 1 completed Medicina General appointment
  const { data: generalAppts } = await supabase
    .from('appointments')
    .select('id, slot:slot_id(specialty)')
    .eq('patient_id', patientId)
    .eq('completed', true)
    .eq('status', 'confirmed')
    .limit(50)

  const hasGeneral = (generalAppts ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.slot?.specialty === 'medicina_general'
  )

  if (!hasGeneral) {
    return {
      canBook: false,
      reason: 'general_required',
      message: 'Primero necesitas una consulta con Medicina General',
    }
  }

  // 2. Check for active referral for this specialty
  const { data: referrals } = await supabase
    .from('specialist_referrals')
    .select('*, referring_doctor:referring_doctor_id(full_name)')
    .eq('patient_id', patientId)
    .eq('specialty', specialty)
    .eq('status', 'active')
    .limit(1)

  if (referrals && referrals.length > 0) {
    return { canBook: true, referral: referrals[0] as Record<string, unknown> }
  }

  // 3. Check for notified follow-up reminder for this specialty
  const { data: reminders } = await supabase
    .from('follow_up_reminders')
    .select('*, doctor:doctor_id(full_name)')
    .eq('patient_id', patientId)
    .eq('specialty', specialty)
    .eq('status', 'notified')
    .limit(1)

  if (reminders && reminders.length > 0) {
    return { canBook: true, referral: reminders[0] as Record<string, unknown> }
  }

  return {
    canBook: false,
    reason: 'referral_required',
    message: 'Necesitas una referencia médica para acceder a esta especialidad',
  }
}
