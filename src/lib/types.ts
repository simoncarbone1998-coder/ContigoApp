export type Appointment = {
  id: string
  user_id: string
  appointment_date: string
  appointment_time: string
  reason_for_visit: string
  symptoms_description: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
  updated_at: string
}
