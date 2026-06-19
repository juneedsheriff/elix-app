-- Fix infinite recursion in doctors_select_public (045 queried doctors inside doctors RLS).

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

comment on function public.current_doctor_id() is 'Auth-linked doctor profile id for the signed-in user (bypasses RLS).';

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated
  using (
    (
      clinic_id is null
      and coalesce(is_visible, true)
      and deleted_at is null
    )
    or id = public.current_doctor_id()
    or (public.is_administrator() and clinic_id is null)
    or (public.is_platform_patient_service_executive() and clinic_id is null)
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
    )
  );
