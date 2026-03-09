-- ────────────────────────────────────────────────────────────────────────────
-- Migration 005: Additional profile fields for patients and doctors
-- ────────────────────────────────────────────────────────────────────────────

-- Patient fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

-- Doctor fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS undergraduate_university text,
  ADD COLUMN IF NOT EXISTS postgraduate_specialty    text,
  ADD COLUMN IF NOT EXISTS doctor_description        text;

-- birth_date was added in migration 004 (verify it exists)
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
-- The ADD COLUMN IF NOT EXISTS is idempotent, so safe to re-run:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;
