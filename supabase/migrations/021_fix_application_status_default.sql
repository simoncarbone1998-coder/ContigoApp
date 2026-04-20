-- Fix: handle_new_user trigger now sets application_status = 'pending' for new patients.
-- This eliminates the race condition where AuthContext could load a null application_status
-- before AplicarPage's upsert completes, causing RequireRole to treat the patient as approved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, application_status)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'patient',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
