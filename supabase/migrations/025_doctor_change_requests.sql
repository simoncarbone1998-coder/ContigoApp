-- Doctor change requests table
CREATE TABLE IF NOT EXISTS public.doctor_change_requests (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id               uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                  text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_changes       jsonb       NOT NULL DEFAULT '{}',
  new_cedula_url          text,
  new_diploma_url         text,
  new_especializacion_url text,
  change_reason           text,
  admin_note              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid        REFERENCES public.profiles(id)
);

ALTER TABLE public.doctor_change_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doctor_change_requests' AND policyname = 'dcr_doctor_insert'
  ) THEN
    CREATE POLICY "dcr_doctor_insert"
    ON public.doctor_change_requests FOR INSERT TO authenticated
    WITH CHECK (doctor_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doctor_change_requests' AND policyname = 'dcr_select'
  ) THEN
    CREATE POLICY "dcr_select"
    ON public.doctor_change_requests FOR SELECT TO authenticated
    USING (
      doctor_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doctor_change_requests' AND policyname = 'dcr_admin_update'
  ) THEN
    CREATE POLICY "dcr_admin_update"
    ON public.doctor_change_requests FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
