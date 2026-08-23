-- Auto-assign clinic patient requests to a clinic PSE so they appear as assigned
-- (not unassigned "New" under All) in the clinic PSE requests queue.

create or replace function public.set_opinion_request_clinic_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_clinic_id uuid;
  assignee_id uuid;
begin
  -- Resolve clinic from patient or doctor when not already set.
  if new.clinic_id is null and new.patient_id is not null then
    select p.clinic_id
    into resolved_clinic_id
    from public.patients p
    where p.auth_user_id = new.patient_id
    limit 1;

    if resolved_clinic_id is not null then
      new.clinic_id := resolved_clinic_id;
    end if;
  end if;

  if new.clinic_id is null and new.doctor_id is not null then
    select d.clinic_id
    into resolved_clinic_id
    from public.doctors d
    where d.id = new.doctor_id
    limit 1;

    if resolved_clinic_id is not null then
      new.clinic_id := resolved_clinic_id;
    end if;
  end if;

  -- Clinic-scoped requests without an assignee go to an active clinic PSE.
  if new.clinic_id is not null and new.assigned_to is null then
    select a.id
    into assignee_id
    from public.admins a
    where a.role = 'patient_service_executive_clinic'
      and a.clinic_id = new.clinic_id
      and coalesce(a.is_active, true) = true
    order by a.created_at asc nulls last
    limit 1;

    if assignee_id is not null then
      new.assigned_to := assignee_id;
      new.assigned_at := coalesce(new.assigned_at, now());
      if new.consultation_stage is null or new.consultation_stage = 'new' then
        new.consultation_stage := 'assigned';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.set_opinion_request_clinic_id() is
  'Sets opinion_requests.clinic_id from patient/doctor and auto-assigns clinic requests to a clinic PSE.';

-- Ensure trigger exists (idempotent).
drop trigger if exists opinion_requests_set_clinic_id on public.opinion_requests;
create trigger opinion_requests_set_clinic_id
  before insert or update of patient_id, doctor_id, clinic_id, assigned_to
  on public.opinion_requests
  for each row
  execute function public.set_opinion_request_clinic_id();

-- Backfill existing unassigned clinic requests.
update public.opinion_requests r
set
  assigned_to = (
    select adm.id
    from public.admins adm
    where adm.role = 'patient_service_executive_clinic'
      and adm.clinic_id = r.clinic_id
      and coalesce(adm.is_active, true) = true
    order by adm.created_at asc nulls last
    limit 1
  ),
  assigned_at = coalesce(r.assigned_at, now()),
  consultation_stage = case
    when r.consultation_stage is null or r.consultation_stage = 'new' then 'assigned'
    else r.consultation_stage
  end
where r.clinic_id is not null
  and r.assigned_to is null
  and r.status = 'submitted'
  and exists (
    select 1
    from public.admins adm
    where adm.role = 'patient_service_executive_clinic'
      and adm.clinic_id = r.clinic_id
      and coalesce(adm.is_active, true) = true
  );
