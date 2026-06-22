-- Patient medical history fields for profile settings

alter table public.patients
  add column if not exists family_history text,
  add column if not exists social_history text,
  add column if not exists surgical_history text,
  add column if not exists medical_history text;

comment on column public.patients.family_history is 'Family medical history (optional)';
comment on column public.patients.social_history is 'Social history e.g. smoking, alcohol (optional)';
comment on column public.patients.surgical_history is 'Past surgical procedures (optional)';
comment on column public.patients.medical_history is 'Past medical conditions and diagnoses (optional)';
