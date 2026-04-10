import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Lab {
  id: string
  auth_id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  type: 'laboratorio' | 'imagenes' | 'ambos'
  status: 'pending' | 'approved' | 'rejected'
  camara_comercio_url: string | null
  habilitacion_supersalud_url: string | null
  rut_url: string | null
  rejection_reason: string | null
}

interface LabContextValue {
  lab: Lab | null
  loading: boolean
  refreshLab: () => Promise<void>
}

const LabContext = createContext<LabContextValue | null>(null)

export function LabProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [lab, setLab]         = useState<Lab | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchLab() {
    if (!session || profile?.role !== 'laboratory') {
      setLab(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.rpc('get_my_lab')
    setLab((data as Lab) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    fetchLab()
  }, [session?.user.id, profile?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshLab() {
    await fetchLab()
  }

  return (
    <LabContext.Provider value={{ lab, loading, refreshLab }}>
      {children}
    </LabContext.Provider>
  )
}

export function useLabContext() {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLabContext must be used within LabProvider')
  return ctx
}
