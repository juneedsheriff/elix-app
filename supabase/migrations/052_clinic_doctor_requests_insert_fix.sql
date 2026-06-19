-- Fix clinic_doctor_requests insert: validate platform doctor via security definer
-- (clinic PSE cannot SELECT platform doctors after 051 doctors scope).

create or replace function public.can_clinic_request_platform_doctor(
  p_doctor_id uuid,
  p_clinic_id uuid
)
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
      and d.clinic_id is null
      and d.deleted_at is null
      and coalesce(d.is_visible, true)
  )
  and not exists (
    select 1
    from public.clinic_doctor_grants g
    where g.clinic_id = p_clinic_id
      and g.doctor_id = p_doctor_id
  );
$$;

comment on function public.can_clinic_request_platform_doctor(uuid, uuid) is
  'Whether a clinic may request a platform doctor (bypasses doctors RLS for validation).';

revoke all on function public.can_clinic_request_platform_doctor(uuid, uuid) from public;
grant execute on function public.can_clinic_request_platform_doctor(uuid, uuid) to authenticated;

drop policy if exists "clinic_doctor_requests_insert_clinic" on public.clinic_doctor_requests;
create policy "clinic_doctor_requests_insert_clinic"
  on public.clinic_doctor_requests for insert to authenticated
  with check (
    public.is_clinic_patient_service_executive()
    and clinic_id = public.current_clinic_id()
    and requested_by = public.current_staff_id()
    and status = 'pending'
    and public.can_clinic_request_platform_doctor(doctor_id, clinic_id)
  );
