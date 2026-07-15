-- Soft-delete UPDATE must leave the new row visible under SELECT RLS.
-- Staff lists still filter deleted_at IS NULL in the application.

drop policy if exists "patients_select_staff_soft_deleted" on public.patients;
create policy "patients_select_staff_soft_deleted"
  on public.patients for select to authenticated
  using (
    deleted_at is not null
    and (
      public.is_administrator()
      or (
        public.is_clinic_patient_service_executive()
        and clinic_id = public.current_clinic_id()
      )
    )
  );
