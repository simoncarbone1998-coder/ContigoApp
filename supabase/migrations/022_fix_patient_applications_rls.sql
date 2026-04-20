-- Fix: patient_applications was missing an INSERT policy for patients.
-- AplicarPage inserts the application row as the authenticated patient user,
-- but only a SELECT policy existed, so every insert was silently blocked by RLS.
CREATE POLICY "patient_applications_patient_insert"
  ON patient_applications FOR INSERT
  WITH CHECK (patient_id = auth.uid());
