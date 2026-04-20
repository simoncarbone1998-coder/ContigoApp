import { createContext, useContext } from 'react'
import type { Profile, Appointment, PatientApplication, UnderwritingRulebook } from '../../lib/types'
import type { Role } from '../../lib/types'

export interface AdminCtx {
  adminProfile: Profile | null

  // Data
  allUsers: Profile[]
  appointments: Appointment[]
  feedbacks: unknown[]
  diagOrders: unknown[]
  referralStats: { monthCount: number; topSpecialty: string | null }
  loading: boolean
  error: string | null

  // Derived
  avgRating: number
  doctorAvgMap: Record<string, number>

  // Metrics extras
  monthlyApprovedPatients: { month: string; count: number }[]
  apptsBySpecialty: { specialty: string; count: number; pct: number }[]
  doctorRatingsTable: { id: string; name: string; specialty: string; totalAppts: number; avg: number }[]

  // Pending doctors
  pendingDoctors: Profile[]
  rejectTarget: Profile | null
  setRejectTarget: (d: Profile | null) => void
  rejectReason: string
  setRejectReason: (s: string) => void
  processingId: string | null
  handleApprove: (doctor: Profile) => void
  handleRejectConfirm: () => void

  // Labs
  allLabs: unknown[]
  labRejectTarget: unknown | null
  setLabRejectTarget: (l: unknown | null) => void
  labRejectReason: string
  setLabRejectReason: (s: string) => void
  labProcessingId: string | null
  labDetail: unknown | null
  setLabDetail: (l: unknown | null) => void
  handleLabApprove: (lab: { id: string; name: string; email: string }) => void
  handleLabRejectConfirm: () => void

  // Applications
  applications: PatientApplication[]
  questionnaires: Record<string, unknown>
  appProcessingId: string | null
  appRejectTarget: PatientApplication | null
  setAppRejectTarget: (a: PatientApplication | null) => void
  appRejectNote: string
  setAppRejectNote: (s: string) => void
  expandedQuestions: Record<string, boolean>
  setExpandedQuestions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  historyFilter: 'all' | 'approved' | 'rejected'
  setHistoryFilter: (f: 'all' | 'approved' | 'rejected') => void
  historySearch: string
  setHistorySearch: (s: string) => void
  handleAppApprove: (app: PatientApplication) => void
  handleAppRejectConfirm: () => void

  // Underwriting
  rulebooks: UnderwritingRulebook[]
  uwTab: 'config' | 'simulator' | 'history'
  setUwTab: (t: 'config' | 'simulator' | 'history') => void
  rbCostConsult: number
  setRbCostConsult: (n: number) => void
  rbCostMed: number
  setRbCostMed: (n: number) => void
  rbCostExam: number
  setRbCostExam: (n: number) => void
  rbIncome: number
  setRbIncome: (n: number) => void
  rbThresholdReview: number
  setRbThresholdReview: (n: number) => void
  rbThresholdReject: number
  setRbThresholdReject: (n: number) => void
  rbInstructions: string
  setRbInstructions: (s: string) => void
  rbVersionName: string
  setRbVersionName: (s: string) => void
  rbSaving: boolean
  rbCompare: string | null
  setRbCompare: (s: string | null) => void
  handleSaveRulebook: () => void
  handleActivateRulebook: (rb: UnderwritingRulebook) => void
  simAge: string
  setSimAge: (s: string) => void
  simSex: string
  setSimSex: (s: string) => void
  simConditions: string[]
  setSimConditions: React.Dispatch<React.SetStateAction<string[]>>
  simHospitalized: boolean | null
  setSimHospitalized: (b: boolean | null) => void
  simTreatment: boolean | null
  setSimTreatment: (b: boolean | null) => void
  simMeds: boolean | null
  setSimMeds: (b: boolean | null) => void
  simSmoking: string
  setSimSmoking: (s: string) => void
  simEps: boolean | null
  setSimEps: (b: boolean | null) => void
  simRulebookId: string
  setSimRulebookId: (s: string) => void
  simRunning: boolean
  simResult: unknown | null
  handleSimulate: () => void

  // Chat IA
  chatDocuments: unknown[]
  chatConfig: unknown | null
  chatLeads: unknown[]
  chatSubTab: 'documents' | 'prompt' | 'simulator' | 'leads'
  setChatSubTab: (t: 'documents' | 'prompt' | 'simulator' | 'leads') => void
  chatPrompt: string
  setChatPrompt: (s: string) => void
  chatPromptSaving: boolean
  chatUploading: boolean
  chatDeleteTarget: string | null
  setChatDeleteTarget: (s: string | null) => void
  chatLeadDetail: unknown | null
  setChatLeadDetail: (l: unknown | null) => void
  chatSimMsgs: { role: 'user' | 'assistant'; content: string; id: string }[]
  chatSimInput: string
  setChatSimInput: (s: string) => void
  chatSimLoading: boolean
  chatSimUseCustom: boolean
  setChatSimUseCustom: (b: boolean) => void
  handleUploadChatFile: (files: FileList | null) => void
  handleDeleteChatDocument: (id: string) => void
  handleSaveChatPrompt: () => void
  handleResetChatPrompt: () => void
  handleChatSimSend: () => void
  exportChatLeadsCSV: () => void

  // Users
  userSearch: string
  setUserSearch: (s: string) => void
  userRoleFilter: Role | 'all'
  setUserRoleFilter: (r: Role | 'all') => void
  roleChanging: string | null
  confirmTarget: { user: Profile; newRole: Role } | null
  setConfirmTarget: (t: { user: Profile; newRole: Role } | null) => void
  confirmInput: string
  setConfirmInput: (s: string) => void
  detailUser: Profile | null
  setDetailUser: (u: Profile | null) => void
  detailApptCount: number | null
  handleRoleChange: () => void
  cancelling: string | null
  handleCancel: (id: string) => void

  // Toast
  toast: string | null
  showToast: (msg: string) => void
}

export const AdminContext = createContext<AdminCtx | null>(null)

export function useAdminCtx(): AdminCtx {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdminCtx must be used within AdminLayout')
  return ctx
}
