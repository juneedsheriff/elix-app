-- Allow clinic PSE to delete opinion requests scoped to their clinic.

drop policy if exists "opinion_requests_delete_clinic_pse" on public.opinion_requests;
create policy "opinion_requests_delete_clinic_pse"
  on public.opinion_requests
  for delete
  to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
  );

create or replace function public.admin_delete_opinion_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if public.is_administrator() then
    delete from public.opinion_requests
    where id = p_request_id;
  elsif public.is_clinic_patient_service_executive() then
    delete from public.opinion_requests
    where id = p_request_id
      and clinic_id = public.current_clinic_id();
  else
    raise exception 'Administrator access required';
  end if;

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
  if p_patient_auth_user_id is null then
    return 0;
  end if;

  if public.is_administrator() then
    delete from public.opinion_requests
    where patient_id = p_patient_auth_user_id;
  elsif public.is_clinic_patient_service_executive() then
    delete from public.opinion_requests
    where patient_id = p_patient_auth_user_id
      and clinic_id = public.current_clinic_id();
  else
    raise exception 'Administrator access required';
  end if;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.admin_delete_opinion_request(uuid) from public;
revoke all on function public.admin_delete_patient_opinion_requests(uuid) from public;

grant execute on function public.admin_delete_opinion_request(uuid) to authenticated;
grant execute on function public.admin_delete_patient_opinion_requests(uuid) to authenticated;
