-- Allow PSE staff to update doctor profiles from the Elix Health dashboard.
-- Clinic PSE: clinic-owned doctors + doctors granted to their clinic (no soft-delete of grants).
-- Platform PSE: platform doctors (clinic_id is null).

drop policy if exists "doctors_update_clinic_pse" on public.doctors;
create policy "doctors_update_clinic_pse"
  on public.doctors
  for update
  to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and deleted_at is null
    and (
      clinic_id = public.current_clinic_id()
      or public.doctor_granted_to_current_clinic(id)
    )
  )
  with check (
    public.is_clinic_patient_service_executive()
    and (
      clinic_id = public.current_clinic_id()
      or (
        public.doctor_granted_to_current_clinic(id)
        and deleted_at is null
      )
    )
  );

drop policy if exists "doctors_update_platform_pse" on public.doctors;
create policy "doctors_update_platform_pse"
  on public.doctors
  for update
  to authenticated
  using (
    public.is_platform_patient_service_executive()
    and clinic_id is null
    and deleted_at is null
  )
  with check (
    public.is_platform_patient_service_executive()
    and clinic_id is null
  );

comment on policy "doctors_update_clinic_pse" on public.doctors is
  'Clinic PSE may update doctors owned by or granted to their clinic.';

comment on policy "doctors_update_platform_pse" on public.doctors is
  'Platform PSE may update platform (non-clinic) doctor profiles.';
