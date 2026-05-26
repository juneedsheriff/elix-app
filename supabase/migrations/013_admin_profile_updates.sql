-- Admins can update doctor and patient profiles from Elix Health console

drop policy if exists "doctors_update_admins" on public.doctors;
create policy "doctors_update_admins"
  on public.doctors
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "patients_update_admins" on public.patients;
create policy "patients_update_admins"
  on public.patients
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
