-- Clinic patients browse and request opinions only from doctors in their PSE clinic workspace.

create or replace function public.current_patient_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.clinic_id
  from public.patients p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_patient_clinic_id() is
  'Clinic workspace for the signed-in patient (null = platform patient).';

revoke all on function public.current_patient_clinic_id() from public;
grant execute on function public.current_patient_clinic_id() to authenticated;

drop policy if exists "doctors_select_clinic_patient" on public.doctors;
create policy "doctors_select_clinic_patient"
  on public.doctors for select to authenticated
  using (
    deleted_at is null
    and public.current_patient_clinic_id() is not null
    and public.is_doctor_in_clinic_workspace(id, public.current_patient_clinic_id())
  );

-- Platform catalog: anonymous + platform patients only (not clinic-managed patients).
drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      clinic_id is null
      and coalesce(is_visible, true)
      and deleted_at is null
      and not public.is_clinic_patient_service_executive()
      and public.current_patient_clinic_id() is null
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

alter function public.current_patient_clinic_id() owner to postgres;
