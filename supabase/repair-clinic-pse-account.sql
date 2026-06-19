-- Repair a staff account that was saved as platform PSE before migration 045.
-- Run in Supabase SQL Editor. Change email and clinic name as needed.

do $$
declare
  v_email text := 'pse1@elixclinx.com';
  v_clinic_name text := 'Elix Clinic';
  v_admin_id uuid;
  v_auth_user_id uuid;
  v_clinic_id uuid;
begin
  select id, auth_user_id
  into v_admin_id, v_auth_user_id
  from public.admins
  where lower(email) = lower(v_email)
  limit 1;

  if v_admin_id is null then
    raise exception 'No admin row found for %', v_email;
  end if;

  insert into public.pse_clinics (name)
  values (v_clinic_name)
  returning id into v_clinic_id;

  update public.admins
  set
    role = 'patient_service_executive_clinic',
    clinic_id = v_clinic_id,
    updated_at = now()
  where id = v_admin_id;

  raise notice 'Updated admin % with clinic % (%)', v_email, v_clinic_name, v_clinic_id;
end $$;

-- Verify
select a.email, a.full_name, a.role, a.clinic_id, c.name as clinic_name
from public.admins a
left join public.pse_clinics c on c.id = a.clinic_id
where lower(a.email) = lower('pse1@elixclinx.com');
