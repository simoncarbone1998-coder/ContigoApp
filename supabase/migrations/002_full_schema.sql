-- ============================================================
-- 002_full_schema.sql
-- Full schema for ContigoApp health management platform
-- Tables: profiles, availability_slots, appointments
-- ============================================================

-- Drop old table from scaffold (cascade removes its policies too)
drop table if exists public.appointments cascade;


-- ============================================================
-- 1. PROFILES
-- ============================================================
create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       text        not null default 'patient',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('patient', 'doctor', 'admin'))
);

alter table public.profiles enable row level security;


-- ============================================================
-- 2. HELPER FUNCTIONS  (security definer → bypass RLS safely)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_doctor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'doctor'
  )
$$;


-- ============================================================
-- 3. RLS POLICIES — profiles
-- ============================================================
create policy "users read own profile, admin reads all"
  on public.profiles for select
  using (id = auth.uid() or is_admin());

create policy "users insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "users update own profile"
  on public.profiles for update
  using  (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
-- 4. AVAILABILITY SLOTS
-- ============================================================
create table if not exists public.availability_slots (
  id         uuid    primary key default gen_random_uuid(),
  doctor_id  uuid    not null references public.profiles(id) on delete cascade,
  date       date    not null,
  start_time time    not null,
  end_time   time    not null,
  is_booked  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.availability_slots enable row level security;

-- SELECT: admin sees all; doctors see their own; everyone sees unbooked
create policy "read availability slots"
  on public.availability_slots for select
  using (is_admin() or doctor_id = auth.uid() or not is_booked);

-- INSERT: only doctors, only for themselves
create policy "doctors insert own slots"
  on public.availability_slots for insert
  with check (doctor_id = auth.uid() and is_doctor());

-- UPDATE: doctors update their own slots
create policy "doctors update own slots"
  on public.availability_slots for update
  using  (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- DELETE: doctors delete their own unbooked slots only
create policy "doctors delete own unbooked slots"
  on public.availability_slots for delete
  using (doctor_id = auth.uid() and not is_booked);


-- ============================================================
-- 5. APPOINTMENTS
-- ============================================================
create table if not exists public.appointments (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id  uuid not null references public.profiles(id) on delete cascade,
  slot_id    uuid not null references public.availability_slots(id) on delete cascade,
  status     text not null default 'confirmed',
  created_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('confirmed', 'cancelled'))
);

alter table public.appointments enable row level security;

-- SELECT: patient sees own; doctor sees theirs; admin sees all
create policy "read appointments"
  on public.appointments for select
  using (is_admin() or patient_id = auth.uid() or doctor_id = auth.uid());

-- INSERT: patient books for themselves
create policy "patients insert appointments"
  on public.appointments for insert
  with check (patient_id = auth.uid());

-- UPDATE: patient cancels own; admin can update any
create policy "update appointments"
  on public.appointments for update
  using  (is_admin() or patient_id = auth.uid())
  with check (is_admin() or patient_id = auth.uid());


-- ============================================================
-- 6. TRIGGER: auto-create profile when a new user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'patient'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 7. TRIGGER: mark slot booked when appointment is created
-- ============================================================
create or replace function public.mark_slot_booked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.availability_slots
  set is_booked = true
  where id = new.slot_id;
  return new;
end;
$$;

drop trigger if exists on_appointment_created on public.appointments;
create trigger on_appointment_created
  after insert on public.appointments
  for each row execute procedure public.mark_slot_booked();


-- ============================================================
-- 8. TRIGGER: free slot when appointment is cancelled
-- ============================================================
create or replace function public.mark_slot_unbooked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    update public.availability_slots
    set is_booked = false
    where id = new.slot_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_appointment_cancelled on public.appointments;
create trigger on_appointment_cancelled
  after update on public.appointments
  for each row execute procedure public.mark_slot_unbooked();
