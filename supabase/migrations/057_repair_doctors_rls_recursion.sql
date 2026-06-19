-- Repair doctors RLS infinite recursion.
-- Ensures security-definer helpers bypass doctors RLS and restores the canonical SELECT policy.

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.doctors d
  where d.auth_user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_doctor_id() is
  'Auth-linked doctor profile id for the signed-in user (bypasses RLS).';

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

revoke all on function public.doctor_granted_to_clinic(uuid, uuid) from public;
grant execute on function public.doctor_granted_to_clinic(uuid, uuid) to authenticated;

revoke all on function public.doctor_granted_to_current_clinic(uuid) from public;
grant execute on function public.doctor_granted_to_current_clinic(uuid) to authenticated;

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

alter function public.current_doctor_id() owner to postgres;
alter function public.doctor_granted_to_clinic(uuid, uuid) owner to postgres;
alter function public.doctor_granted_to_current_clinic(uuid) owner to postgres;
