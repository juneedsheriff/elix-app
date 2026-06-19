-- Restore clinic PSE visibility of approved platform doctors (grants).
-- Merges 047 current_doctor_id() fix with 049 clinic_doctor_grants branch.

create or replace function public.doctor_granted_to_clinic(p_doctor_id uuid, p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_doctor_grants g
    where g.doctor_id = p_doctor_id
      and g.clinic_id = p_clinic_id
  );
$$;

create or replace function public.doctor_granted_to_current_clinic(p_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.doctor_granted_to_clinic(p_doctor_id, public.current_clinic_id());
$$;

comment on function public.doctor_granted_to_clinic(uuid, uuid) is
  'Whether a platform doctor is approved for a clinic workspace (bypasses grants RLS).';

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
    or (public.is_administrator() and clinic_id is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and (
        clinic_id = public.current_clinic_id()
        or public.doctor_granted_to_current_clinic(id)
      )
    )
  );

revoke all on function public.doctor_granted_to_clinic(uuid, uuid) from public;
grant execute on function public.doctor_granted_to_clinic(uuid, uuid) to authenticated;

revoke all on function public.doctor_granted_to_current_clinic(uuid) from public;
grant execute on function public.doctor_granted_to_current_clinic(uuid) to authenticated;

create or replace function public.is_doctor_in_clinic_workspace(p_doctor_id uuid, p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id
      and d.deleted_at is null
      and (
        d.clinic_id = p_clinic_id
        or public.doctor_granted_to_clinic(p_doctor_id, p_clinic_id)
      )
  );
$$;

revoke all on function public.is_doctor_in_clinic_workspace(uuid, uuid) from public;
grant execute on function public.is_doctor_in_clinic_workspace(uuid, uuid) to authenticated;
