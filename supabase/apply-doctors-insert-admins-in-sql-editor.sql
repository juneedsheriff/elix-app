-- Run in Supabase SQL Editor if migration 028 is not applied via CLI.

drop policy if exists "doctors_insert_admins" on public.doctors;
create policy "doctors_insert_admins"
  on public.doctors
  for insert
  to authenticated
  with check (public.is_administrator());
