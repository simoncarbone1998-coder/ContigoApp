-- Allow admins to update any profile (e.g. change role)
create policy "admin updates any profile"
  on public.profiles for update
  using  (is_admin())
  with check (is_admin());
