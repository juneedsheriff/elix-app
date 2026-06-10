-- Treat patient signup as complete only when a profile (or staff record) exists.
-- Incomplete auth-only signups can be cleaned up so the user can try again.

create or replace function public.is_auth_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.patients p
    where lower(trim(p.email)) = lower(trim(p_email))
  )
  or exists (
    select 1
    from public.admins a
    where lower(trim(a.email)) = lower(trim(p_email))
  )
  or exists (
    select 1
    from public.doctors d
    where d.email is not null
      and lower(trim(d.email)) = lower(trim(p_email))
  )
  or exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(p_email))
      and coalesce(u.raw_user_meta_data->>'role', '') in (
        'administrator',
        'admin',
        'patient_service_executive'
      )
  );
$$;

create or replace function public.cleanup_patient_signup_orphan(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if public.is_auth_email_registered(p_email) then
    return false;
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
    and coalesce(u.raw_user_meta_data->>'role', 'patient') = 'patient'
  limit 1;

  if v_user_id is null then
    return false;
  end if;

  delete from auth.users where id = v_user_id;
  return true;
end;
$$;

revoke all on function public.is_auth_email_registered(text) from public;
grant execute on function public.is_auth_email_registered(text) to anon, authenticated;

revoke all on function public.cleanup_patient_signup_orphan(text) from public;
grant execute on function public.cleanup_patient_signup_orphan(text) to anon, authenticated;
