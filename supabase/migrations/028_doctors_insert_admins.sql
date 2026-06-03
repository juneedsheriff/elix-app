-- Administrators can add doctors from the Elix Health console.

drop policy if exists "doctors_insert_admins" on public.doctors;
create policy "doctors_insert_admins"
  on public.doctors
  for insert
  to authenticated
  with check (public.is_administrator());
