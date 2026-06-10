-- Allow patient signup to detect existing auth emails before sending verification codes.
create or replace function public.is_auth_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(p_email))
  );
$$;

revoke all on function public.is_auth_email_registered(text) from public;
grant execute on function public.is_auth_email_registered(text) to anon, authenticated;
