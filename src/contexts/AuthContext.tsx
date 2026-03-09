import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchOrCreateProfile(user: User) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data as Profile)
    } else {
      // Trigger may not have fired yet — upsert defensively
      const { data: created } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.user_name as string | undefined) ??
              user.email?.split('@')[0] ??
              null,
            email: user.email ?? null,
            role: 'patient',
          },
          { onConflict: 'id' },
        )
        .select()
        .single()
      setProfile(created as Profile)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchOrCreateProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          fetchOrCreateProfile(session.user)
        } else {
          setProfile(null)
          setLoading(false)
        }
      },
    )

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshProfile() {
    if (!session?.user) return
    await fetchOrCreateProfile(session.user)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
