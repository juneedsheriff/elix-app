-- Allow doctors to update their own scheduler / weekly availability settings.

create or replace function public.update_own_doctor_scheduler(
  p_scheduler_effect_from date default null,
  p_scheduler_time_interval integer default null,
  p_scheduler_color text default null,
  p_elix_patient_priority boolean default false,
  p_time_settings jsonb default '{}'::jsonb,
  p_consultation_hours jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color text;
  v_interval integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_color := nullif(trim(coalesce(p_scheduler_color, '')), '');
  if v_color is null then
    v_color := '#09abc0';
  end if;

  v_interval := p_scheduler_time_interval;
  if v_interval is not null and v_interval < 5 then
    raise exception 'Time interval must be at least 5 minutes';
  end if;

  update public.doctors
  set
    scheduler_effect_from = p_scheduler_effect_from,
    scheduler_time_interval = v_interval,
    scheduler_color = v_color,
    elix_patient_priority = coalesce(p_elix_patient_priority, false),
    time_settings = coalesce(p_time_settings, '{}'::jsonb),
    consultation_hours = coalesce(p_consultation_hours, consultation_hours)
  where auth_user_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Doctor profile not found for this account';
  end if;
end;
$$;

comment on function public.update_own_doctor_scheduler is
  'Lets the authenticated doctor update their own scheduler and weekly availability.';

grant execute on function public.update_own_doctor_scheduler(
  date, integer, text, boolean, jsonb, jsonb
) to authenticated;
