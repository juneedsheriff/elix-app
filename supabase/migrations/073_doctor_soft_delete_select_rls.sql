-- Soft-delete UPDATE must leave the new doctor row visible under SELECT RLS.
-- Admin/clinic lists still filter deleted_at IS NULL in the application.

-- Allow staff to SELECT soft-deleted doctors they manage (required for soft-delete UPDATE).
drop policy if exists "doctors_select_staff_soft_deleted" on public.doctors;
create policy "doctors_select_staff_soft_deleted"
  on public.doctors for select to authenticated
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

-- Hide soft-deleted doctors from clinic PSE active workspace listing via SELECT
-- (client also filters deleted_at is null; this keeps grants/public paths consistent).
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
    or (id = public.current_doctor_id() and deleted_at is null)
    or (public.is_administrator() and deleted_at is null)
    or (
      public.is_platform_patient_service_executive()
      and clinic_id is null
      and deleted_at is null
    )
    or (
      public.is_clinic_patient_service_executive()
      and deleted_at is null
      and (
        clinic_id = public.current_clinic_id()
        or public.doctor_granted_to_current_clinic(id)
      )
    )
  );

-- Administrators can soft-delete / update any doctor (platform + clinic).
drop policy if exists "doctors_update_platform_admin" on public.doctors;
create policy "doctors_update_platform_admin"
  on public.doctors for update to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());
