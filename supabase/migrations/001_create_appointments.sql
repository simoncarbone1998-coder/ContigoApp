create table appointments (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  appointment_date     date        not null,
  appointment_time     time        not null,
  reason_for_visit     text        not null,
  symptoms_description text,
  status               text        not null default 'pending',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),

  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),

  constraint appointments_user_status_unique
    unique (user_id, status)
);

alter table appointments enable row level security;

create policy "users can select their own appointments"
  on appointments for select
  using (user_id = auth.uid());

create policy "users can insert their own appointments"
  on appointments for insert
  with check (user_id = auth.uid());

create policy "users can update their own appointments"
  on appointments for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete their own appointments"
  on appointments for delete
  using (user_id = auth.uid());
