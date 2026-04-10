import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LabLoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/login?type=lab', { replace: true })
  }, [navigate])

  return null
}
