-- Clinic PSE must not see the full platform doctor catalog via the public SELECT branch.

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      clinic_id is null
      and coalesce(is_visible, true)
      and deleted_at is null
      and not public.is_clinic_patient_service_executive()
    )
    or id = public.current_doctor_id()
    or (public.is_administrator() and clinic_id is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and (
        clinic_id = public.current_clinic_id()
        or public.doctor_granted_to_current_clinic(id)
      )
    )
  );
