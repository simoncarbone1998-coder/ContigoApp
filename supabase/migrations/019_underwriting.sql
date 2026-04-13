-- ── 019_underwriting.sql ─────────────────────────────────────────────────────
-- Actuarial underwriting engine for patient applications

-- ── 1. Add application status columns to profiles ─────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS application_status text
    CHECK (application_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

-- ── 2. underwriting_rulebooks ─────────────────────────────────────────────────
CREATE TABLE underwriting_rulebooks (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  version                    integer NOT NULL,
  name                       text    NOT NULL,
  is_active                  boolean NOT NULL DEFAULT false,
  cost_per_consultation_usd  numeric NOT NULL DEFAULT 40,
  cost_per_medication_usd    numeric NOT NULL DEFAULT 8,
  cost_per_exam_usd          numeric NOT NULL DEFAULT 12,
  monthly_income_usd         numeric NOT NULL DEFAULT 19,
  threshold_review           numeric NOT NULL DEFAULT 1.0,
  threshold_reject           numeric NOT NULL DEFAULT 2.0,
  ai_instructions            text    NOT NULL DEFAULT '',
  created_by                 uuid    REFERENCES profiles(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  notes                      text
);

ALTER TABLE underwriting_rulebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "underwriting_rulebooks_admin"
  ON underwriting_rulebooks FOR ALL
  USING (is_admin());

-- Allow the edge function (service role) and reading active rulebook during signup flow
-- The underwrite-patient function runs with service role so it bypasses RLS.

-- ── 3. health_questionnaire ───────────────────────────────────────────────────
CREATE TABLE health_questionnaire (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                uuid    NOT NULL REFERENCES profiles(id) UNIQUE,
  date_of_birth             date,
  biological_sex            text    CHECK (biological_sex IN ('masculino', 'femenino', 'otro')),
  conditions                text[]  DEFAULT '{}',
  hospitalized_last_12m     boolean DEFAULT false,
  hospitalization_reason    text,
  active_treatment          boolean DEFAULT false,
  regular_medications       boolean DEFAULT false,
  medications_detail        text,
  smoking_status            text    CHECK (smoking_status IN ('no_fumo', 'exfumador', 'ocasional', 'regular')),
  has_eps                   boolean DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_questionnaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_questionnaire_patient_read"
  ON health_questionnaire FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "health_questionnaire_patient_insert"
  ON health_questionnaire FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "health_questionnaire_admin"
  ON health_questionnaire FOR SELECT
  USING (is_admin());

-- ── 4. patient_applications ───────────────────────────────────────────────────
CREATE TABLE patient_applications (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           uuid    NOT NULL REFERENCES profiles(id),
  status               text    NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at         timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid    REFERENCES profiles(id),
  admin_note           text,
  reapply_after        date,
  ai_recommendation    text    CHECK (ai_recommendation IN ('approve', 'review', 'reject')),
  ai_score             numeric,
  ai_cost_expected_usd numeric,
  ai_income_usd        numeric DEFAULT 57,
  ai_ratio             numeric,
  ai_drivers           jsonb,
  ai_reasoning         text,
  ai_sensitivity       jsonb,
  rulebook_version_id  uuid    REFERENCES underwriting_rulebooks(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_applications_patient_read"
  ON patient_applications FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "patient_applications_admin"
  ON patient_applications FOR ALL
  USING (is_admin());

-- ── 5. Seed initial rulebook ──────────────────────────────────────────────────
INSERT INTO underwriting_rulebooks (
  version, name, is_active,
  cost_per_consultation_usd, cost_per_medication_usd, cost_per_exam_usd,
  monthly_income_usd, threshold_review, threshold_reject,
  ai_instructions
) VALUES (
  1,
  'v1 - Configuración inicial',
  true,
  40, 8, 12, 19, 1.0, 2.0,
  'Evalúa el riesgo actuarial de este paciente para una plataforma de medicina primaria en Colombia. Considera que nuestro modelo cubre consultas de medicina general y especialistas, medicamentos de atención primaria y exámenes diagnósticos básicos. NO cubrimos hospitalizaciones, cirugías ni emergencias.

Pacientes con condiciones crónicas bien controladas pueden ser viables si su uso esperado es moderado. Pacientes con múltiples condiciones activas o tratamientos intensivos tienen alta probabilidad de superar el umbral de costo.

Considera que pacientes con EPS activa tienen menor probabilidad de uso intensivo de nuestra plataforma ya que tienen acceso alternativo al sistema público.'
);
