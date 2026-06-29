-- Let patients sign in to clinic/PSE-created profiles (auth_user_id was null until first login).

create or replace function public.claim_patient_profile_for_login()
returns public.patients
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_patient public.patients%rowtype;
begin
  if v_uid is null then
    return null;
  end if;

  if v_email = '' then
    return null;
  end if;

  select *
  into v_patient
  from public.patients p
  where p.auth_user_id = v_uid
  limit 1;

  if found then
    return v_patient;
  end if;

  update public.patients p
  set
    auth_user_id = v_uid,
    login_disabled = false,
    updated_at = now()
  where lower(trim(p.email)) = v_email
    and (p.auth_user_id is null or p.auth_user_id = v_uid)
  returning *
  into v_patient;

  if not found then
    return null;
  end if;

  return v_patient;
end;
$$;

comment on function public.claim_patient_profile_for_login() is
  'Links the signed-in auth user to a staff-created patient row with the same email.';

revoke all on function public.claim_patient_profile_for_login() from public;
grant execute on function public.claim_patient_profile_for_login() to authenticated;
