-- Extended patient profile fields for onboarding wizard

alter table public.patients
  add column if not exists address text,
  add column if not exists height_cm numeric(5, 1),
  add column if not exists weight_kg numeric(5, 1),
  add column if not exists profile_completed_at timestamptz;

comment on column public.patients.address is 'Street / full address from patient onboarding';
comment on column public.patients.height_cm is 'Height in centimeters (optional)';
comment on column public.patients.weight_kg is 'Weight in kilograms (optional)';
comment on column public.patients.profile_completed_at is 'Set when required onboarding fields are saved';
