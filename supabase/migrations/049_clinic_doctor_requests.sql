-- Clinic PSE requests access to platform doctors; admin approves into clinic_doctor_grants.

create table if not exists public.clinic_doctor_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.pse_clinics (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  requested_by uuid not null references public.admins (id) on delete restrict,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.admins (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_doctor_requests_clinic_idx
  on public.clinic_doctor_requests (clinic_id, created_at desc);

create index if not exists clinic_doctor_requests_status_idx
  on public.clinic_doctor_requests (status, created_at desc)
  where status = 'pending';

create unique index if not exists clinic_doctor_requests_pending_unique
  on public.clinic_doctor_requests (clinic_id, doctor_id)
  where status = 'pending';

comment on table public.clinic_doctor_requests is
  'Clinic PSE requests to add a platform doctor to their clinic workspace';

create table if not exists public.clinic_doctor_grants (
  clinic_id uuid not null references public.pse_clinics (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  granted_by uuid references public.admins (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (clinic_id, doctor_id)
);

create index if not exists clinic_doctor_grants_doctor_idx
  on public.clinic_doctor_grants (doctor_id);

comment on table public.clinic_doctor_grants is
  'Approved platform doctors visible in a clinic PSE workspace';

-- Doctors: clinic PSE sees owned clinic doctors + approved grants.
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
      and (
        clinic_id = public.current_clinic_id()
        or exists (
          select 1
          from public.clinic_doctor_grants g
          where g.clinic_id = public.current_clinic_id()
            and g.doctor_id = doctors.id
        )
      )
    )
  );

alter table public.clinic_doctor_requests enable row level security;
alter table public.clinic_doctor_grants enable row level security;

drop policy if exists "clinic_doctor_requests_select_clinic" on public.clinic_doctor_requests;
create policy "clinic_doctor_requests_select_clinic"
  on public.clinic_doctor_requests for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );

drop policy if exists "clinic_doctor_requests_insert_clinic" on public.clinic_doctor_requests;
create policy "clinic_doctor_requests_insert_clinic"
  on public.clinic_doctor_requests for insert to authenticated
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
    and requested_by = public.current_staff_id()
    and status = 'pending'
    and exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.clinic_id is null
        and d.deleted_at is null
    )
    and not exists (
      select 1
      from public.clinic_doctor_grants g
      where g.clinic_id = clinic_doctor_requests.clinic_id
        and g.doctor_id = clinic_doctor_requests.doctor_id
    )
  );

drop policy if exists "clinic_doctor_grants_select_clinic" on public.clinic_doctor_grants;
create policy "clinic_doctor_grants_select_clinic"
  on public.clinic_doctor_grants for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );

create or replace function public.search_platform_doctors_for_clinic_pse(p_query text default '')
returns table (
  id uuid,
  full_name text,
  email text,
  specialty text,
  clinic_name text,
  clinic_city text,
  clinic_country text,
  qualification text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.full_name,
    d.email,
    d.specialty,
    d.clinic_name,
    d.clinic_city,
    d.clinic_country,
    d.qualification
  from public.doctors d
  where public.is_clinic_patient_service_executive()
    and d.clinic_id is null
    and d.deleted_at is null
    and coalesce(d.is_visible, true)
    and (
      coalesce(trim(p_query), '') = ''
      or d.full_name ilike '%' || trim(p_query) || '%'
      or d.specialty ilike '%' || trim(p_query) || '%'
      or d.email ilike '%' || trim(p_query) || '%'
      or coalesce(d.clinic_name, '') ilike '%' || trim(p_query) || '%'
      or coalesce(d.qualification, '') ilike '%' || trim(p_query) || '%'
    )
  order by d.full_name
  limit 50;
$$;

revoke all on function public.search_platform_doctors_for_clinic_pse(text) from public;
grant execute on function public.search_platform_doctors_for_clinic_pse(text) to authenticated;

create or replace function public.approve_clinic_doctor_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.clinic_doctor_requests%rowtype;
begin
  if not public.is_administrator() then
    raise exception 'Not authorized';
  end if;

  select * into r
  from public.clinic_doctor_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if r.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not exists (
    select 1
    from public.doctors d
    where d.id = r.doctor_id
      and d.clinic_id is null
      and d.deleted_at is null
  ) then
    raise exception 'Platform doctor is not available';
  end if;

  insert into public.clinic_doctor_grants (clinic_id, doctor_id, granted_by)
  values (r.clinic_id, r.doctor_id, public.current_staff_id())
  on conflict (clinic_id, doctor_id) do nothing;

  update public.clinic_doctor_requests
  set
    status = 'approved',
    reviewed_by = public.current_staff_id(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.approve_clinic_doctor_request(uuid) from public;
grant execute on function public.approve_clinic_doctor_request(uuid) to authenticated;

create or replace function public.reject_clinic_doctor_request(
  p_request_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.clinic_doctor_requests%rowtype;
begin
  if not public.is_administrator() then
    raise exception 'Not authorized';
  end if;

  select * into r
  from public.clinic_doctor_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if r.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.clinic_doctor_requests
  set
    status = 'rejected',
    reviewed_by = public.current_staff_id(),
    reviewed_at = now(),
    review_note = nullif(trim(p_review_note), ''),
    updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.reject_clinic_doctor_request(uuid, text) from public;
grant execute on function public.reject_clinic_doctor_request(uuid, text) to authenticated;
