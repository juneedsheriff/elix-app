-- Reliable patient doctor browse: bypasses RLS edge cases for clinic + platform visibility.

create or replace function public.list_doctors_for_patient_browse(p_limit int default 50)
returns setof public.doctors
language sql
stable
security definer
set search_path = public
as $$
  with patient_ctx as (
    select p.clinic_id as clinic_id
    from public.patients p
    where p.auth_user_id = auth.uid()
    limit 1
  )
  select d.*
  from public.doctors d
  where d.deleted_at is null
    and (
      -- Platform / anonymous browse: every doctor marked visible (null = visible).
      (
        (select clinic_id from patient_ctx) is null
        and coalesce(d.is_visible, true)
      )
      or
      -- Clinic-managed patient: doctors in their clinic workspace.
      (
        (select clinic_id from patient_ctx) is not null
        and public.is_doctor_in_clinic_workspace(d.id, (select clinic_id from patient_ctx))
      )
    )
  order by d.rating desc nulls last, d.full_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

comment on function public.list_doctors_for_patient_browse(int) is
  'Patient-facing doctor catalog (platform visible doctors + clinic workspace doctors).';

revoke all on function public.list_doctors_for_patient_browse(int) from public;
grant execute on function public.list_doctors_for_patient_browse(int) to anon, authenticated;

-- Keep public SELECT policy aligned (visible doctors globally, not only clinic_id is null).
drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      coalesce(is_visible, true)
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

alter function public.list_doctors_for_patient_browse(int) owner to postgres;
