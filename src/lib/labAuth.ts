import { supabase } from './supabase'

export interface LabSession {
  id: string
  name: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  type: 'laboratorio' | 'imagenes' | 'ambos'
  city: string | null
  phone: string | null
  address: string | null
}

const SESSION_KEY = 'lab_session'

export function getLabSession(): LabSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as LabSession) : null
  } catch {
    return null
  }
}

export function setLabSession(lab: LabSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(lab))
}

export function logoutLab() {
  localStorage.removeItem(SESSION_KEY)
}

export function isLabAuthenticated(): boolean {
  return getLabSession() !== null
}

export async function loginLab(email: string, password: string): Promise<LabSession | null> {
  const { data, error } = await supabase.rpc('authenticate_lab', {
    p_email: email,
    p_password: password,
  })
  if (error || !data) return null
  const session = data as LabSession
  setLabSession(session)
  return session
}

/** Refreshes session from DB and updates localStorage */
export async function refreshLabSession(id: string): Promise<LabSession | null> {
  const { data, error } = await supabase.rpc('get_lab_by_id', { p_id: id })
  if (error || !data) return null
  const session = data as LabSession
  setLabSession(session)
  return session
}
