-- Doctor consultation pricing currency (USD / INR)

alter table public.doctors
  add column if not exists consultation_currency text not null default 'USD';

alter table public.doctors
  drop constraint if exists doctors_consultation_currency_check;

alter table public.doctors
  add constraint doctors_consultation_currency_check
  check (consultation_currency in ('USD', 'INR'));

comment on column public.doctors.consultation_currency is
  'Currency for consultation_tiers fee amounts (USD or INR).';

alter table public.opinion_requests
  add column if not exists consultation_currency text;

comment on column public.opinion_requests.consultation_currency is
  'Currency for consultation_fee_usd at time of patient selection.';

create or replace function public.update_own_doctor_consultation_pricing(
  p_tiers jsonb,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee_30 integer;
  v_currency text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_currency := case
    when upper(coalesce(p_currency, '')) = 'INR' then 'INR'
    when upper(coalesce(p_currency, '')) = 'USD' then 'USD'
    else null
  end;

  select greatest(0, round((elem->>'fee_usd')::numeric))::integer
  into v_fee_30
  from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) as elem
  where (elem->>'duration_minutes')::integer = 30
  limit 1;

  update public.doctors
  set
    consultation_tiers = coalesce(p_tiers, '[]'::jsonb),
    consultation_fee = coalesce(v_fee_30, consultation_fee),
    fee_usd = coalesce(v_fee_30, fee_usd),
    consultation_currency = coalesce(v_currency, consultation_currency)
  where auth_user_id = auth.uid();
end;
$$;

grant execute on function public.update_own_doctor_consultation_pricing(jsonb, text) to authenticated;

create or replace function public.update_own_doctor_consultation_tiers(p_tiers jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  select public.update_own_doctor_consultation_pricing(p_tiers, null);
$$;

grant execute on function public.update_own_doctor_consultation_tiers(jsonb) to authenticated;
