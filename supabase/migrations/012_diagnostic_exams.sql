-- ── Diagnostic Orders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_orders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid        NOT NULL REFERENCES appointments(id)  ON DELETE CASCADE,
  patient_id     uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  doctor_id      uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  exam_type      text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'scheduled', 'completed')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_select_own_orders"   ON diagnostic_orders FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "patient_update_own_orders"   ON diagnostic_orders FOR UPDATE USING (patient_id = auth.uid());
CREATE POLICY "doctor_insert_orders"        ON diagnostic_orders FOR INSERT  WITH CHECK (doctor_id = auth.uid());
CREATE POLICY "doctor_select_orders"        ON diagnostic_orders FOR SELECT  USING (doctor_id = auth.uid());
CREATE POLICY "doctor_update_orders"        ON diagnostic_orders FOR UPDATE  USING (doctor_id = auth.uid());
CREATE POLICY "admin_select_all_orders"     ON diagnostic_orders FOR SELECT  USING (is_admin());

-- ── Diagnostic Files ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_files (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_order_id uuid        REFERENCES diagnostic_orders(id) ON DELETE SET NULL,
  appointment_id      uuid        REFERENCES appointments(id)      ON DELETE SET NULL,
  patient_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url            text        NOT NULL,
  file_name           text        NOT NULL,
  file_size           text,
  stage               text        NOT NULL
                      CHECK (stage IN ('pre_appointment', 'during_call', 'result')),
  uploaded_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_insert_files"    ON diagnostic_files FOR INSERT  WITH CHECK (patient_id = auth.uid());
CREATE POLICY "patient_select_files"    ON diagnostic_files FOR SELECT  USING (patient_id = auth.uid());
CREATE POLICY "doctor_select_files"     ON diagnostic_files FOR SELECT  USING (
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE  a.id = diagnostic_files.appointment_id
    AND    a.doctor_id = auth.uid()
  )
);
CREATE POLICY "admin_select_all_files"  ON diagnostic_files FOR SELECT  USING (is_admin());

-- ── Storage Bucket ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('diagnostic-files', 'diagnostic-files', true, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "diag_files_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diagnostic-files');

CREATE POLICY "diag_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'diagnostic-files');

CREATE POLICY "diag_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'diagnostic-files');
