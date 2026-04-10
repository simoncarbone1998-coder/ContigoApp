-- specialist_referrals table
CREATE TABLE IF NOT EXISTS public.specialist_referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referring_doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty           text NOT NULL,
  reason              text NOT NULL,
  urgency             text NOT NULL CHECK (urgency IN ('rutinaria', 'prioritaria')),
  created_by_role     text NOT NULL DEFAULT 'general' CHECK (created_by_role IN ('general', 'specialist')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specialist_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_referrals" ON public.specialist_referrals
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "doctors_insert_referrals" ON public.specialist_referrals
  FOR INSERT WITH CHECK (auth.uid() = referring_doctor_id);

CREATE POLICY "doctors_read_patient_referrals" ON public.specialist_referrals
  FOR SELECT USING (auth.uid() = referring_doctor_id);

CREATE POLICY "admin_read_referrals" ON public.specialist_referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- follow_up_reminders table
CREATE TABLE IF NOT EXISTS public.follow_up_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty       text NOT NULL,
  reminder_date   date NOT NULL,
  months_until    integer NOT NULL CHECK (months_until IN (1, 2, 3, 6, 12)),
  note            text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'booked')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_reminders" ON public.follow_up_reminders
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "doctors_insert_reminders" ON public.follow_up_reminders
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "doctors_read_patient_reminders" ON public.follow_up_reminders
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "admin_read_reminders" ON public.follow_up_reminders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cleanup: cancel specialist appointments booked without a referral (no real patients yet)
UPDATE public.appointments
SET status = 'cancelled'
WHERE completed = false
AND status = 'confirmed'
AND slot_id IN (
  SELECT id FROM public.availability_slots
  WHERE specialty != 'medicina_general'
)
AND patient_id NOT IN (
  SELECT DISTINCT a2.patient_id
  FROM public.appointments a2
  JOIN public.availability_slots s ON a2.slot_id = s.id
  WHERE s.specialty = 'medicina_general'
  AND a2.completed = true
);
