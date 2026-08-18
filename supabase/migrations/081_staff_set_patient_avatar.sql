-- Staff (admin, clinic PSE, global/platform PSE) can set a patient profile photo.
-- Restricts the write to avatar_url so platform PSE cannot edit other profile fields.

create or replace function public.staff_set_patient_avatar(
  p_patient_id uuid,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if public.is_administrator() then
    update public.patients
    set avatar_url = p_avatar_url,
        updated_at = now()
    where id = p_patient_id
      and deleted_at is null;
  elsif public.is_clinic_patient_service_executive() then
    update public.patients
    set avatar_url = p_avatar_url,
        updated_at = now()
    where id = p_patient_id
      and clinic_id = public.current_clinic_id()
      and deleted_at is null;
  elsif public.is_platform_patient_service_executive() then
    update public.patients
    set avatar_url = p_avatar_url,
        updated_at = now()
    where id = p_patient_id
      and clinic_id is null
      and deleted_at is null;
  else
    raise exception 'Not allowed to update this patient photo';
  end if;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Patient photo could not be updated';
  end if;
end;
$$;

revoke all on function public.staff_set_patient_avatar(uuid, text) from public;
grant execute on function public.staff_set_patient_avatar(uuid, text) to authenticated;
