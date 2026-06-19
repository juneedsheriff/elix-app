-- Admin: view all doctors, manage clinic workspace links (grants + owned).

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      clinic_id is null
      and coalesce(is_visible, true)
      and deleted_at is null
      and not public.is_clinic_patient_service_executive()
    )
    or id = public.current_doctor_id()
    or (public.is_administrator() and deleted_at is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and (
        clinic_id = public.current_clinic_id()
        or public.doctor_granted_to_current_clinic(id)
      )
    )
  );

drop policy if exists "clinic_doctor_grants_delete_admin" on public.clinic_doctor_grants;
create policy "clinic_doctor_grants_delete_admin"
  on public.clinic_doctor_grants for delete to authenticated
  using (public.is_administrator());

create or replace function public.remove_doctor_from_clinic_workspace(
  p_doctor_id uuid,
  p_clinic_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_clinic_id uuid;
  v_removed text;
begin
  if not public.is_administrator() then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1
    from public.clinic_doctor_grants g
    where g.doctor_id = p_doctor_id
      and g.clinic_id = p_clinic_id
  ) then
    delete from public.clinic_doctor_grants
    where doctor_id = p_doctor_id
      and clinic_id = p_clinic_id;
    return 'grant';
  end if;

  select d.clinic_id
  into v_owned_clinic_id
  from public.doctors d
  where d.id = p_doctor_id
    and d.deleted_at is null;

  if v_owned_clinic_id is null then
    raise exception 'Doctor is not linked to this clinic workspace';
  end if;

  if v_owned_clinic_id <> p_clinic_id then
    raise exception 'Doctor is not linked to this clinic workspace';
  end if;

  update public.doctors
  set
    is_visible = false,
    deleted_at = now()
  where id = p_doctor_id
    and clinic_id = p_clinic_id
    and deleted_at is null;

  if not found then
    raise exception 'Doctor could not be removed from clinic workspace';
  end if;

  return 'owned';
end;
$$;

revoke all on function public.remove_doctor_from_clinic_workspace(uuid, uuid) from public;
grant execute on function public.remove_doctor_from_clinic_workspace(uuid, uuid) to authenticated;
