-- Clinic PSE: resolve clinic_id on opinion_requests from doctor when patient has no auth login.

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
