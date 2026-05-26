-- Run once in Supabase Dashboard → SQL Editor
-- Applies staff roles + request assignment workflow (migrations 016 + 017)

-- 016: admin approval gate for doctors
drop policy if exists "opinion_requests_update_admins" on public.opinion_requests;
create policy "opinion_requests_update_admins"
  on public.opinion_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests
  for select
  to authenticated
  using (
    opinion_requests.status in ('in_review', 'closed')
    and exists (
      select 1
      from public.doctors d
      where d.id = opinion_requests.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "uploaded_files_select_doctor_request" on public.uploaded_files;
create policy "uploaded_files_select_doctor_request"
  on public.uploaded_files
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where orr.record_id = uploaded_files.id
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "medical_records_storage_select_doctor" on storage.objects;
create policy "medical_records_storage_select_doctor"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'medical-records'
    and exists (
      select 1
      from public.uploaded_files uf
      join public.opinion_request_records orr on orr.record_id = uf.id
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where uf.storage_path = name
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

-- 017: staff roles + assignment
alter table public.admins
  add column if not exists role text not null default 'administrator'
  check (role in ('administrator', 'patient_service_executive'));

comment on column public.admins.role is 'Elix Health staff role';

alter table public.opinion_requests
  add column if not exists assigned_to uuid references public.admins (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists coordination_notes text;

create index if not exists opinion_requests_assigned_to_idx on public.opinion_requests (assigned_to);

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.admins a
  where a.auth_user_id = auth.uid()
    and a.is_active = true
  limit 1;
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.admins a
  where a.auth_user_id = auth.uid()
    and a.is_active = true
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_id() is not null;
$$;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'administrator';
$$;

create or replace function public.is_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'patient_service_executive';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff();
$$;

drop policy if exists "patients_select_admins" on public.patients;
create policy "patients_select_admins"
  on public.patients for select to authenticated using (public.is_staff());

drop policy if exists "patients_update_admins" on public.patients;
create policy "patients_update_admins"
  on public.patients for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

drop policy if exists "doctors_update_admins" on public.doctors;
create policy "doctors_update_admins"
  on public.doctors for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

drop policy if exists "uploaded_files_select_admins" on public.uploaded_files;
create policy "uploaded_files_select_admins"
  on public.uploaded_files for select to authenticated using (public.is_staff());

drop policy if exists "uploaded_files_select_pse_assigned" on public.uploaded_files;
create policy "uploaded_files_select_pse_assigned"
  on public.uploaded_files for select to authenticated
  using (
    public.is_patient_service_executive()
    and exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.assigned_to = public.current_staff_id()
    )
  );

drop policy if exists "opinion_requests_select_admins" on public.opinion_requests;
create policy "opinion_requests_select_staff"
  on public.opinion_requests for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_patient_service_executive()
      and assigned_to = public.current_staff_id()
    )
  );

drop policy if exists "opinion_requests_update_admins" on public.opinion_requests;
create policy "opinion_requests_update_administrator"
  on public.opinion_requests for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

drop policy if exists "opinion_requests_update_pse" on public.opinion_requests;
create policy "opinion_requests_update_pse"
  on public.opinion_requests for update to authenticated
  using (
    public.is_patient_service_executive()
    and assigned_to = public.current_staff_id()
  )
  with check (
    public.is_patient_service_executive()
    and assigned_to = public.current_staff_id()
  );

drop policy if exists "opinion_request_records_select_admins" on public.opinion_request_records;
create policy "opinion_request_records_select_staff"
  on public.opinion_request_records for select to authenticated using (public.is_staff());

drop policy if exists "admins_select_all_admins" on public.admins;
create policy "admins_select_all_admins"
  on public.admins for select to authenticated using (public.is_administrator());

drop policy if exists "admins_select_staff_directory" on public.admins;
create policy "admins_select_staff_directory"
  on public.admins for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_patient_service_executive()
      and role = 'patient_service_executive'
      and is_active = true
    )
  );
