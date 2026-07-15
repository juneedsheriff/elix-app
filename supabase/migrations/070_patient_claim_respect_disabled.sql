-- Prevent claim_patient_profile_for_login from re-enabling soft-deleted / disabled patients.

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

  -- Already linked: return the row so the app can enforce login_disabled / deleted_at.
  select *
  into v_patient
  from public.patients p
  where p.auth_user_id = v_uid
  limit 1;

  if found then
    return v_patient;
  end if;

  -- Only claim active, login-enabled clinic rows with the same email.
  update public.patients p
  set
    auth_user_id = v_uid,
    updated_at = now()
  where lower(trim(p.email)) = v_email
    and (p.auth_user_id is null or p.auth_user_id = v_uid)
    and coalesce(p.login_disabled, false) = false
    and p.deleted_at is null
  returning *
  into v_patient;

  if not found then
    return null;
  end if;

  return v_patient;
end;
$$;

comment on function public.claim_patient_profile_for_login() is
  'Links the signed-in auth user to an active staff-created patient row with the same email. Skips deleted/disabled profiles.';

revoke all on function public.claim_patient_profile_for_login() from public;
grant execute on function public.claim_patient_profile_for_login() to authenticated;
