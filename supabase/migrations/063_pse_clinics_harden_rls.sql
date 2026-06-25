-- Harden RLS for pse_clinics to avoid "UNRESTRICTED" access in Supabase.

alter table public.pse_clinics enable row level security;
alter table public.pse_clinics force row level security;

-- Remove permissive default policies if they were created in the dashboard.
drop policy if exists "Enable read access for all users" on public.pse_clinics;
drop policy if exists "Enable insert for authenticated users only" on public.pse_clinics;
drop policy if exists "Enable update for users based on email" on public.pse_clinics;
drop policy if exists "Enable delete for users based on email" on public.pse_clinics;

drop policy if exists "pse_clinics_select_platform_staff" on public.pse_clinics;
create policy "pse_clinics_select_platform_staff"
  on public.pse_clinics
  for select
  to authenticated
  using (public.is_administrator() or public.is_platform_patient_service_executive());

drop policy if exists "pse_clinics_select_clinic_pse" on public.pse_clinics;
create policy "pse_clinics_select_clinic_pse"
  on public.pse_clinics
  for select
  to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and id = public.current_clinic_id()
  );

drop policy if exists "pse_clinics_insert_admin" on public.pse_clinics;
create policy "pse_clinics_insert_admin"
  on public.pse_clinics
  for insert
  to authenticated
  with check (public.is_administrator());

drop policy if exists "pse_clinics_update_admin" on public.pse_clinics;
create policy "pse_clinics_update_admin"
  on public.pse_clinics
  for update
  to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());

drop policy if exists "pse_clinics_delete_admin" on public.pse_clinics;
create policy "pse_clinics_delete_admin"
  on public.pse_clinics
  for delete
  to authenticated
  using (public.is_administrator());
