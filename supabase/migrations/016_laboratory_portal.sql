-- ────────────────────────────────────────────────────────────
-- 016 — Laboratory Partner Portal
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── laboratories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.laboratories (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text        NOT NULL,
  email                       text        NOT NULL UNIQUE,
  password_hash               text        NOT NULL,
  phone                       text,
  address                     text,
  city                        text,
  type                        text        NOT NULL CHECK (type IN ('laboratorio','imagenes','ambos')),
  status                      text        NOT NULL DEFAULT 'pending'
                                            CHECK (status IN ('pending','approved','rejected')),
  rejection_reason            text,
  approved_at                 timestamptz,
  camara_comercio_url         text,
  habilitacion_supersalud_url text,
  rut_url                     text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads all labs"
  ON public.laboratories FOR SELECT
  USING (is_admin());

CREATE POLICY "admin updates all labs"
  ON public.laboratories FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

-- ── lab_exam_types ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_exam_types (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id uuid        NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  exam_name     text        NOT NULL,
  category      text        NOT NULL CHECK (category IN ('laboratorio','imagenes')),
  available     boolean     NOT NULL DEFAULT true,
  price_cop     numeric,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_exam_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads all exam types"
  ON public.lab_exam_types FOR SELECT
  USING (is_admin());

CREATE POLICY "authenticated reads exam types"
  ON public.lab_exam_types FOR SELECT
  TO authenticated
  USING (true);

-- ── lab_availability_slots ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_availability_slots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id uuid        NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  start_time    time        NOT NULL,
  end_time      time        NOT NULL,
  is_booked     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_availability_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated reads available lab slots"
  ON public.lab_availability_slots FOR SELECT
  TO authenticated
  USING (NOT is_booked);

CREATE POLICY "admin reads all lab slots"
  ON public.lab_availability_slots FOR ALL
  USING (is_admin());

-- ── lab_appointments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_appointments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_order_id  uuid        REFERENCES public.diagnostic_orders(id) ON DELETE SET NULL,
  laboratory_id        uuid        NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  lab_slot_id          uuid        REFERENCES public.lab_availability_slots(id) ON DELETE SET NULL,
  patient_id           uuid        NOT NULL REFERENCES public.profiles(id),
  exam_name            text        NOT NULL,
  status               text        NOT NULL DEFAULT 'scheduled'
                                     CHECK (status IN ('scheduled','completed')),
  result_url           text,
  result_uploaded_at   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients read their lab appointments"
  ON public.lab_appointments FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "admin reads all lab appointments"
  ON public.lab_appointments FOR ALL
  USING (is_admin());

-- ── Storage buckets ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-documents', 'lab-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-results', 'lab-results', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone uploads lab documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lab-documents');

CREATE POLICY "admin reads lab documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lab-documents' AND is_admin());

CREATE POLICY "anyone uploads lab results"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lab-results');

CREATE POLICY "authenticated reads lab results"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lab-results');

-- ── RPC: authenticate_lab ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.authenticate_lab(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE lab public.laboratories;
BEGIN
  SELECT * INTO lab FROM public.laboratories WHERE email = lower(trim(p_email));
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF lab.password_hash = crypt(p_password, lab.password_hash) THEN
    RETURN json_build_object(
      'id', lab.id, 'name', lab.name, 'email', lab.email,
      'status', lab.status, 'type', lab.type,
      'city', lab.city, 'phone', lab.phone, 'address', lab.address
    );
  END IF;
  RETURN NULL;
END;
$$;

-- ── RPC: register_lab ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_lab(
  p_name text, p_email text, p_password text,
  p_phone text, p_address text, p_city text, p_type text,
  p_camara_comercio_url text DEFAULT NULL,
  p_habilitacion_supersalud_url text DEFAULT NULL,
  p_rut_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_lab public.laboratories;
BEGIN
  IF EXISTS (SELECT 1 FROM public.laboratories WHERE email = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'email_exists';
  END IF;
  INSERT INTO public.laboratories
    (name, email, password_hash, phone, address, city, type,
     camara_comercio_url, habilitacion_supersalud_url, rut_url)
  VALUES
    (p_name, lower(trim(p_email)), crypt(p_password, gen_salt('bf')),
     p_phone, p_address, p_city, p_type,
     p_camara_comercio_url, p_habilitacion_supersalud_url, p_rut_url)
  RETURNING * INTO new_lab;
  RETURN json_build_object(
    'id', new_lab.id, 'name', new_lab.name, 'email', new_lab.email,
    'status', new_lab.status, 'type', new_lab.type,
    'city', new_lab.city, 'phone', new_lab.phone, 'address', new_lab.address
  );
END;
$$;

-- ── RPC: insert_lab_exam_types ────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_lab_exam_types(
  p_laboratory_id uuid,
  p_exams json
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE item json;
BEGIN
  FOR item IN SELECT * FROM json_array_elements(p_exams)
  LOOP
    INSERT INTO public.lab_exam_types (laboratory_id, exam_name, category, price_cop)
    VALUES (
      p_laboratory_id,
      item->>'exam_name',
      item->>'category',
      (item->>'price_cop')::numeric
    );
  END LOOP;
END;
$$;

-- ── RPC: update_lab_docs ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_lab_docs(
  p_id uuid,
  p_camara_comercio_url text DEFAULT NULL,
  p_habilitacion_supersalud_url text DEFAULT NULL,
  p_rut_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.laboratories SET
    camara_comercio_url = COALESCE(p_camara_comercio_url, camara_comercio_url),
    habilitacion_supersalud_url = COALESCE(p_habilitacion_supersalud_url, habilitacion_supersalud_url),
    rut_url = COALESCE(p_rut_url, rut_url)
  WHERE id = p_id;
END;
$$;

-- ── RPC: get_lab_by_id ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_by_id(p_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE lab public.laboratories;
BEGIN
  SELECT * INTO lab FROM public.laboratories WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'id', lab.id, 'name', lab.name, 'email', lab.email,
    'status', lab.status, 'type', lab.type,
    'city', lab.city, 'phone', lab.phone, 'address', lab.address,
    'camara_comercio_url', lab.camara_comercio_url,
    'habilitacion_supersalud_url', lab.habilitacion_supersalud_url,
    'rut_url', lab.rut_url
  );
END;
$$;

-- ── RPC: update_lab_profile ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_lab_profile(
  p_id uuid, p_name text, p_phone text, p_address text, p_city text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.laboratories
  SET name = p_name, phone = p_phone, address = p_address, city = p_city
  WHERE id = p_id;
END;
$$;

-- ── RPC: get_lab_exam_types ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_exam_types(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.category, t.exam_name), '[]'::json)
    FROM (SELECT id, exam_name, category, available, price_cop FROM public.lab_exam_types
          WHERE laboratory_id = p_lab_id) t
  );
END;
$$;

-- ── RPC: get_lab_slots ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_slots(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date, t.start_time), '[]'::json)
    FROM (SELECT id, date, start_time, end_time, is_booked
          FROM public.lab_availability_slots
          WHERE laboratory_id = p_lab_id AND date >= current_date
          ORDER BY date, start_time) t
  );
END;
$$;

-- ── RPC: insert_lab_slots ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_lab_slots(p_laboratory_id uuid, p_slots json)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE item json;
BEGIN
  FOR item IN SELECT * FROM json_array_elements(p_slots)
  LOOP
    INSERT INTO public.lab_availability_slots (laboratory_id, date, start_time, end_time)
    VALUES (p_laboratory_id, (item->>'date')::date,
            (item->>'start_time')::time, (item->>'end_time')::time)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── RPC: delete_lab_slot ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_lab_slot(p_slot_id uuid, p_lab_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.lab_availability_slots
  WHERE id = p_slot_id AND laboratory_id = p_lab_id AND is_booked = false;
END;
$$;

-- ── RPC: get_lab_orders ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_orders(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE lab public.laboratories;
BEGIN
  SELECT * INTO lab FROM public.laboratories WHERE id = p_lab_id;
  IF NOT FOUND THEN RETURN '[]'::json; END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
    FROM (
      SELECT
        do2.id, do2.exam_type, do2.status, do2.notes, do2.created_at,
        p.full_name  AS patient_name, p.phone AS patient_phone,
        p.city       AS patient_city, p.id    AS patient_id,
        p.email      AS patient_email,
        dp.full_name AS doctor_name
      FROM public.diagnostic_orders do2
      JOIN public.profiles p  ON p.id  = do2.patient_id
      JOIN public.profiles dp ON dp.id = do2.doctor_id
      WHERE do2.status IN ('pending','scheduled')
        AND do2.exam_type IN (
          SELECT exam_name FROM public.lab_exam_types
          WHERE laboratory_id = p_lab_id AND available = true
        )
        AND (lab.city IS NULL OR lower(trim(p.city)) = lower(trim(lab.city)))
        AND NOT EXISTS (
          SELECT 1 FROM public.lab_appointments la
          WHERE la.diagnostic_order_id = do2.id
        )
    ) t
  );
END;
$$;

-- ── RPC: schedule_lab_appointment ────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_lab_appointment(
  p_diagnostic_order_id uuid, p_laboratory_id uuid,
  p_lab_slot_id uuid, p_patient_id uuid, p_exam_name text
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_appt public.lab_appointments;
BEGIN
  INSERT INTO public.lab_appointments
    (diagnostic_order_id, laboratory_id, lab_slot_id, patient_id, exam_name)
  VALUES
    (p_diagnostic_order_id, p_laboratory_id, p_lab_slot_id, p_patient_id, p_exam_name)
  RETURNING * INTO new_appt;
  UPDATE public.lab_availability_slots SET is_booked = true WHERE id = p_lab_slot_id;
  UPDATE public.diagnostic_orders SET status = 'scheduled' WHERE id = p_diagnostic_order_id;
  RETURN row_to_json(new_appt);
END;
$$;

-- ── RPC: get_lab_appointments ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_appointments(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.slot_date, t.slot_time), '[]'::json)
    FROM (
      SELECT
        la.id, la.exam_name, la.status, la.result_url, la.result_uploaded_at, la.created_at,
        la.patient_id, la.diagnostic_order_id,
        p.full_name AS patient_name, p.phone AS patient_phone,
        s.date      AS slot_date,  s.start_time AS slot_time,
        do2.exam_type AS ordered_exam, dp.full_name AS doctor_name, dp.email AS doctor_email
      FROM public.lab_appointments la
      JOIN public.profiles p ON p.id = la.patient_id
      LEFT JOIN public.lab_availability_slots s ON s.id = la.lab_slot_id
      LEFT JOIN public.diagnostic_orders do2 ON do2.id = la.diagnostic_order_id
      LEFT JOIN public.profiles dp ON dp.id = do2.doctor_id
      WHERE la.laboratory_id = p_lab_id
        AND la.status = 'scheduled'
      ORDER BY s.date, s.start_time
    ) t
  );
END;
$$;

-- ── RPC: get_lab_history ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_history(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.result_uploaded_at DESC), '[]'::json)
    FROM (
      SELECT
        la.id, la.exam_name, la.result_url, la.result_uploaded_at, la.created_at,
        p.full_name AS patient_name,
        s.date AS slot_date, s.start_time AS slot_time
      FROM public.lab_appointments la
      JOIN public.profiles p ON p.id = la.patient_id
      LEFT JOIN public.lab_availability_slots s ON s.id = la.lab_slot_id
      WHERE la.laboratory_id = p_lab_id AND la.status = 'completed'
    ) t
  );
END;
$$;

-- ── RPC: upload_lab_result ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upload_lab_result(
  p_appointment_id uuid, p_lab_id uuid,
  p_result_url text, p_patient_email text DEFAULT NULL,
  p_doctor_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.lab_appointments SET
    result_url = p_result_url,
    result_uploaded_at = now(),
    status = 'completed'
  WHERE id = p_appointment_id AND laboratory_id = p_lab_id;

  UPDATE public.diagnostic_orders SET status = 'completed'
  WHERE id = (SELECT diagnostic_order_id FROM public.lab_appointments WHERE id = p_appointment_id);
END;
$$;

-- ── RPC: get_lab_dashboard_stats ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_dashboard_stats(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pending_orders   int;
  today_appts      int;
  month_completed  int;
  total_completed  int;
BEGIN
  SELECT COUNT(*) INTO pending_orders
  FROM public.get_lab_orders(p_lab_id) t;

  SELECT COUNT(*) INTO today_appts
  FROM public.lab_appointments la
  LEFT JOIN public.lab_availability_slots s ON s.id = la.lab_slot_id
  WHERE la.laboratory_id = p_lab_id
    AND la.status = 'scheduled' AND s.date = current_date;

  SELECT COUNT(*) INTO month_completed
  FROM public.lab_appointments
  WHERE laboratory_id = p_lab_id AND status = 'completed'
    AND date_trunc('month', result_uploaded_at) = date_trunc('month', now());

  SELECT COUNT(*) INTO total_completed
  FROM public.lab_appointments WHERE laboratory_id = p_lab_id AND status = 'completed';

  RETURN json_build_object(
    'pending_orders',  pending_orders,
    'today_appts',     today_appts,
    'month_completed', month_completed,
    'total_completed', total_completed
  );
END;
$$;

-- ── RPC: get_lab_today_appointments ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_lab_today_appointments(p_lab_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.slot_time), '[]'::json)
    FROM (
      SELECT
        la.id, la.exam_name, la.status, la.result_url,
        la.patient_id, la.diagnostic_order_id,
        p.full_name AS patient_name, p.phone AS patient_phone,
        s.date AS slot_date, s.start_time AS slot_time,
        do2.exam_type AS ordered_exam, dp.full_name AS doctor_name, dp.email AS doctor_email
      FROM public.lab_appointments la
      JOIN public.profiles p ON p.id = la.patient_id
      LEFT JOIN public.lab_availability_slots s ON s.id = la.lab_slot_id
      LEFT JOIN public.diagnostic_orders do2 ON do2.id = la.diagnostic_order_id
      LEFT JOIN public.profiles dp ON dp.id = do2.doctor_id
      WHERE la.laboratory_id = p_lab_id
        AND s.date = current_date
        AND la.status = 'scheduled'
      ORDER BY s.start_time
    ) t
  );
END;
$$;

-- ── RPC: admin_get_all_labs ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_all_labs()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json)
    FROM (
      SELECT
        l.*,
        (SELECT COUNT(*) FROM public.lab_exam_types WHERE laboratory_id = l.id) AS exam_count,
        (SELECT COUNT(*) FROM public.lab_appointments WHERE laboratory_id = l.id AND status = 'completed') AS completed_count,
        (SELECT json_agg(json_build_object('exam_name', exam_name, 'category', category))
         FROM public.lab_exam_types WHERE laboratory_id = l.id) AS exams
      FROM public.laboratories l
    ) t
  );
END;
$$;

-- ── RPC: admin_approve_lab ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_lab(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.laboratories SET status = 'approved', approved_at = now()
  WHERE id = p_id;
END;
$$;

-- ── RPC: admin_reject_lab ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reject_lab(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.laboratories SET status = 'rejected', rejection_reason = p_reason
  WHERE id = p_id;
END;
$$;

-- ── RPC: get_real_labs_for_patient ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_real_labs_for_patient(p_city text, p_exam_type text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT l.id, l.name, l.address, l.city, l.phone, l.type,
        (SELECT json_agg(json_build_object(
          'id', s.id, 'date', s.date,
          'start_time', s.start_time, 'end_time', s.end_time
        ) ORDER BY s.date, s.start_time)
         FROM public.lab_availability_slots s
         WHERE s.laboratory_id = l.id AND s.is_booked = false
           AND s.date >= current_date
         LIMIT 10
        ) AS available_slots
      FROM public.laboratories l
      WHERE l.status = 'approved'
        AND (p_city IS NULL OR lower(trim(l.city)) = lower(trim(p_city)))
        AND EXISTS (
          SELECT 1 FROM public.lab_exam_types et
          WHERE et.laboratory_id = l.id
            AND et.available = true
            AND lower(et.exam_name) ILIKE '%' || lower(p_exam_type) || '%'
        )
      ORDER BY l.name
    ) t
  );
END;
$$;
