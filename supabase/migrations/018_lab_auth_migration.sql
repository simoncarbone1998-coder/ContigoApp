-- 018_lab_auth_migration.sql
-- Migrate lab authentication to unified Supabase Auth
-- Add exam-specific availability columns

-- ── 1. Allow 'laboratory' role in profiles ─────────────────────────────────

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'laboratory'));

-- ── 2. Schema changes for laboratories ────────────────────────────────────

ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE laboratories
  DROP COLUMN IF EXISTS password_hash;

-- ── 3. Schema changes for lab_availability_slots ──────────────────────────

ALTER TABLE lab_availability_slots
  ADD COLUMN IF NOT EXISTS exam_name text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30;

-- ── 4. Helper: get current user's lab ID ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_lab_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.laboratories WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ── 5. RPC: create_lab_profile (called after supabase.auth.signUp) ─────────

CREATE OR REPLACE FUNCTION create_lab_profile(
  p_name    text,
  p_phone   text,
  p_address text,
  p_city    text,
  p_type    text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_lab_id uuid;
  v_email  text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Set profile role to 'laboratory'
  UPDATE profiles SET role = 'laboratory' WHERE id = auth.uid();

  -- Create lab record linked to auth user
  INSERT INTO laboratories (auth_id, name, email, phone, address, city, type, status)
  VALUES (auth.uid(), p_name, v_email, p_phone, p_address, p_city, p_type, 'pending')
  RETURNING id INTO v_lab_id;

  RETURN v_lab_id;
END;
$$;

-- ── 6. RPC: get_my_lab (for LabContext) ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_lab()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_lab json;
BEGIN
  SELECT row_to_json(l.*) INTO v_lab
  FROM laboratories l
  WHERE l.auth_id = auth.uid()
  LIMIT 1;
  RETURN v_lab;
END;
$$;

-- ── 7. RPC: insert_lab_slots_v2 (exam-specific, frequency-based) ───────────

CREATE OR REPLACE FUNCTION insert_lab_slots_v2(p_slots jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_lab_id uuid;
  slot     jsonb;
BEGIN
  v_lab_id := get_my_lab_id();
  IF v_lab_id IS NULL THEN
    RAISE EXCEPTION 'lab_not_found';
  END IF;

  FOR slot IN SELECT * FROM jsonb_array_elements(p_slots)
  LOOP
    INSERT INTO lab_availability_slots
      (laboratory_id, date, start_time, end_time, exam_name, duration_minutes)
    VALUES (
      v_lab_id,
      (slot->>'date')::date,
      (slot->>'start_time')::time,
      (slot->>'end_time')::time,
      slot->>'exam_name',
      COALESCE((slot->>'duration_minutes')::int, 30)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── 8. Update update_lab_docs to check auth ───────────────────────────────

DROP FUNCTION IF EXISTS update_lab_docs(uuid,text,text,text);

CREATE OR REPLACE FUNCTION update_lab_docs(
  p_id                          uuid,
  p_camara_comercio_url         text,
  p_habilitacion_supersalud_url text,
  p_rut_url                     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_id != get_my_lab_id() AND NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE laboratories
  SET camara_comercio_url         = p_camara_comercio_url,
      habilitacion_supersalud_url = p_habilitacion_supersalud_url,
      rut_url                     = p_rut_url
  WHERE id = p_id;
END;
$$;

-- ── 9. Update insert_lab_exam_types to check auth ─────────────────────────

DROP FUNCTION IF EXISTS insert_lab_exam_types(uuid,json);

CREATE OR REPLACE FUNCTION insert_lab_exam_types(
  p_laboratory_id uuid,
  p_exams         json
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_laboratory_id != get_my_lab_id() AND NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  DELETE FROM lab_exam_types WHERE laboratory_id = p_laboratory_id;
  INSERT INTO lab_exam_types (laboratory_id, exam_name, category, price_cop)
  SELECT
    p_laboratory_id,
    (e->>'exam_name'),
    (e->>'category'),
    CASE WHEN (e->>'price_cop') IS NOT NULL AND (e->>'price_cop') != ''
         THEN (e->>'price_cop')::numeric ELSE NULL END
  FROM json_array_elements(p_exams) AS e
  WHERE (e->>'exam_name') IS NOT NULL;
END;
$$;

-- ── 10. Drop old custom-auth RPCs ─────────────────────────────────────────

DROP FUNCTION IF EXISTS register_lab(text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS authenticate_lab(text,text);

-- ── 11. RLS: laboratories ──────────────────────────────────────────────────

ALTER TABLE laboratories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "labs_select_own"      ON laboratories;
DROP POLICY IF EXISTS "labs_update_own"      ON laboratories;
DROP POLICY IF EXISTS "labs_admin_all"       ON laboratories;
DROP POLICY IF EXISTS "labs_insert"          ON laboratories;
DROP POLICY IF EXISTS "labs_select"          ON laboratories;
DROP POLICY IF EXISTS "labs_update"          ON laboratories;
DROP POLICY IF EXISTS "lab_select_admin"     ON laboratories;
DROP POLICY IF EXISTS "lab_update_admin"     ON laboratories;
DROP POLICY IF EXISTS "Labs select own"      ON laboratories;
DROP POLICY IF EXISTS "Labs update own"      ON laboratories;
DROP POLICY IF EXISTS "Admins view all labs" ON laboratories;

CREATE POLICY "labs_select" ON laboratories FOR SELECT
  USING (auth_id = auth.uid() OR (SELECT is_admin()));
CREATE POLICY "labs_update" ON laboratories FOR UPDATE
  USING (auth_id = auth.uid() OR (SELECT is_admin()));
CREATE POLICY "labs_insert" ON laboratories FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- ── 12. RLS: lab_availability_slots ──────────────────────────────────────

ALTER TABLE lab_availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_slots_lab_manage"   ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_patient_read" ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_admin"        ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_select"       ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_insert"       ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_update"       ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_delete"       ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_read"         ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_write"        ON lab_availability_slots;
DROP POLICY IF EXISTS "lab_slots_manage"       ON lab_availability_slots;

CREATE POLICY "lab_slots_read" ON lab_availability_slots
  FOR SELECT USING (true);
CREATE POLICY "lab_slots_manage" ON lab_availability_slots
  FOR ALL
  USING (laboratory_id = get_my_lab_id() OR (SELECT is_admin()))
  WITH CHECK (laboratory_id = get_my_lab_id() OR (SELECT is_admin()));

-- ── 13. RLS: lab_exam_types ───────────────────────────────────────────────

ALTER TABLE lab_exam_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_exam_types_select"  ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_types_insert"  ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_types_delete"  ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_types_read"    ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_types_write"   ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_all"           ON lab_exam_types;
DROP POLICY IF EXISTS "lab_exam_types_manage"  ON lab_exam_types;

CREATE POLICY "lab_exam_types_read" ON lab_exam_types
  FOR SELECT USING (true);
CREATE POLICY "lab_exam_types_manage" ON lab_exam_types
  FOR ALL
  USING (laboratory_id = get_my_lab_id() OR (SELECT is_admin()))
  WITH CHECK (laboratory_id = get_my_lab_id() OR (SELECT is_admin()));
