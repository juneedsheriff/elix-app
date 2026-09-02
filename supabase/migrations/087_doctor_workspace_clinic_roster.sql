-- Doctor workspace sidebar must list the clinic roster (owned + granted), not the
-- patient browse catalog. Patient browse only returns is_visible doctors and the
-- client then dropped anyone without a matching clinic_id, so granted platform
-- colleagues and hidden clinic doctors never appeared.

drop policy if exists "clinic_doctor_grants_select_own" on public.clinic_doctor_grants;
create policy "clinic_doctor_grants_select_own"
  on public.clinic_doctor_grants
  for select
  to authenticated
  using (doctor_id = public.current_doctor_id());

create or replace function public.list_doctors_for_doctor_workspace(p_limit int default 200)
returns setof public.doctors
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.current_doctor_id() as doctor_id
  ),
  my_clinics as (
    select d.clinic_id as clinic_id
    from public.doctors d
    cross join me
    where d.id = me.doctor_id
      and d.clinic_id is not null
    union
    select g.clinic_id
    from public.clinic_doctor_grants g
    cross join me
    where g.doctor_id = me.doctor_id
  )
  select d.*
  from public.doctors d
  where d.deleted_at is null
    and exists (
      select 1
      from my_clinics c
      where c.clinic_id is not null
        and public.is_doctor_in_clinic_workspace(d.id, c.clinic_id)
    )
  order by d.full_name asc nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 300));
$$;

comment on function public.list_doctors_for_doctor_workspace(int) is
  'Doctors in the signed-in doctor''s clinic workspace (owned + granted, bypasses browse RLS).';

revoke all on function public.list_doctors_for_doctor_workspace(int) from public;
grant execute on function public.list_doctors_for_doctor_workspace(int) to authenticated;

alter function public.list_doctors_for_doctor_workspace(int) owner to postgres;
