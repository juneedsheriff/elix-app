-- Run in Supabase SQL Editor if npm run db:apply-admin-delete-requests is unavailable.
-- Migration 024: administrators may delete opinion requests

drop policy if exists "opinion_requests_delete_administrator" on public.opinion_requests;
create policy "opinion_requests_delete_administrator"
  on public.opinion_requests
  for delete
  to authenticated
  using (public.is_administrator());

create or replace function public.admin_delete_opinion_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_administrator() then
    raise exception 'Administrator access required';
  end if;

  delete from public.opinion_requests
  where id = p_request_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function public.admin_delete_patient_opinion_requests(p_patient_auth_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_administrator() then
    raise exception 'Administrator access required';
  end if;

  if p_patient_auth_user_id is null then
    return 0;
  end if;

  delete from public.opinion_requests
  where patient_id = p_patient_auth_user_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.admin_delete_opinion_request(uuid) from public;
revoke all on function public.admin_delete_patient_opinion_requests(uuid) from public;

grant execute on function public.admin_delete_opinion_request(uuid) to authenticated;
grant execute on function public.admin_delete_patient_opinion_requests(uuid) to authenticated;
