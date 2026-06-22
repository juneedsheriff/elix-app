-- Visible clinic-registered doctors appear in the global patient doctor catalog
-- while remaining in their clinic workspace for clinic patients.

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      coalesce(is_visible, true)
      and deleted_at is null
      and not public.is_clinic_patient_service_executive()
      and public.current_patient_clinic_id() is null
    )
    or id = public.current_doctor_id()
    or (public.is_administrator() and deleted_at is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and (
        clinic_id = public.current_clinic_id()
        or public.doctor_granted_to_current_clinic(id)
      )
    )
  );

-- Clinic-native doctors created before this change were hidden from search by default.
update public.doctors
set is_visible = true
where clinic_id is not null
  and deleted_at is null
  and is_visible = false;
