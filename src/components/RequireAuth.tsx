import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RequireAuth() {
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  return authed ? <Outlet /> : <Navigate to="/" replace />
}
