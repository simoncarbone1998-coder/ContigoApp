-- 011: appointment_feedback table
CREATE TABLE IF NOT EXISTS appointment_feedback (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  patient_id     uuid        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  doctor_id      uuid        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  rating         integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_feedback ENABLE ROW LEVEL SECURITY;

-- Patients can insert their own feedback (once per appointment — enforced by UNIQUE)
CREATE POLICY "patient_insert_feedback"
  ON appointment_feedback FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Patients can view their own feedback
CREATE POLICY "patient_select_own_feedback"
  ON appointment_feedback FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- Admins can read all feedback
CREATE POLICY "admin_select_all_feedback"
  ON appointment_feedback FOR SELECT TO authenticated
  USING (is_admin());
