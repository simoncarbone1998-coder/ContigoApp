import { Routes, Route, Navigate } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import InstallPrompt from './components/InstallPrompt'
import LandingPage  from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegistroPage from './pages/RegistroPage'

// Patient pages
import PatientPerfilPage    from './pages/paciente/PerfilPage'
import PatientAgendarPage   from './pages/paciente/AgendarPage'
import PatientCalendarioPage from './pages/paciente/CalendarioPage'
import PatientPastillasPage  from './pages/paciente/PastillasPage'
import PatientExamenesPage   from './pages/paciente/ExamenesPage'

// Doctor pages
import DoctorSetupPage   from './pages/doctor/SetupEspecialidadPage'
import DoctorPerfilPage  from './pages/doctor/PerfilPage'
import DoctorAgendaPage  from './pages/doctor/AgendaPage'
import DoctorFinanzasPage from './pages/doctor/FinanzasPage'

// Admin pages
import AdminDashboard from './pages/admin/DashboardPage'

// Onboarding
import PatientOnboarding from './components/onboarding/PatientOnboarding'
import DoctorOnboarding  from './components/onboarding/DoctorOnboarding'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />

      {/* Patient routes */}
      <Route element={<RequireRole role="patient" />}>
        <Route path="/paciente/onboarding"  element={<PatientOnboarding />} />
        <Route path="/paciente/perfil"      element={<PatientPerfilPage />} />
        <Route path="/paciente/agendar"     element={<PatientAgendarPage />} />
        <Route path="/paciente/calendario"  element={<PatientCalendarioPage />} />
        <Route path="/paciente/pastillas"   element={<PatientPastillasPage />} />
        <Route path="/paciente/examenes"    element={<PatientExamenesPage />} />
        {/* Legacy redirect */}
        <Route path="/paciente/dashboard"   element={<Navigate to="/paciente/perfil" replace />} />
        <Route path="/paciente/nueva-cita"  element={<Navigate to="/paciente/agendar" replace />} />
      </Route>

      {/* Doctor routes */}
      <Route element={<RequireRole role="doctor" />}>
        <Route path="/doctor/onboarding" element={<DoctorOnboarding />} />
        <Route path="/doctor/setup"    element={<DoctorSetupPage />} />
        <Route path="/doctor/perfil"   element={<DoctorPerfilPage />} />
        <Route path="/doctor/agenda"   element={<DoctorAgendaPage />} />
        <Route path="/doctor/finanzas" element={<DoctorFinanzasPage />} />
        {/* Legacy redirect */}
        <Route path="/doctor/dashboard" element={<Navigate to="/doctor/agenda" replace />} />
      </Route>

      {/* Admin routes */}
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    <InstallPrompt />
  )
}
