-- Duration-based consultation pricing (15 min / 30 min tiers)

alter table public.doctors
  add column if not exists consultation_tiers jsonb not null default '[]'::jsonb;

comment on column public.doctors.consultation_tiers is
  'Array of {duration_minutes, fee_usd} consultation pricing tiers.';

update public.doctors
set consultation_tiers = jsonb_build_array(
  jsonb_build_object(
    'duration_minutes', 15,
    'fee_usd', greatest(0, round(coalesce(consultation_fee, fee_usd, 0) / 2.0)::integer)
  ),
  jsonb_build_object(
    'duration_minutes', 30,
    'fee_usd', greatest(0, coalesce(consultation_fee, fee_usd, 0)::integer)
  )
)
where consultation_tiers = '[]'::jsonb
  and coalesce(consultation_fee, fee_usd, 0) > 0;

update public.doctors
set consultation_tiers = jsonb_build_array(
  jsonb_build_object('duration_minutes', 15, 'fee_usd', 50),
  jsonb_build_object('duration_minutes', 30, 'fee_usd', 100)
)
where consultation_tiers = '[]'::jsonb;

alter table public.opinion_requests
  add column if not exists consultation_duration_minutes integer,
  add column if not exists consultation_fee_usd integer;

comment on column public.opinion_requests.consultation_duration_minutes is
  'Patient- or PSE-selected consultation length in minutes.';
comment on column public.opinion_requests.consultation_fee_usd is
  'Quoted consultation fee in USD for the selected duration.';

create or replace function public.update_own_doctor_consultation_tiers(p_tiers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee_30 integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select greatest(0, round((elem->>'fee_usd')::numeric))::integer
  into v_fee_30
  from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) as elem
  where (elem->>'duration_minutes')::integer = 30
  limit 1;

  update public.doctors
  set
    consultation_tiers = coalesce(p_tiers, '[]'::jsonb),
    consultation_fee = coalesce(v_fee_30, consultation_fee),
    fee_usd = coalesce(v_fee_30, fee_usd)
  where auth_user_id = auth.uid();
end;
$$;

grant execute on function public.update_own_doctor_consultation_tiers(jsonb) to authenticated;
