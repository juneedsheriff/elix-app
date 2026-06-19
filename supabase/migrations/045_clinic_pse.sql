-- Clinic-scoped Patient Service Executives with isolated patients, doctors, and requests.

create table if not exists public.pse_clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pse_clinics is 'Isolated workspace for clinic Patient Service Executives';

alter table public.admins
  add column if not exists clinic_id uuid references public.pse_clinics (id) on delete set null;

alter table public.patients
  add column if not exists clinic_id uuid references public.pse_clinics (id) on delete set null;

alter table public.doctors
  add column if not exists clinic_id uuid references public.pse_clinics (id) on delete set null;

alter table public.opinion_requests
  add column if not exists clinic_id uuid references public.pse_clinics (id) on delete set null;

create index if not exists admins_clinic_id_idx on public.admins (clinic_id) where clinic_id is not null;
create index if not exists patients_clinic_id_idx on public.patients (clinic_id) where clinic_id is not null;
create index if not exists doctors_clinic_id_idx on public.doctors (clinic_id) where clinic_id is not null;
create index if not exists opinion_requests_clinic_id_idx on public.opinion_requests (clinic_id) where clinic_id is not null;

alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins
  add constraint admins_role_check
  check (role in ('administrator', 'patient_service_executive', 'patient_service_executive_clinic'));

comment on column public.admins.clinic_id is 'Clinic workspace for patient_service_executive_clinic staff';
comment on column public.patients.clinic_id is 'Null = platform patient; set for clinic PSE-managed patients';
comment on column public.doctors.clinic_id is 'Null = platform doctor; set for clinic PSE-managed doctors';
comment on column public.opinion_requests.clinic_id is 'Null = platform request; set for clinic-scoped coordination';

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.clinic_id
  from public.admins a
  where a.auth_user_id = auth.uid()
    and a.is_active = true
    and a.role = 'patient_service_executive_clinic'
  limit 1;
$$;

create or replace function public.is_platform_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'patient_service_executive';
$$;

create or replace function public.is_clinic_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'patient_service_executive_clinic';
$$;

create or replace function public.is_any_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_patient_service_executive()
    or public.is_clinic_patient_service_executive();
$$;

create or replace function public.is_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_patient_service_executive();
$$;

create or replace function public.staff_sees_platform_rows()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_administrator() or public.is_platform_patient_service_executive();
$$;

-- Patients: platform staff see only platform rows; clinic PSE sees their clinic.
drop policy if exists "patients_select_admins" on public.patients;
create policy "patients_select_staff"
  on public.patients for select to authenticated
  using (
    (public.staff_sees_platform_rows() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );

drop policy if exists "patients_update_admins" on public.patients;
create policy "patients_update_platform_admin"
  on public.patients for update to authenticated
  using (public.is_administrator() and clinic_id is null)
  with check (public.is_administrator() and clinic_id is null);

drop policy if exists "patients_update_clinic_pse" on public.patients;
create policy "patients_update_clinic_pse"
  on public.patients for update to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  )
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  );

drop policy if exists "patients_insert_clinic_pse" on public.patients;
create policy "patients_insert_clinic_pse"
  on public.patients for insert to authenticated
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  );

-- Doctors: hide clinic rows from public search; scope staff reads/writes.
create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.doctors d
  where d.auth_user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      clinic_id is null
      and coalesce(is_visible, true)
      and deleted_at is null
    )
    or id = public.current_doctor_id()
    or (public.is_administrator() and clinic_id is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );

drop policy if exists "doctors_update_admins" on public.doctors;
create policy "doctors_update_platform_admin"
  on public.doctors for update to authenticated
  using (public.is_administrator() and clinic_id is null)
  with check (public.is_administrator() and clinic_id is null);

drop policy if exists "doctors_update_clinic_pse" on public.doctors;
create policy "doctors_update_clinic_pse"
  on public.doctors for update to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  )
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  );

drop policy if exists "doctors_insert_admins" on public.doctors;
create policy "doctors_insert_platform_admin"
  on public.doctors for insert to authenticated
  with check (public.is_administrator() and clinic_id is null);

drop policy if exists "doctors_insert_clinic_pse" on public.doctors;
create policy "doctors_insert_clinic_pse"
  on public.doctors for insert to authenticated
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  );

-- Opinion requests: platform admin/PSE never see clinic rows.
drop policy if exists "opinion_requests_select_staff" on public.opinion_requests;
create policy "opinion_requests_select_staff"
  on public.opinion_requests for select to authenticated
  using (
    (public.is_administrator() and clinic_id is null)
    or (
      public.is_platform_patient_service_executive()
      and clinic_id is null
      and assigned_to = public.current_staff_id()
    )
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
      and (
        assigned_to = public.current_staff_id()
        or assigned_to is null
      )
    )
  );

drop policy if exists "opinion_requests_update_pse" on public.opinion_requests;
create policy "opinion_requests_update_platform_pse"
  on public.opinion_requests for update to authenticated
  using (
    public.is_platform_patient_service_executive()
    and clinic_id is null
    and assigned_to = public.current_staff_id()
  )
  with check (
    public.is_platform_patient_service_executive()
    and clinic_id is null
    and assigned_to = public.current_staff_id()
  );

drop policy if exists "opinion_requests_update_clinic_pse" on public.opinion_requests;
create policy "opinion_requests_update_clinic_pse"
  on public.opinion_requests for update to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
    and (
      assigned_to = public.current_staff_id()
      or assigned_to is null
    )
  )
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
    and assigned_to = public.current_staff_id()
  );

drop policy if exists "uploaded_files_select_pse_assigned" on public.uploaded_files;
create policy "uploaded_files_select_pse_assigned"
  on public.uploaded_files for select to authenticated
  using (
    public.is_platform_patient_service_executive()
    and exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.assigned_to = public.current_staff_id()
        and oreq.clinic_id is null
    )
  );

drop policy if exists "uploaded_files_select_clinic_pse_assigned" on public.uploaded_files;
create policy "uploaded_files_select_clinic_pse_assigned"
  on public.uploaded_files for select to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.assigned_to = public.current_staff_id()
        and oreq.clinic_id = public.current_clinic_id()
    )
  );

drop policy if exists "uploaded_files_select_admins" on public.uploaded_files;
create policy "uploaded_files_select_platform_staff"
  on public.uploaded_files for select to authenticated
  using (
    public.staff_sees_platform_rows()
    and not exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.clinic_id is not null
    )
  );

-- Backfill clinic_id on requests from patient profile when possible.
create or replace function public.set_opinion_request_clinic_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_clinic_id uuid;
begin
  if new.clinic_id is not null then
    return new;
  end if;

  if new.patient_id is not null then
    select p.clinic_id
    into resolved_clinic_id
    from public.patients p
    where p.auth_user_id = new.patient_id
    limit 1;

    if resolved_clinic_id is not null then
      new.clinic_id := resolved_clinic_id;
      return new;
    end if;
  end if;

  if new.doctor_id is not null then
    select d.clinic_id
    into resolved_clinic_id
    from public.doctors d
    where d.id = new.doctor_id
    limit 1;

    if resolved_clinic_id is not null then
      new.clinic_id := resolved_clinic_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists opinion_requests_set_clinic_id on public.opinion_requests;
create trigger opinion_requests_set_clinic_id
  before insert or update of patient_id on public.opinion_requests
  for each row
  execute function public.set_opinion_request_clinic_id();
