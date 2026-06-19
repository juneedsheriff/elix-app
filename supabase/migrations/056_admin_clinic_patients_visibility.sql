-- Administrators see and manage all patients (platform + clinic PSE workspaces).

drop policy if exists "patients_select_staff" on public.patients;
create policy "patients_select_staff"
  on public.patients for select to authenticated
  using (
    public.is_administrator()
    or (
      public.staff_sees_platform_rows()
      and clinic_id is null
    )
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );

drop policy if exists "patients_update_platform_admin" on public.patients;
create policy "patients_update_platform_admin"
  on public.patients for update to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());
