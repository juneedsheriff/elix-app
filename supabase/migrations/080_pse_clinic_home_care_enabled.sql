-- Enable/disable Home Care Services per PSE clinic workspace.

alter table public.pse_clinics
  add column if not exists home_care_enabled boolean not null default true;

comment on column public.pse_clinics.home_care_enabled is
  'When true, clinic PSE staff can create and manage Home Care requests for this workspace.';
