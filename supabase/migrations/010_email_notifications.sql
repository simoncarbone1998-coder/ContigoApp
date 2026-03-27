-- Add reminder_sent flag to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
