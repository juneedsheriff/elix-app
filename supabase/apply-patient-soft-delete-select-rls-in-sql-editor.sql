-- Run in Supabase SQL Editor if npm run db:apply-patient-soft-delete-select-rls is unavailable.
-- Migration 072: allow staff SELECT on soft-deleted patients (needed for soft-delete UPDATE RLS).

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
