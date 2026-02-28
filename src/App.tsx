import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}
