# ContigoApp — User Flows & Product Reference

> Generated from full codebase analysis · April 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Routes Reference](#2-routes-reference)
3. [User Types & Roles](#3-user-types--roles)
4. [Public Flows](#4-public-flows)
5. [Patient Flows](#5-patient-flows)
6. [Doctor Flows](#6-doctor-flows)
7. [Admin Flows](#7-admin-flows)
8. [Laboratory Flows](#8-laboratory-flows)
9. [Forms Reference](#9-forms-reference)
10. [Email Notifications](#10-email-notifications)
11. [Edge Cases & Error States](#11-edge-cases--error-states)
12. [Database Schema Reference](#12-database-schema-reference)
13. [Edge Functions Reference](#13-edge-functions-reference)

---

## 1. Architecture Overview

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Routing | React Router v7 (client-side) |
| Styling | Tailwind CSS v4 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Authentication | Email + password via Supabase Auth |
| Video calls | Daily.co (custom UI via `@daily-co/daily-js`) |
| AI | Claude claude-haiku-4-5 (chat), Claude claude-sonnet-4-5 (summaries, underwriting) |
| Transcription | Deepgram SDK v3 |
| Email delivery | Resend API |
| Storage buckets | `avatars`, `diagnostic-files`, `chat-documents` |

### Authentication model

All roles (patient, doctor, admin) use the same Supabase Auth tenant. The `profiles` table — populated by a DB trigger on every new auth user — stores the `role` field that drives all routing and RLS decisions. Laboratories use a **separate** auth context (`LabContext`) with their own table.

### Role-based routing guard

`RequireRole` (wraps patient, doctor, admin routes) checks:

1. Is there an active session? → if not, redirect to `/login`
2. Does the session role match the required role? → if not, redirect to that role's home
3. For **patients**: is `application_status = 'pending'`? → `/paciente/pending-application`; is it `'rejected'`? → `/paciente/rejected`; `null` is legacy/approved
4. For **doctors**: is `doctor_status = 'pending'` or `'rejected'`? → `/doctor/pending`
5. Has the user completed onboarding (`onboarding_completed = false`)? → show onboarding once per session (tracked in `sessionStorage`)

---

## 2. Routes Reference

### Public routes

| Route | Component | Description |
|---|---|---|
| `/` | `LandingPage` | Marketing page with hero, benefits, chat widget, mission section |
| `/login` | `LoginPage` | Email + password login; redirects authenticated users to their role home |
| `/registro` | `RegistroPage` | Role selector; `?role=patient` starts patient flow, `?role=doctor` shows doctor form |
| `/aplicar` | `AplicarPage` | 4-step patient application (personal info → health questionnaire → AI processing → confirmation) |

### Patient routes (protected — role = `patient`)

| Route | Component | Description |
|---|---|---|
| `/paciente/pending-application` | `PendingApplicationPage` | Shown while `application_status = 'pending'` |
| `/paciente/rejected` | `RejectedApplicationPage` | Shown when `application_status = 'rejected'` |
| `/paciente/onboarding` | `PatientOnboarding` | First-time welcome walkthrough |
| `/paciente/perfil` | `PerfilPage` (patient) | Profile edit, avatar, medical history, appointment feedback |
| `/paciente/agendar` | `AgendarPage` | Book a new appointment (specialty → calendar → slot) |
| `/paciente/calendario` | `CalendarioPage` | Upcoming appointments, video call join, reschedule, cancel |
| `/paciente/pastillas` | `PastillasPage` | Prescription delivery management |
| `/paciente/examenes` | `ExamenesPage` | Diagnostic exam orders, lab scheduling, result upload |
| `/paciente/referencias` | `ReferenciasPage` | Specialist referrals issued by doctors |
| `/paciente/dashboard` | — | Redirects to `/paciente/perfil` |

### Doctor routes (protected — role = `doctor`)

| Route | Component | Description |
|---|---|---|
| `/doctor/pending` | `PendingPage` | Shown while `doctor_status = 'pending'` or `'rejected'` |
| `/doctor/onboarding` | `DoctorOnboarding` | First-time welcome walkthrough |
| `/doctor/setup` | `SetupEspecialidadPage` | Initial specialty configuration |
| `/doctor/perfil` | `PerfilPage` (doctor) | Profile edit, bio, license, university |
| `/doctor/agenda` | `AgendaPage` | Appointment list, video calls, summaries, prescriptions |
| `/doctor/finanzas` | `FinanzasPage` | Earnings history from completed appointments |
| `/doctor/dashboard` | — | Redirects to `/doctor/agenda` |

### Admin routes (protected — role = `admin`)

| Route | Component | Description |
|---|---|---|
| `/admin/dashboard` | `AdminDashboard` | Full operations panel (applications, appointments, users, ratings, exams, labs, underwriting, chat IA) |

### Lab routes

| Route | Auth | Description |
|---|---|---|
| `/lab/login` | Public | Lab portal login |
| `/lab/registro` | Public | Lab registration |
| `/lab/pending` | Lab session | Awaiting admin approval |
| `/lab/rejected` | Lab session | Registration rejected |
| `/lab/dashboard` | Lab session | Overview stats |
| `/lab/ordenes` | Lab session | Manage incoming exam orders |
| `/lab/agenda` | Lab session | Lab appointment slots |
| `/lab/historial` | Lab session | Past completed exams |
| `/lab/perfil` | Lab session | Lab profile and settings |

---

## 3. User Types & Roles

### Patient

Created via `/aplicar`. Must be **approved** by admin before accessing any patient features. Application goes through AI underwriting before admin review.

**Profile fields used:** `full_name`, `email`, `phone`, `city`, `birth_date`, `delivery_address`, `avatar_url`, `onboarding_completed`, `application_status`, `applied_at`

**Entry state:** `application_status = 'pending'` → approved by admin → `application_status = 'approved'` → full access

### Doctor

Created via `/registro?role=doctor`. Must be **approved** by admin.

**Profile fields used:** `full_name`, `email`, `phone`, `specialty`, `medical_license`, `undergraduate_university`, `postgraduate_specialty`, `doctor_description`, `bio`, `avatar_url`, `doctor_status`, `onboarding_completed`

**Entry state:** `doctor_status = 'pending'` → approved → `doctor_status = 'approved'` → full access; can be rejected → `doctor_status = 'rejected'`

### Admin

Assigned manually via SQL: `UPDATE profiles SET role = 'admin' WHERE email = '...'`. No self-registration. Has unrestricted read/write to all tables via `is_admin()` RLS helper.

### Laboratory

Registered at `/lab/registro` using a **separate** auth context (`LabContext`). Stored in its own `laboratories` table, not in `profiles`. Admin approves via `admin_approve_lab` RPC.

---

## 4. Public Flows

### 4.1 Landing Page

**Route:** `/`

The page has three sections: Hero, Benefits + Chat Widget, Mission.

**Hero section:**
- "Comenzar ahora" → `/aplicar`
- "Conoce más" → smooth scrolls to `#para-pacientes`
- Navbar: "¿Eres médico?" → `/registro?role=doctor` | "Iniciar sesión" → `/login`

**Benefits section (60/40 split on desktop):**
- Left: eyebrow + title + patient/doctor toggle + benefit cards + price card
- Right: **Chat Widget** (RAG-powered, see §4.2)
- Patient toggle shows: 4 feature cards + price card ($80,000 COP/mes)
- Doctor toggle shows: 3 feature cards (agenda, payment, less admin)

**Mission section:**
- "Únete a Contigo" → `/aplicar`

### 4.2 Chat Widget (Landing Page)

**Max 5 messages** per browser session (tracked in `sessionStorage` key `contigo_chat_count`).

**Language detection:** Counts English marker words (what, how, where, the, is, etc.) in the first message. ≥2 matches → English UI; otherwise Spanish. Labels adapt for both languages.

**Message flow:**
1. Welcome message auto-displayed (no API call)
2. User types message → sent to `chat` edge function with conversation history (last 10 turns)
3. AI responds using keyword-matched document chunks + system prompt from `chat_config`
4. Counter decrements; at ≤2 remaining, counter turns amber

**After 5 messages — Lead Capture Form:**

| Field | Type | Required |
|---|---|---|
| Name | text | Yes |
| Email | email | Yes |
| Phone | text | No |

On submit:
1. Inserts into `chat_leads` (name, email, phone, last 10 conversation turns)
2. Invokes `send-email` edge function → sends to `hola@contigomedicina.com` with conversation summary
3. Shows "¡Listo! Te contactaremos pronto."

**Error state:** If Claude API fails → "Lo siento, tuve un problema técnico. Por favor intenta de nuevo."

### 4.3 Login

**Route:** `/login`

- Fields: `email` (type=email), `password`
- On submit: `supabase.auth.signInWithPassword()`
- On success: AuthContext refreshes profile → React Router redirects based on `profile.role`:
  - `patient` → `/paciente/perfil`
  - `doctor` → `/doctor/agenda`
  - `admin` → `/admin/dashboard`
  - `laboratory` → `/lab/dashboard`
- **Error:** "Correo o contraseña incorrectos." (catches Supabase auth error)
- **Redirect guard:** If already authenticated, redirects away from `/login` immediately

### 4.4 Registration Route

**Route:** `/registro`

Acts as a **router**, not a form:
- `?role=doctor` → shows Doctor Registration form
- `?role=patient` (or no param) → redirects to `/aplicar`
- "¿Eres paciente?" link navigates to `/aplicar`

### 4.5 Patient Application

**Route:** `/aplicar`

4-step wizard. User is **signed out** immediately after submitting. Cannot log in until admin approves.

#### Step 0 — Personal Information

| Field | Validation |
|---|---|
| Full name | Required |
| Email | Valid email, required |
| Phone | Required |
| City | Required |
| Delivery address | Required |
| Password | ≥6 characters |
| Confirm password | Must match password |

#### Step 1 — Health Questionnaire

| Field | Type | Notes |
|---|---|---|
| Date of birth | date | Required |
| Biological sex | select | Masculino / Femenino / Otro |
| Medical conditions | multi-checkbox | Diabetes, Hypertension, Heart disease, Active cancer, Chronic kidney disease, Chronic lung disease (COPD/severe asthma), Autoimmune disease (lupus, rheumatoid arthritis), HIV/AIDS, None of the above |
| Hospitalized in last 12 months | yes/no | |
| Hospitalization reason | textarea | Shown only if hospitalized = yes |
| Active treatment | yes/no | |
| Regular medications | yes/no | |
| Medication details | textarea | Shown only if regular_medications = yes |
| Smoking status | select | No fumo / Exfumador / Ocasional / Regular |
| Has active EPS | yes/no | EPS = Colombian public health insurer |

Validation: all fields required; conditional fields required when parent = yes.

#### Step 2 — Processing (automated, no user input)

Sequence (all happens client-side, failures handled with toast + retry):

1. `supabase.auth.signUp({ email, password })` → creates auth user
2. `supabase.from('profiles').upsert({ id, full_name, email, phone, city, delivery_address, role:'patient', application_status:'pending', applied_at:now })` — upsert handles race with DB trigger
3. `supabase.from('health_questionnaire').insert({ patient_id, ...questionnaire })`
4. `supabase.functions.invoke('underwrite-patient', { questionnaire, patient_id })` → returns `{ recommendation, probability_high_cost, cost_breakdown, ratio, risk_level, drivers, sensitivity_analysis }`
5. `supabase.from('patient_applications').insert({ patient_id, status:'pending', ai_recommendation, ai_score, ai_cost_expected_usd, ai_income_usd, ai_ratio, ai_drivers, ai_reasoning, ai_sensitivity, rulebook_version_id })`
6. Sends admin notification email
7. `supabase.auth.signOut()` — user cannot log in until approved

#### Step 3 — Confirmation

- Shows success message
- Explains 48-hour review window
- Link to `/login`

---

## 5. Patient Flows

### 5.1 Onboarding

Triggered once per user per session when `onboarding_completed = false`. A `sessionStorage` flag prevents re-showing after first dismissal within a session.

- `PatientOnboarding` component: welcome carousel/steps explaining features
- On complete: updates `profiles.onboarding_completed = true`
- Redirects to `/paciente/perfil`

### 5.2 Profile & Medical History

**Route:** `/paciente/perfil`

**Profile edit section:**
- Fields: `full_name`, `phone`, `birth_date`, `city`
- Avatar: upload to `avatars` Supabase Storage bucket; stored as public URL in `profiles.avatar_url`
- Save → `supabase.from('profiles').update(...)` + `refreshProfile()`

**Medical history section:**
- Fetches completed appointments: `status='confirmed'`, `completed=true`, with `prescriptions(id, prescription_items(...))`
- Sorted descending by slot date
- Each card shows: doctor name + specialty, date, appointment summary text, list of prescribed medications
- Badge "No atendida" if `summary = "Cita no atendida - cerrada automáticamente"` (set by scheduled reminder function)

**Feedback / Rating:**
- Available only for completed appointments without existing feedback and not "no atendida"
- Opens `FeedbackModal`: star rating (1–5) + optional comment textarea
- Saves to `appointment_feedback` table
- On success: toast "¡Gracias por tu calificación!"
- After rating, stars display replaces the "Rate" button

### 5.3 Booking an Appointment

**Route:** `/paciente/agendar`

#### Step 1 — Specialty selection

Calls `checkBookingAccess(patientId, specialty)` utility for each specialty. Returns:

| Result | Condition |
|---|---|
| `allowed` | No restrictions |
| `needs_referral` | Specialist requires a referral from a general medicine doctor that the patient doesn't have yet |
| `already_booked` | Patient has an active (confirmed, not completed) appointment in this specialty |
| `needs_general_first` | Patient has never had a general medicine appointment |

- `medicina_general`: always accessible
- Specialties shown with lock icon + tooltip if access blocked
- Blocked specialties are still rendered but non-clickable

#### Step 2 — Date selection (MiniCalendar)

- Fetches all `availability_slots` where `is_booked = false` and `date >= today` and `doctor.specialty = selected_specialty`
- Dots on calendar indicate dates with available slots
- Clicking a date fetches slots for that date

#### Step 3 — Time slot selection

- Shows time slots as buttons grouped by doctor
- Each slot shows: start_time, doctor full name, doctor avatar initials
- Optional pre-visit file upload (PDF, images, etc. up to 10 MB)
  - Uploaded to `diagnostic-files` storage, tagged `stage: 'pre_appointment'`

#### Booking confirmation

- `supabase.from('appointments').insert({ patient_id, doctor_id, slot_id, status:'confirmed', reason })`
- DB trigger `mark_slot_booked` sets `availability_slots.is_booked = true`
- Sends confirmation email to patient and doctor via `send-email`
- Toast: "Cita confirmada"
- Redirects to `/paciente/calendario`

**Double-booking prevention:** Before inserting, checks if patient already has a confirmed, incomplete appointment with any doctor of the same specialty. If found, shows error toast and blocks booking.

### 5.4 Calendar & Video Calls

**Route:** `/paciente/calendario`

**Appointment list:**
- Fetches `appointments` where `patient_id = me`, `status = 'confirmed'`, `completed = false`
- Joined with `slot`, `doctor` profile
- Sorted ascending by slot date + start_time

**Per-appointment actions:**

| Action | Available when | Behavior |
|---|---|---|
| Ver detalles | Always | Expands modal with full info |
| Unirse a videollamada | ≤5 min before slot start | Opens `PatientVideoCall` component |
| Reagendar | >24h before slot | Opens reschedule modal |
| Cancelar | Always | Confirmation modal → sets status='cancelled', trigger frees slot |

**Video call setup:**
1. On page load, for appointments ≤10 min away: calls `createDailyRoom(appointmentId)` → `daily-proxy` edge function creates room and stores `daily_room_name` + `daily_room_url` in appointment
2. Idempotent: if `daily_room_url` already exists, skips creation
3. Patient calls `createDailyToken(roomName, false)` (isDoctor=false)
4. `PatientVideoCall` takes `roomUrl` + `token` props:
   - Remote video (doctor) displayed large
   - Local video (patient) shown as small corner overlay
   - Audio played via hidden `<audio>` element
   - Transcript shown in sidebar (from `transcription-message` Daily events)
   - "Abandonar llamada" button → leaves call + navigates back

**Reschedule flow:**
1. Fetches available slots for same specialty
2. Patient selects new date + time
3. Inserts new appointment with new slot
4. Updates old appointment: `status = 'cancelled'` → trigger frees old slot
5. Sends reschedule email to both parties

### 5.5 Prescriptions

**Route:** `/paciente/pastillas`

**Pending prescriptions** (`status = 'pendiente'`):
- Card shows: doctor name, appointment date, list of medicines (name + dose + instructions)
- "Confirmar entrega" button opens modal

**Delivery confirmation modal:**

| Field | Notes |
|---|---|
| Delivery address | Textarea, pre-filled from `profiles.delivery_address` |
| Save as default | Checkbox; if checked, updates `profiles.delivery_address` |

On confirm:
- `prescriptions.update({ status:'en_camino', confirmed_at:now, delivery_address })`
- If "save as default": `profiles.update({ delivery_address })`

**In-transit prescriptions** (`status = 'en_camino'`):
- Read-only card showing delivery address and date confirmed

### 5.6 Diagnostic Exams

**Route:** `/paciente/examenes`

**Pending/Scheduled exams** (`status = 'pending'` or `'scheduled'`):
- Card shows: exam type, ordering doctor, notes
- "Agendar en laboratorio" button (only for pending)

**Schedule at lab modal:**
1. Calls `get_real_labs_for_patient(city, exam_type)` RPC → finds labs in patient's city that offer the exam
2. Shows available lab slots (lab name, date, time)
3. Patient selects slot → `schedule_lab_appointment()` RPC
4. `diagnostic_orders.update({ status:'scheduled' })`
5. Toast: "Examen agendado en {lab}"

**Upload results** (for scheduled exams):
- File input (max 10 MB, any file type)
- Uploads to `diagnostic-files` storage, tagged `stage: 'result'`
- Inserts `diagnostic_files` record with `diagnostic_order_id`
- `diagnostic_orders.update({ status:'completed' })`
- Sends email to ordering doctor with file link

**Completed exams** (`status = 'completed'`):
- Shows date, lab name, download link for result file

### 5.7 Specialist Referrals

**Route:** `/paciente/referencias`

- Lists `specialist_referrals` where `patient_id = me`
- Each referral: specialty, urgency level, notes from doctor, issuing date
- Referral is the prerequisite that unlocks specialist booking in `/paciente/agendar`

### 5.8 Pending Application Page

**Route:** `/paciente/pending-application`

Shown when `application_status = 'pending'`. Contains:
- Message explaining the review process
- Expected timeline (48 hours)
- Contact email for questions
- Sign-out button

No navigation to any other patient page — RequireRole blocks all `/paciente/*` routes except this one.

### 5.9 Rejected Application Page

**Route:** `/paciente/rejected`

Shown when `application_status = 'rejected'`. Contains:
- Explanation that the current plan doesn't match their profile
- `reapply_after` date from `patient_applications` (shown when available)
- Contact email
- Sign-out button

---

## 6. Doctor Flows

### 6.1 Registration

**Route:** `/registro?role=doctor`

| Field | Validation |
|---|---|
| Full name | Required |
| Email | Valid email |
| Phone | Required |
| Specialty | Required (dropdown) |
| Undergraduate university | Required |
| Medical license (Tarjeta Profesional) | Required |
| Password | ≥6 characters |
| Confirm password | Must match |

On submit:
1. `supabase.auth.signUp()`
2. `profiles.upsert({ role:'doctor', doctor_status:'pending', specialty, undergraduate_university, medical_license })`
3. Admin notification email sent
4. Redirects to `/doctor/pending` (gated by RequireRole)

### 6.2 Onboarding

Triggered when `onboarding_completed = false` (same session-flag mechanism as patient).
- `DoctorOnboarding` component: welcome steps
- On complete: `profiles.update({ onboarding_completed: true })`

### 6.3 Pending / Rejected State

**Route:** `/doctor/pending`

Shown when `doctor_status = 'pending'` or `'rejected'`. Displays:
- For **pending**: "Tu cuenta está siendo revisada"
- For **rejected**: rejection reason from `profiles.rejection_reason`

Doctor cannot access any other doctor route until `doctor_status = 'approved'`.

### 6.4 Profile

**Route:** `/doctor/perfil`

Edit fields: `full_name`, `phone`, `birth_date`, `city`, `specialty`, `medical_license`, `undergraduate_university`, `postgraduate_specialty`, `bio`, `doctor_description`, `avatar_url` (upload)

Read-only: `email`

### 6.5 Agenda (Main Work Screen)

**Route:** `/doctor/agenda`

**Appointment list:**
- Fetches `appointments` where `doctor_id = me`, `status = 'confirmed'`, `completed = false`
- Joined with `patient` profile and `slot`
- Sorted ascending by date

**Per-appointment modal (click to open):**
- Patient name, age, phone
- Appointment reason
- Health questionnaire preview (if available)
- Past prescriptions for this patient
- Actions: Join video, Mark complete, Order exam, Issue referral

**Joining a video call:**
1. Calls `createDailyRoom(appointmentId)` if no room yet (idempotent)
2. Calls `createDailyToken(roomName, true)` (isDoctor=true, is_owner=true in Daily)
3. Opens `DoctorVideoCall` component:

   **DoctorVideoCall layout** (split screen):
   - Left: video feed (remote = patient large; local = corner)
   - Right: transcript panel + notes textarea
   - Header: "🔴 Grabando" badge during active call
   - Deepgram transcription: `startLocal(stream, onUpdate)` + `addRemote(stream, onUpdate)` create live transcript
   - "Finalizar consulta" button → transitions to `processing` phase

   **Post-call phases:**
   - `processing`: spinner while `claude-summary` edge function analyzes full transcript → returns `{ resumen, medicamentos[], examenes[], referencias[], control }`
   - `review`: pre-filled form with AI summary + medication list; doctor can edit; "Guardar y completar" button
   - `done`: success → `onComplete()` callback closes video, refreshes agenda

**Completing an appointment (from agenda modal or post-video review):**

Opens completion modal:

| Section | Fields |
|---|---|
| Summary | Textarea (pre-filled by AI if from video) |
| Medications | Dynamic rows: medicine_name, dose, instructions; "No recetar" checkbox |
| Mark completed | Checkbox + submit |

Rules:
- Must have ≥1 medication row OR check "No recetar" to proceed
- On submit:
  1. `appointments.update({ completed:true, completed_at:now, summary })`
  2. If medications: `prescriptions.insert({ patient_id, doctor_id, status:'pendiente' })` + `prescription_items.insert(...)` for each med
  3. `doctor_earnings.insert({ doctor_id, appointment_id, amount })` (fixed amount per appointment)
  4. Sends completion email to patient with summary

**Ordering diagnostic exams:**
- From appointment modal: form with `exam_type` (dropdown) + `notes`
- `diagnostic_orders.insert({ patient_id, doctor_id, appointment_id, exam_type, status:'pending', notes })`
- Patient sees it in `/paciente/examenes`

**Issuing referrals:**
- From appointment modal: specialty dropdown + urgency (normal/urgent) + notes
- `specialist_referrals.insert({ patient_id, doctor_id, specialty, urgency, notes })`
- Unlocks specialist booking for patient in `/paciente/agendar`
- Scheduled reminder function sends follow-up email if no appointment booked within N days

**Managing availability slots:**
- Doctor creates slots: date, start_time, end_time (generated into 30-min blocks)
- `generateSlots(date, start, end)` utility creates `{ date, start_time, end_time }` objects for each 30-min window
- `roundUpToSlot(time)` / `roundDownToSlot(time)` enforce :00/:30 boundaries
- Slots inserted into `availability_slots` with `doctor_id`, `specialty`, `is_booked:false`
- Booked slots cannot be deleted (guard check)
- `mark_slot_booked` trigger fires on appointment insert
- `mark_slot_unbooked` trigger fires on appointment update to 'cancelled'

### 6.6 Financials

**Route:** `/doctor/finanzas`

- Fetches `doctor_earnings` where `doctor_id = me`, joined with `appointment` + `patient` profile + `slot`
- Shows per-appointment earnings: patient name, date, amount
- Shows total earnings at top
- Read-only; no actions

---

## 7. Admin Flows

### 7.1 Admin Dashboard Overview

**Route:** `/admin/dashboard`

Stats bar (top): Patients count, Doctors count, Total appointments, Active appointments, Referrals this month, Top referred specialty.

Pending doctors section (above tabs): Always-visible alert if any doctor has `doctor_status = 'pending'` — inline approve / reject buttons.

**8 tabs:**

| Tab | Content |
|---|---|
| Aplicaciones | Patient application review with AI underwriting |
| Citas | All appointments table with cancel action |
| Usuarios | All users with role management |
| Calificaciones | Appointment feedback and doctor ratings |
| Exámenes | All diagnostic orders |
| Laboratorios | Lab registration approvals |
| Underwriting | AI rulebook configuration |
| Chat IA | Chat widget documents, prompt, simulator, leads |

### 7.2 Patient Applications Tab

Two sub-tabs: **Pendientes** / **Historial**

**Pending application card shows:**
- Patient name, email, city, phone
- Time since submission + "¡Vencida!" if >48h
- AI recommendation badge: APROBAR (green) / REVISAR (amber) / RECHAZAR (red)
- AI ratio badge (cost/income ratio) — green ≤1.0, amber ≤2.0, red >2.0
- AI risk level: bajo / medio / alto
- Cost breakdown (consultations, medications, exams)
- Key risk drivers with explanations
- Sensitivity analysis table (breakeven scenarios)
- "Ver cuestionario" toggle showing full health questionnaire answers
- Approve / Reject buttons

**Approve flow:**
1. `patient_applications.update({ status:'approved', reviewed_at, reviewed_by })`
2. `profiles.update({ application_status:'approved' })`
3. Sends approval email to patient

**Reject flow:**
1. Admin types optional rejection note
2. `patient_applications.update({ status:'rejected', reviewed_at, reviewed_by, admin_note, reapply_after (today+6 months) })`
3. `profiles.update({ application_status:'rejected' })`
4. Sends rejection email to patient with reapply date

**Historial sub-tab:**
- All non-pending applications, filterable by approved/rejected and searchable by patient name/email
- Same card layout, no actions (read-only)

### 7.3 Doctor Approval (Persistent Section)

Appears above tabs whenever there are pending doctors.

**Approve:**
- `profiles.update({ doctor_status:'approved', approved_at:now })`
- Sends approval email to doctor

**Reject:**
- Modal with optional rejection reason textarea
- `profiles.update({ doctor_status:'rejected', rejected_at:now, rejection_reason })`
- Sends rejection email to doctor with reason

### 7.4 Appointments Tab

Table of all appointments:
- Columns: Patient, Doctor, Date & Time, Status, Action
- Action: "Cancelar" button for confirmed appointments
- Cancel: `appointments.update({ status:'cancelled' })` → trigger frees slot

### 7.5 Users Tab

Searchable, filterable table of all profiles.

**Filters:** Role dropdown (All / Patient / Doctor / Admin / Lab)  
**Search:** By name or email

Per-user actions:
- "Ver detalles" → modal with full profile info + appointment count
- Role selector dropdown → triggers role change

**Role change flow:**
- Confirmation modal for all changes
- Extra guard for admin promotion: must type "CONFIRMAR" in text field
- `profiles.update({ role: newRole })`

### 7.6 Ratings Tab

- Lists all `appointment_feedback` records
- Shows patient name, doctor name, appointment date, star rating, comment
- Average rating stat at top

### 7.7 Exams Tab

Table of all `diagnostic_orders`:
- Columns: Patient, Doctor, Exam type, Status, Date
- Status badges: Pendiente (orange), Agendado (blue), Completado (green)
- Read-only

### 7.8 Labs Tab

Approval workflow for lab registrations.

**Per-lab card:**
- Lab name, type (Lab / Imaging / Both), city, phone, email
- Exam count, completed count
- Document links: Cámara de Comercio, Habilitación Supersalud, RUT
- Approve / Reject / Ver detalles buttons

**Approve:** `admin_approve_lab` RPC → sends approval email  
**Reject:** Modal with optional reason → `admin_reject_lab` RPC → sends rejection email

### 7.9 Underwriting Tab

Three sub-tabs: **Config** / **Simulator** / **Historial de versiones**

**Config sub-tab — Rulebook editor:**

| Parameter | Default | Description |
|---|---|---|
| Cost per consultation (USD) | $40 | Expected cost per general consult |
| Cost per medication (USD) | $8 | Expected monthly medication cost |
| Cost per exam (USD) | $12 | Expected cost per diagnostic exam |
| Monthly income (USD) | $19 | Revenue per patient per month |
| Threshold review | 1.0 | Ratio above which → "review" |
| Threshold reject | 2.0 | Ratio above which → "reject" |
| AI instructions | Text | Additional context for Claude underwriting prompt |
| Version name | Text | Label for this version (e.g. "v2 - Q2 2026") |

Save creates a **new** version (never overwrites), deactivates all others, activates the new one.

**Simulator sub-tab:**
- Enter any patient profile (age, sex, conditions, etc.)
- Select which rulebook to test against
- Calls `underwrite-patient` edge function with `simulate:true` flag
- Shows full AI analysis result without saving anything

**Historial sub-tab:**
- Lists all rulebook versions with date, name, status (active/inactive)
- "Activar" button on any version → deactivates others, activates selected
- "Comparar" toggle shows diff between two selected versions

### 7.10 Chat IA Tab

Four sub-tabs: **Documentos** / **Prompt del sistema** / **Simulador** / **Leads**

**Documentos sub-tab:**
- Drag & drop upload zone (or click to browse)
- Accepted formats: PDF, DOCX, TXT; max 10 MB each; multiple files at once
- On upload:
  1. File uploaded to `chat-documents` Storage bucket at path `{uuid}/{filename}`
  2. Record inserted into `chat_documents` with `status:'processing'`
  3. `process-document` edge function invoked with `document_id`
  4. Auto-polls every 3 seconds while any document shows `status='processing'`
- Document list shows: filename, file size, chunk count, status badge, upload date
- Status badges: ⏳ Procesando / ✅ Listo / ❌ Error
- "Reintentar" button on errored documents (re-invokes edge function)
- "🗑️ Eliminar" with confirmation modal and warning: "Eliminar este documento reducirá la información disponible para el chatbot" → removes from Storage + DB (chunks auto-cascade)

**Prompt del sistema sub-tab:**
- Large textarea with current active system prompt
- Character counter
- "Variables inyectadas automáticamente" hint section
- "💾 Guardar prompt" → updates `chat_config` record
- "Restaurar por defecto" → resets textarea to hardcoded default (does not save automatically)
- "🧪 Probar en simulador →" → switches to Simulator sub-tab

**Simulador sub-tab:**
- Split layout: left = current prompt preview (read-only), right = mini chat
- Toggle: "Usar prompt sin guardar" → passes current textarea text as `custom_system_prompt` to `chat` edge function
- Mini chat uses same `chat` edge function as the landing page widget
- Conversation history tracked in a `useRef` per session

**Leads sub-tab:**
- Table: Name, Email, Phone, Date, "Ver conversación" button
- "Ver conversación" opens modal showing the stored JSONB conversation (last 10 messages)
- "Exportar CSV" → downloads `leads_chat.csv` with Name, Email, Phone, Date columns

---

## 8. Laboratory Flows

### 8.1 Lab Registration

**Route:** `/lab/registro`

| Field | Notes |
|---|---|
| Lab name | Required |
| Address | Required |
| City | Required |
| Phone | Required |
| Email | Required |
| Type | dropdown: laboratorio / imagenes / ambos |
| Password | Required |
| Documents | Cámara de Comercio PDF, Habilitación Supersalud PDF, RUT PDF (all optional but visible to admin) |

Creates lab record with `status='pending'`. Redirects to `/lab/pending`.

### 8.2 Lab Login

**Route:** `/lab/login`

- Separate from main app login
- Uses `LabContext` (not `AuthContext`)
- On success: redirects to `/lab/dashboard`

### 8.3 Lab Pending / Rejected

- `/lab/pending`: shown while `status = 'pending'`; "Waiting for admin approval" message
- `/lab/rejected`: shown when `status = 'rejected'`; shows rejection reason if provided

### 8.4 Lab Dashboard

- Overview stats: total exams, scheduled exams, completed exams today
- Quick navigation to orders and schedule

### 8.5 Exam Orders

**Route:** `/lab/ordenes`

- Lists `diagnostic_orders` assigned to this lab
- Filter by status: pending, scheduled, completed
- Per-order actions:
  - "Confirmar" (pending → scheduled)
  - "Completar" (scheduled → completed) — requires uploading result file
  - Result file upload → stored in `diagnostic-files`, triggers email to ordering doctor

### 8.6 Lab Schedule

**Route:** `/lab/agenda`

- Calendar view of upcoming lab appointments
- Create availability slots for specific exam types
- View scheduled patient appointments

### 8.7 Lab History

**Route:** `/lab/historial`

- Table of all completed exams
- Filterable by date range and exam type
- Download link per completed exam result

### 8.8 Lab Profile

**Route:** `/lab/perfil`

Edit: lab name, address, city, phone, exam types offered, operating hours.

---

## 9. Forms Reference

| Form | Route | Fields | Submit action |
|---|---|---|---|
| Login | `/login` | email, password | `supabase.auth.signInWithPassword` |
| Doctor registration | `/registro?role=doctor` | full_name, email, phone, specialty, undergraduate_university, medical_license, password, confirm_password | Create auth user + profile |
| Patient application — personal | `/aplicar` step 0 | full_name, email, phone, city, delivery_address, password, confirm_password | Local state |
| Patient application — health | `/aplicar` step 1 | date_of_birth, biological_sex, conditions[], hospitalized_last_12m, hospitalization_reason?, active_treatment, regular_medications, medications_detail?, smoking_status, has_eps | Local state |
| Patient profile edit | `/paciente/perfil` | full_name, phone, birth_date, city, avatar | `profiles.update` |
| Book appointment | `/paciente/agendar` | specialty (step 1), date (step 2), slot_id + reason + optional file (step 3) | `appointments.insert` |
| Reschedule appointment | `/paciente/calendario` modal | new slot_id | `appointments.insert` + cancel old |
| Delivery address confirmation | `/paciente/pastillas` modal | delivery_address, save_as_default | `prescriptions.update` |
| Exam result upload | `/paciente/examenes` | file | Storage upload + `diagnostic_orders.update` |
| Appointment feedback | `/paciente/perfil` modal | rating (1–5), comment | `appointment_feedback.insert` |
| Doctor profile edit | `/doctor/perfil` | full_name, phone, birth_date, specialty, medical_license, undergraduate_university, postgraduate_specialty, bio, doctor_description, avatar | `profiles.update` |
| Appointment completion | `/doctor/agenda` modal | summary, medications[]{medicine_name, dose, instructions}, no_prescribe_checkbox | `appointments.update` + `prescriptions.insert` + `prescription_items.insert` + `doctor_earnings.insert` |
| Order exam | `/doctor/agenda` modal | exam_type, notes | `diagnostic_orders.insert` |
| Issue referral | `/doctor/agenda` modal | specialty, urgency, notes | `specialist_referrals.insert` |
| Create availability | `/doctor/agenda` | date, start_time, end_time | `availability_slots.insert` (batch) |
| App reject (admin) | `/admin/dashboard` modal | admin_note (optional) | `patient_applications.update` + `profiles.update` |
| Doctor reject (admin) | `/admin/dashboard` modal | rejection_reason (optional) | `profiles.update` |
| Lab reject (admin) | `/admin/dashboard` modal | rejection_reason (optional) | `admin_reject_lab` RPC |
| Role change confirm (admin) | `/admin/dashboard` modal | CONFIRMAR (typed, admin only) | `profiles.update` |
| Underwriting rulebook | `/admin/dashboard` | 8 parameters + version_name | `underwriting_rulebooks.insert` |
| Underwriting simulator | `/admin/dashboard` | age, sex, conditions[], hospitalized, treatment, meds, smoking, eps, rulebook_id | `underwrite-patient` invoke |
| System prompt edit | `/admin/dashboard` Chat IA tab | system_prompt textarea | `chat_config.update` |
| Chat lead capture | Landing page | name, email, phone (optional) | `chat_leads.insert` + `send-email` invoke |
| Lab registration | `/lab/registro` | name, address, city, phone, email, type, password, documents | Lab record insert |

---

## 10. Email Notifications

All emails are sent via the `send-email` edge function using the Resend API. Sender: `Contigo <noreply@contigomedicina.com>`

### Transactional emails (triggered immediately)

| Trigger | Recipient | Subject | Content |
|---|---|---|---|
| Doctor registers | Admin | "🩺 Nuevo médico pendiente de aprobación — Contigo" | Doctor name, specialty, university, license; link to admin dashboard |
| Doctor approved | Doctor | "✅ Tu cuenta ha sido aprobada — Contigo" | Welcome message + login link |
| Doctor rejected | Doctor | "Tu solicitud en Contigo" | Rejection reason (if any) + contact email |
| Patient application submitted | Admin | (notification email) | Patient name, email; link to admin dashboard |
| Patient approved | Patient | "✅ ¡Tu aplicación fue aprobada! — Contigo" | Welcome message + login link |
| Patient rejected | Patient | "Tu aplicación en Contigo" | Rejection explanation + reapply date + contact email |
| Appointment booked | Patient | "✅ Tu cita ha sido confirmada — Contigo" | Doctor name, specialty, date/time |
| Appointment booked | Doctor | "📅 Nueva cita agendada — Contigo" | Patient name, specialty, date/time |
| Appointment cancelled (by patient) | Doctor | "Cita cancelada — Contigo" | Patient name, date/time that was cancelled |
| Appointment completed | Patient | (completion notification) | Summary text + medication list |
| Appointment rescheduled | Patient | (reschedule confirmation) | New date/time |
| Appointment rescheduled | Doctor | (reschedule notification) | Patient name, new date/time |
| Exam result uploaded | Doctor | (result notification) | Patient name, exam type, download link |
| Lab registered | Admin | "🔬 Nuevo laboratorio pendiente — Contigo" | Lab name, city, type |
| Lab approved | Lab | "✅ Tu centro ha sido aprobado — Contigo" | Lab name + lab portal link |
| Lab rejected | Lab | "Tu solicitud en Contigo" | Rejection reason (if any) + contact email |
| Chat lead submitted | Admin (`hola@contigomedicina.com`) | "💬 Nuevo lead del chat — Contigo" | Lead name, email, phone + last 5 conversation messages |

### Scheduled emails (triggered by `appointment-reminders` edge function)

The `appointment-reminders` function runs on a schedule (cron). It:

1. **Auto-closes past appointments:** Any confirmed, non-completed appointment whose slot time has passed gets marked `completed = true`, `summary = "Cita no atendida - cerrada automáticamente"`. No email sent.

2. **24-hour reminders:** For appointments in the 23.5–24.5 hour window:

| Recipient | Subject | Content |
|---|---|---|
| Patient | "⏰ Recordatorio: Tu cita es mañana — Contigo" | Doctor name, specialty, date/time |
| Doctor | "📅 Recordatorio: Tienes una cita mañana — Contigo" | Patient name, specialty, date/time |

   Only sent if `appointments.reminder_sent = false`; sets it to `true` after sending.

3. **Follow-up referral reminders:** For specialist_referrals where no appointment has been booked after a configured window:

| Recipient | Subject | Content |
|---|---|---|
| Patient | (follow-up reminder) | Specialty, urgency, reminder to book |

4. **Pending application alert:** If any application has been pending for >44 hours:

| Recipient | Subject | Content |
|---|---|---|
| Admin | "⚠️ Aplicaciones pendientes — Contigo" | Count of overdue applications + link to dashboard |

---

## 11. Edge Cases & Error States

### Authentication & Access

| Scenario | Behavior |
|---|---|
| Unauthenticated user visits `/paciente/*` | RequireRole redirects to `/login` |
| Doctor visits `/paciente/*` | RequireRole redirects to `/doctor/agenda` |
| Patient visits `/doctor/*` | RequireRole redirects to `/paciente/perfil` |
| Authenticated user visits `/login` | Redirected to role home immediately |
| Session expired mid-session | AuthContext catches auth state change → clears profile → UI shows loading, then redirects to `/login` |
| Patient with `application_status='pending'` tries any patient route | Redirected to `/paciente/pending-application` |
| Patient with `application_status='rejected'` tries any patient route | Redirected to `/paciente/rejected` |
| Doctor with `doctor_status='pending'` tries any doctor route | Redirected to `/doctor/pending` |
| Patient with `application_status=null` (legacy/pre-underwriting) | Treated as approved, full access |

### Application & Underwriting

| Scenario | Behavior |
|---|---|
| AI underwriting edge function fails | Error toast on step 2; user can retry |
| `signUp` email already in use | Supabase returns error → shown as form error |
| Profile upsert race condition (trigger creates partial profile) | Handled with upsert ON CONFLICT for id |
| User tries to log in before approved | Login succeeds but RequireRole gate redirects to pending/rejected page |
| AI returns non-JSON response | `underwrite-patient` tries to repair JSON, falls back to manual review recommendation |

### Appointment Booking

| Scenario | Behavior |
|---|---|
| Patient tries to book same specialty twice | `checkBookingAccess` returns `already_booked`; specialty shown as locked |
| Specialist booking without referral | `checkBookingAccess` returns `needs_referral`; blocked with tooltip |
| Specialist booking without any prior general medicine appointment | Returns `needs_general_first`; blocked |
| All slots for a date get booked while user is on booking screen | Insert fails with constraint error; toast "Ese horario ya no está disponible" |
| Doctor deletes a slot after patient is viewing it | Insert fails; patient shown error |
| Booking confirmation email fails | Caught silently (non-critical); appointment is still created |

### Video Calls

| Scenario | Behavior |
|---|---|
| Daily.co room creation fails | Error shown; fallback to manual notes textarea in DoctorVideoCall |
| `daily_room_url` already exists | `createDailyRoom` is idempotent; returns existing room info |
| Patient joins before doctor | Both enter same room; patient waits with empty remote video |
| Deepgram transcription unavailable | Falls back to manual textarea; no transcript shown |
| Join button visible too early (>5 min before) | Button disabled/hidden; countdown shown |
| Network disconnect during call | Daily.co event `left-meeting` fires; UI shows error state |
| Claude summary fails | `processing` phase shows error; doctor can manually type summary |

### Prescriptions & Medications

| Scenario | Behavior |
|---|---|
| Doctor tries to complete appointment without medications | Must either add ≥1 medication row OR check "No recetar" |
| Patient has no delivery address saved | Textarea in delivery modal is empty; patient must enter address |
| Prescription already `en_camino` | "Confirmar entrega" button hidden; read-only card shown |

### Diagnostic Exams

| Scenario | Behavior |
|---|---|
| No labs found in patient's city for exam type | Modal shows "No hay laboratorios disponibles en tu ciudad" |
| File upload >10 MB | Validation blocks upload before request; error toast |
| Result file upload fails | Error toast; exam remains `scheduled`; can retry |

### Admin Operations

| Scenario | Behavior |
|---|---|
| Admin tries to change own role | Guard in `handleRoleChange`; shows warning |
| Admin promotes another user to admin without typing "CONFIRMAR" | Button stays disabled |
| Cancelling an appointment that's already cancelled | Update is idempotent; no error |
| Application >48h with no review | `appointment-reminders` sends alert email to admin |

### Chat Widget

| Scenario | Behavior |
|---|---|
| No documents uploaded yet | Claude told "no documents available" in system prompt; responds with "no information available" message |
| Chat edge function rate limited (>10 req/IP/min) | Returns HTTP 429; widget shows error message |
| Claude API key missing or invalid | Edge function returns 500; widget shows "problema técnico" message |
| Lead form submitted with invalid email | Browser `type="email"` validation blocks submit |
| User reopens tab | `sessionStorage` count persists within same browser session; count resets on new tab |

### Documents (Admin Chat IA)

| Scenario | Behavior |
|---|---|
| PDF text extraction fails | `process-document` marks document `status='error'`; admin can retry |
| DOCX mammoth parse error | Falls back to error; admin can retry |
| File >10 MB uploaded | Client-side guard blocks upload before any storage call |
| Unsupported file type | Client-side guard blocks; toast shown |
| Storage upload fails | Error toast; no DB record created |

---

## 12. Database Schema Reference

### Core tables

**`profiles`**
```
id                      uuid (PK, = auth.users.id)
full_name               text
email                   text
role                    text  CHECK IN ('patient','doctor','admin','laboratory')
phone                   text
city                    text
birth_date              date
avatar_url              text
delivery_address        text
bio                     text
specialty               text  (doctors)
medical_license         text  (doctors)
undergraduate_university text (doctors)
postgraduate_specialty  text  (doctors)
doctor_description      text  (doctors)
doctor_status           text  CHECK IN ('pending','approved','rejected')  DEFAULT NULL
approved_at             timestamptz
rejected_at             timestamptz
rejection_reason        text
application_status      text  CHECK IN ('pending','approved','rejected')  DEFAULT NULL
applied_at              timestamptz
onboarding_completed    boolean DEFAULT false
created_at              timestamptz
```

**`availability_slots`**
```
id          uuid PK
doctor_id   uuid FK→profiles
date        date
start_time  time
end_time    time
is_booked   boolean DEFAULT false
specialty   text
created_at  timestamptz
```

**`appointments`**
```
id              uuid PK
patient_id      uuid FK→profiles
doctor_id       uuid FK→profiles
slot_id         uuid FK→availability_slots
status          text  CHECK IN ('confirmed','cancelled')
reason          text
summary         text
completed       boolean DEFAULT false
completed_at    timestamptz
daily_room_name text
daily_room_url  text
room_created_at timestamptz
reminder_sent   boolean DEFAULT false
created_at      timestamptz
```

**`prescriptions`**
```
id               uuid PK
appointment_id   uuid FK→appointments
patient_id       uuid FK→profiles
doctor_id        uuid FK→profiles
status           text  CHECK IN ('pendiente','en_camino')
delivery_address text
confirmed_at     timestamptz
created_at       timestamptz
```

**`prescription_items`**
```
id              uuid PK
prescription_id uuid FK→prescriptions (ON DELETE CASCADE)
medicine_name   text
dose            text
instructions    text
created_at      timestamptz
```

**`diagnostic_orders`**
```
id             uuid PK
patient_id     uuid FK→profiles
doctor_id      uuid FK→profiles
appointment_id uuid FK→appointments
exam_type      text
status         text  CHECK IN ('pending','scheduled','completed')
notes          text
created_at     timestamptz
```

**`diagnostic_files`**
```
id                  uuid PK
appointment_id      uuid FK→appointments
diagnostic_order_id uuid FK→diagnostic_orders
patient_id          uuid FK→profiles
file_url            text
file_name           text
file_size           text
stage               text  CHECK IN ('pre_appointment','during_call','result')
uploaded_at         timestamptz
```

**`specialist_referrals`**
```
id             uuid PK
patient_id     uuid FK→profiles
doctor_id      uuid FK→profiles
appointment_id uuid FK→appointments
specialty      text
urgency        text
notes          text
follow_up_sent boolean DEFAULT false
created_at     timestamptz
```

**`appointment_feedback`**
```
id             uuid PK
appointment_id uuid FK→appointments
patient_id     uuid FK→profiles
doctor_id      uuid FK→profiles
rating         integer CHECK (rating BETWEEN 1 AND 5)
comment        text
created_at     timestamptz
```

**`doctor_earnings`**
```
id             uuid PK
doctor_id      uuid FK→profiles
appointment_id uuid FK→appointments
amount         numeric
created_at     timestamptz
```

### Underwriting tables

**`underwriting_rulebooks`**
```
id                        uuid PK
version                   integer
name                      text
is_active                 boolean DEFAULT false
cost_per_consultation_usd numeric DEFAULT 40
cost_per_medication_usd   numeric DEFAULT 8
cost_per_exam_usd         numeric DEFAULT 12
monthly_income_usd        numeric DEFAULT 19
threshold_review          numeric DEFAULT 1.0
threshold_reject          numeric DEFAULT 2.0
ai_instructions           text
created_by                uuid FK→profiles
created_at                timestamptz
notes                     text
```

**`health_questionnaire`**
```
id                     uuid PK
patient_id             uuid FK→profiles UNIQUE
date_of_birth          date
biological_sex         text  CHECK IN ('masculino','femenino','otro')
conditions             text[]
hospitalized_last_12m  boolean DEFAULT false
hospitalization_reason text
active_treatment       boolean DEFAULT false
regular_medications    boolean DEFAULT false
medications_detail     text
smoking_status         text  CHECK IN ('no_fumo','exfumador','ocasional','regular')
has_eps                boolean DEFAULT false
created_at             timestamptz
```

**`patient_applications`**
```
id                   uuid PK
patient_id           uuid FK→profiles
status               text  CHECK IN ('pending','approved','rejected')
submitted_at         timestamptz
reviewed_at          timestamptz
reviewed_by          uuid FK→profiles
admin_note           text
reapply_after        date
ai_recommendation    text  CHECK IN ('approve','review','reject')
ai_score             numeric
ai_cost_expected_usd numeric
ai_income_usd        numeric DEFAULT 57
ai_ratio             numeric
ai_drivers           jsonb
ai_reasoning         text
ai_sensitivity       jsonb
rulebook_version_id  uuid FK→underwriting_rulebooks
created_at           timestamptz
```

### Chat tables

**`chat_documents`**
```
id           uuid PK
name         text
file_url     text  (storage path: {uuid}/{filename})
file_name    text
file_type    text  (pdf / docx / txt)
file_size    text  (formatted: "2.3 MB")
content_text text  (first 10,000 chars)
chunk_count  integer DEFAULT 0
status       text  CHECK IN ('processing','ready','error')
uploaded_by  uuid FK→profiles
created_at   timestamptz
```

**`chat_document_chunks`**
```
id          uuid PK
document_id uuid FK→chat_documents (ON DELETE CASCADE)
chunk_index integer
content     text  (~500 chars each, 50-char overlap)
created_at  timestamptz
```

**`chat_config`**
```
id            uuid PK
system_prompt text
is_active     boolean DEFAULT true
updated_by    uuid FK→profiles
updated_at    timestamptz
```

**`chat_leads`**
```
id           uuid PK
name         text
email        text
phone        text
conversation jsonb  (array of {role, content} last 10 messages)
created_at   timestamptz
```

### DB triggers

| Trigger | On | Action |
|---|---|---|
| `handle_new_user` | INSERT on `auth.users` | Creates partial profile row (id, email) in `profiles` |
| `mark_slot_booked` | INSERT on `appointments` | Sets `availability_slots.is_booked = true` for the slot |
| `mark_slot_unbooked` | UPDATE on `appointments` WHERE status → 'cancelled' | Sets `availability_slots.is_booked = false` |

### Helper functions (SECURITY DEFINER)

- `is_admin()` → `boolean` — checks `profiles.role = 'admin'` for `auth.uid()`
- `is_doctor()` → `boolean` — checks `profiles.role = 'doctor'` for `auth.uid()`

---

## 13. Edge Functions Reference

All functions use Deno runtime. CORS headers allow `*` origin.

### `send-email`

**Auth:** JWT verification (uses anon/user token from frontend)  
**Input:** `{ to: string, subject: string, html: string }`  
**Action:** Posts to Resend API → sends email  
**Output:** `{ id: string }` (Resend email ID)

### `underwrite-patient`

**Auth:** `--no-verify-jwt`  
**Input:** `{ questionnaire: HealthQuestionnaire, rulebook_id?: string, simulate?: boolean }`  
**Action:**
1. Fetches active rulebook (or specified version)
2. Computes patient age from `date_of_birth` or `age` shortcut
3. Builds risk profile string
4. Sends to Claude claude-sonnet-4-5 with actuarial system prompt
5. Parses structured JSON response

**Output:** `{ recommendation, probability_high_cost, cost_breakdown, ratio, risk_level, drivers, sensitivity_analysis }`

**Risk logic:** `ratio = expected_monthly_cost / monthly_income_usd`  
- ratio < `threshold_review` → approve  
- ratio < `threshold_reject` → review  
- ratio ≥ `threshold_reject` → reject

### `appointment-reminders`

**Auth:** Service role (scheduled cron)  
**Input:** None (triggered by schedule)  
**Actions:**
1. Auto-closes past appointments (sets completed + auto-summary)
2. Sends 24h reminder emails (patient + doctor)
3. Sends referral follow-up emails
4. Alerts admin for applications pending >44h

### `daily-proxy`

**Auth:** `--no-verify-jwt`  
**Input:** `{ action: 'create-room' | 'create-token', appointmentId?, roomName?, isDoctor? }`  
**Actions:**
- `create-room`: POST to Daily.co API; creates private room with 2-hour expiry, transcription enabled, max 2 participants; stores `daily_room_name` + `daily_room_url` in appointment
- `create-token`: Creates meeting token; `is_owner=true` if isDoctor

### `claude-summary`

**Auth:** `--no-verify-jwt`  
**Input:** `{ transcript: string }`  
**Action:** Sends medical consultation transcript to Claude claude-sonnet-4-5 with medical assistant system prompt  
**Output:** `{ resumen: string, medicamentos: [{medicine_name, dose, instructions}], examenes: [{exam_type, notes}], referencias: [{specialty, urgency}], control: {months, notes} }`

Fallback: returns empty fields if transcript is empty or JSON parsing fails.

### `process-document`

**Auth:** `--no-verify-jwt`  
**Input:** `{ document_id: string }`  
**Action:**
1. Fetches `chat_documents` record
2. Downloads file from `chat-documents` Storage using service role
3. Extracts text: PDF via `pdf-parse/lib/pdf-parse.js`, DOCX via `mammoth`, TXT via `Blob.text()`
4. Normalises whitespace
5. Chunks text at ~500 chars with 50-char overlap
6. Deletes existing chunks (idempotent retry)
7. Inserts chunks into `chat_document_chunks`
8. Updates document: `status='ready'`, `content_text` (first 10k chars), `chunk_count`

Error path: if text extraction fails → `status='error'`

### `chat`

**Auth:** `--no-verify-jwt`  
**Input:** `{ message: string, conversation_history?: [{role, content}], custom_system_prompt?: string }`  
**Rate limit:** 10 requests per IP per minute (in-memory Map, resets on cold start)  
**Action:**
1. Checks rate limit by `X-Forwarded-For` / `CF-Connecting-IP` header
2. Fetches active `chat_config.system_prompt` (unless `custom_system_prompt` provided for admin simulator)
3. Fetches all `chat_document_chunks`
4. Keyword scoring: splits message into tokens, filters stop words, scores each chunk by keyword frequency
5. Selects top 5 chunks by score
6. Builds system prompt with document context injected
7. Sends to Claude `claude-haiku-4-5-20251001` (max 600 tokens, last 10 history turns)

**Output:** `{ reply: string }`  
**Error output:** `{ error: string }` with appropriate HTTP status

---

*Document generated April 2026 from ContigoApp source code (commit `6b2b35c`)*
