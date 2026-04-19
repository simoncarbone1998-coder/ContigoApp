import { Routes, Route, Navigate } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import InstallPrompt from './components/InstallPrompt'
import LandingPage  from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegistroPage from './pages/RegistroPage'
import AplicarPage from './pages/AplicarPage'

// Patient pages
import PatientMiSaludPage   from './pages/paciente/MiSaludPage'
import PatientPerfilPage    from './pages/paciente/PerfilPage'
import PatientAgendarPage   from './pages/paciente/AgendarPage'
import PatientCalendarioPage from './pages/paciente/CalendarioPage'
import PatientPastillasPage  from './pages/paciente/PastillasPage'
import PatientExamenesPage   from './pages/paciente/ExamenesPage'
import PatientReferenciasPage from './pages/paciente/ReferenciasPage'
import PatientPendingApplicationPage from './pages/paciente/PendingApplicationPage'
import PatientRejectedApplicationPage from './pages/paciente/RejectedApplicationPage'

// Doctor pages
import DoctorPendingPage  from './pages/doctor/PendingPage'
import DoctorSetupPage   from './pages/doctor/SetupEspecialidadPage'
import DoctorPerfilPage  from './pages/doctor/PerfilPage'
import DoctorAgendaPage  from './pages/doctor/AgendaPage'
import DoctorFinanzasPage from './pages/doctor/FinanzasPage'

// Admin pages
import AdminDashboard from './pages/admin/DashboardPage'

// Lab portal pages
import RequireLab         from './components/RequireLab'
import LabLoginPage       from './pages/lab/LoginPage'
import LabRegistroPage    from './pages/lab/RegistroPage'
import LabPendingPage     from './pages/lab/PendingPage'
import LabRejectedPage    from './pages/lab/RejectedPage'
import LabDashboardPage   from './pages/lab/DashboardPage'
import LabOrdenesPage     from './pages/lab/OrdenesPage'
import LabAgendaPage      from './pages/lab/AgendaPage'
import LabHistorialPage   from './pages/lab/HistorialPage'
import LabPerfilPage      from './pages/lab/PerfilPage'

// Onboarding
import PatientOnboarding from './components/onboarding/PatientOnboarding'
import DoctorOnboarding  from './components/onboarding/DoctorOnboarding'

export default function App() {
  return (
    <>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/aplicar" element={<AplicarPage />} />
      {/* /registro still works — patient mode redirects to /aplicar, doctor mode stays */}
      <Route path="/registro" element={<RegistroPage />} />

      {/* Patient routes */}
      <Route element={<RequireRole role="patient" />}>
        <Route path="/paciente/pending-application" element={<PatientPendingApplicationPage />} />
        <Route path="/paciente/rejected"            element={<PatientRejectedApplicationPage />} />
        <Route path="/paciente/onboarding"  element={<PatientOnboarding />} />
        <Route path="/paciente/mi-salud"    element={<PatientMiSaludPage />} />
        <Route path="/paciente/perfil"      element={<PatientPerfilPage />} />
        <Route path="/paciente/pastillas"   element={<PatientPastillasPage />} />
        <Route path="/paciente/examenes"    element={<PatientExamenesPage />} />
        {/* Legacy redirects */}
        <Route path="/paciente/dashboard"   element={<Navigate to="/paciente/mi-salud" replace />} />
        <Route path="/paciente/agendar"     element={<Navigate to="/paciente/mi-salud" replace />} />
        <Route path="/paciente/calendario"  element={<Navigate to="/paciente/mi-salud" replace />} />
        <Route path="/paciente/referencias" element={<Navigate to="/paciente/mi-salud" replace />} />
        <Route path="/paciente/nueva-cita"  element={<Navigate to="/paciente/mi-salud" replace />} />
      </Route>

      {/* Doctor routes */}
      <Route element={<RequireRole role="doctor" />}>
        <Route path="/doctor/pending"    element={<DoctorPendingPage />} />
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

      {/* Lab portal — public */}
      <Route path="/lab"          element={<Navigate to="/lab/login" replace />} />
      <Route path="/lab/login"    element={<LabLoginPage />} />
      <Route path="/lab/registro" element={<LabRegistroPage />} />

      {/* Lab portal — protected */}
      <Route element={<RequireLab />}>
        <Route path="/lab/pending"   element={<LabPendingPage />} />
        <Route path="/lab/rejected"  element={<LabRejectedPage />} />
        <Route path="/lab/dashboard" element={<LabDashboardPage />} />
        <Route path="/lab/ordenes"   element={<LabOrdenesPage />} />
        <Route path="/lab/agenda"    element={<LabAgendaPage />} />
        <Route path="/lab/historial" element={<LabHistorialPage />} />
        <Route path="/lab/perfil"    element={<LabPerfilPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    <InstallPrompt />
    </>
  )
}
