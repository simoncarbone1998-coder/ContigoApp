export type Role = 'patient' | 'doctor' | 'admin'

export type Specialty =
  | 'medicina_general'
  | 'pediatria'
  | 'cardiologia'
  | 'dermatologia'
  | 'ginecologia'
  | 'ortopedia'
  | 'psicologia'

export const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: 'medicina_general', label: 'Medicina General' },
  { value: 'pediatria',        label: 'Pediatría' },
  { value: 'cardiologia',      label: 'Cardiología' },
  { value: 'dermatologia',     label: 'Dermatología' },
  { value: 'ginecologia',      label: 'Ginecología' },
  { value: 'ortopedia',        label: 'Ortopedia' },
  { value: 'psicologia',       label: 'Psicología' },
]

export function specialtyLabel(value: Specialty | null | undefined): string {
  if (!value) return '—'
  return SPECIALTIES.find((s) => s.value === value)?.label ?? value
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: Role
  birth_date: string | null
  city: string | null
  bio: string | null
  specialty: Specialty | null
  avatar_url: string | null
  undergraduate_university: string | null
  postgraduate_specialty: string | null
  doctor_description: string | null
  delivery_address: string | null
  onboarding_completed: boolean
  created_at: string
}

export interface AvailabilitySlot {
  id: string
  doctor_id: string
  date: string
  start_time: string
  end_time: string
  is_booked: boolean
  specialty: Specialty | null
  created_at: string
  doctor?: Pick<Profile, 'id' | 'full_name' | 'email' | 'specialty' | 'avatar_url'>
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  slot_id: string
  status: 'confirmed' | 'cancelled'
  reason: string | null
  summary: string | null
  completed: boolean
  completed_at: string | null
  daily_room_name: string | null
  daily_room_url: string | null
  room_created_at: string | null
  created_at: string
  patient?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone' | 'city' | 'birth_date'>
  doctor?: Pick<Profile, 'id' | 'full_name' | 'email' | 'specialty' | 'avatar_url'>
  slot?: AvailabilitySlot
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  medicine_name: string
  dose: string
  instructions: string
  created_at: string
}

export interface Prescription {
  id: string
  appointment_id: string | null
  patient_id: string
  doctor_id: string
  status: 'pendiente' | 'en_camino'
  delivery_address: string | null
  confirmed_at: string | null
  created_at: string
  doctor?: Pick<Profile, 'id' | 'full_name' | 'specialty'>
  appointment?: {
    slot?: { date: string; start_time: string; end_time: string } | null
  } | null
  items?: PrescriptionItem[]
}

export interface DoctorEarning {
  id: string
  doctor_id: string
  appointment_id: string
  amount: number
  created_at: string
  appointment?: Appointment
}
