-- ────────────────────────────────────────────────────────────────────────────
-- Migration 004: Extended profiles, slots, appointments + doctor_earnings
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Profiles: add new columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date   date,
  ADD COLUMN IF NOT EXISTS bio          text,
  ADD COLUMN IF NOT EXISTS specialty    text
    CONSTRAINT profiles_specialty_check CHECK (
      specialty IS NULL OR specialty IN (
        'medicina_general',
        'pediatria',
        'cardiologia',
        'dermatologia',
        'ginecologia',
        'ortopedia',
        'psicologia'
      )
    ),
  ADD COLUMN IF NOT EXISTS avatar_url   text;

-- 2. Availability slots: add specialty column (mirrors doctor's specialty)
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS specialty text;

-- 3. Appointments: add reason, summary, completion fields
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reason       text,
  ADD COLUMN IF NOT EXISTS summary      text,
  ADD COLUMN IF NOT EXISTS completed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 4. Doctor earnings table
CREATE TABLE IF NOT EXISTS public.doctor_earnings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  amount         numeric(10,2) NOT NULL DEFAULT 10,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_earnings ENABLE ROW LEVEL SECURITY;

-- Doctors can only read their own earnings
CREATE POLICY "doctors_read_own_earnings" ON public.doctor_earnings
  FOR SELECT USING (doctor_id = auth.uid());

-- Only admins can insert earnings (done via service role / trigger in prod)
-- For now we allow authenticated inserts so the doctor completing an appt can record it
CREATE POLICY "doctors_insert_own_earnings" ON public.doctor_earnings
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

-- Admin reads all
CREATE POLICY "admin_read_all_earnings" ON public.doctor_earnings
  FOR SELECT USING (is_admin());

-- 5. Supabase Storage: avatars bucket
-- The bucket itself must be created via the dashboard or storage API;
-- the SQL below creates the RLS policies for the objects table.
-- Run: supabase storage create avatars --public   (or create via dashboard)

-- Allow any authenticated user to upload their own avatar
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
