-- Migration 006: Critical RLS fixes
-- Fix 1: Allow any authenticated user to read doctor profiles
--   (patients need this to see doctor names in booking/calendar joins)
CREATE POLICY "read doctor profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (role = 'doctor');

-- Fix 2: Allow doctors to read profiles of their own patients
--   (doctors need this to see patient info in appointment modals)
CREATE POLICY "doctors read patient profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    role = 'patient'
    AND is_doctor()
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.patient_id = profiles.id
        AND a.doctor_id = auth.uid()
    )
  );

-- Fix 3: Allow doctors to update their own appointments
--   (required to mark appointments as completed — was blocked by existing policy)
CREATE POLICY "doctors update own appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- Fix 4: Allow patients to read availability slots booked via their appointments
--   (CalendarioPage join on slot_id was returning null due to is_booked=true filter)
CREATE POLICY "patients read own booked slots"
  ON public.availability_slots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.slot_id = availability_slots.id
        AND a.patient_id = auth.uid()
    )
  );
