-- Doctor approval workflow fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS doctor_status    text        CHECK (doctor_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS medical_license  text,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Allow admins to read all profile fields (already covered by existing policy,
-- but explicitly allow reading new columns)
-- No new RLS policies needed — existing admin SELECT/UPDATE policies cover these columns.
