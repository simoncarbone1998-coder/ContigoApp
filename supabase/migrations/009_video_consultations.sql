-- Migration 009: Add Daily.co video consultation fields to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS daily_room_name text,
  ADD COLUMN IF NOT EXISTS daily_room_url   text,
  ADD COLUMN IF NOT EXISTS room_created_at  timestamptz;
