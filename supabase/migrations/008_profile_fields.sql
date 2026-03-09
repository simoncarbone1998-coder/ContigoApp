-- ────────────────────────────────────────────────────────────────────────────
-- Migration 008: Ensure all patient profile fields exist (idempotent)
-- phone was added in 003, city in 005, delivery_address in 007.
-- Using IF NOT EXISTS makes this safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city             text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delivery_address text;
