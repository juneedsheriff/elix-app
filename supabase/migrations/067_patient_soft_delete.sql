-- Soft delete for patient profiles (admin management)

alter table public.patients
  add column if not exists deleted_at timestamptz;

create index if not exists patients_active_list_idx
  on public.patients (deleted_at, created_at desc)
  where deleted_at is null;

comment on column public.patients.deleted_at is 'Soft delete marker; deleted patients are hidden from admin lists and patient login';

drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own"
  on public.patients for select to authenticated
  using (auth_user_id = auth.uid() and deleted_at is null);

drop policy if exists "patients_select_doctors" on public.patients;
create policy "patients_select_doctors"
  on public.patients for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.doctors d
      where d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "patients_select_staff" on public.patients;
create policy "patients_select_staff"
  on public.patients for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_administrator()
      or (
        public.staff_sees_platform_rows()
        and clinic_id is null
      )
      or (
        public.is_clinic_patient_service_executive()
        and clinic_id = public.current_clinic_id()
      )
    )
  );

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own"
  on public.patients for update to authenticated
  using (auth_user_id = auth.uid() and deleted_at is null)
  with check (auth_user_id = auth.uid() and deleted_at is null);
