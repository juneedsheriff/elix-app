-- Admin can grant platform doctors to clinic PSE workspaces from doctor profile.

create or replace function public.grant_doctor_to_clinic_workspace(
  p_doctor_id uuid,
  p_clinic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id
      and d.clinic_id is null
      and d.deleted_at is null
  ) then
    raise exception 'Only platform doctors can be added to a clinic workspace';
  end if;

  if not exists (
    select 1
    from public.pse_clinics c
    where c.id = p_clinic_id
  ) then
    raise exception 'Clinic workspace not found';
  end if;

  insert into public.clinic_doctor_grants (clinic_id, doctor_id, granted_by)
  values (p_clinic_id, p_doctor_id, public.current_staff_id())
  on conflict (clinic_id, doctor_id) do nothing;

  update public.clinic_doctor_requests
  set
    status = 'approved',
    reviewed_by = public.current_staff_id(),
    reviewed_at = now(),
    updated_at = now()
  where clinic_id = p_clinic_id
    and doctor_id = p_doctor_id
    and status = 'pending';
end;
$$;

revoke all on function public.grant_doctor_to_clinic_workspace(uuid, uuid) from public;
grant execute on function public.grant_doctor_to_clinic_workspace(uuid, uuid) to authenticated;
