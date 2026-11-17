-- PSE clinic country drives patient-facing consultation currency (India → INR, else USD).
-- Patients with no clinic (global) always see USD.

alter table public.pse_clinics
  add column if not exists country text;

update public.pse_clinics
set country = 'India'
where country is null or btrim(country) = '';

alter table public.pse_clinics
  alter column country set default 'India';

alter table public.pse_clinics
  alter column country set not null;

comment on column public.pse_clinics.country is
  'Clinic country. India patients see INR; other PSE countries see USD. Global (no clinic) patients see USD.';
