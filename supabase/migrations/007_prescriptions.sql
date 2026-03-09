-- Migration 007: Prescriptions module

-- ── prescriptions ──────────────────────────────────────────────────────────
CREATE TABLE public.prescriptions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'pendiente'
                             CHECK (status IN ('pendiente', 'en_camino')),
  delivery_address text,
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients view own prescriptions"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "patients update own prescriptions"
  ON public.prescriptions FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "doctors view own prescriptions"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "doctors insert prescriptions"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "admin all prescriptions"
  ON public.prescriptions FOR ALL TO authenticated
  USING (is_admin());

-- ── prescription_items ─────────────────────────────────────────────────────
CREATE TABLE public.prescription_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid        NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_name   text        NOT NULL,
  dose            text        NOT NULL,
  instructions    text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients read own prescription items"
  ON public.prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.patient_id = auth.uid()
    )
  );

CREATE POLICY "doctors insert prescription items"
  ON public.prescription_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.doctor_id = auth.uid()
    )
  );

CREATE POLICY "doctors read own prescription items"
  ON public.prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.doctor_id = auth.uid()
    )
  );

CREATE POLICY "admin all prescription items"
  ON public.prescription_items FOR ALL TO authenticated
  USING (is_admin());

-- ── delivery_address on profiles ───────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delivery_address text;
