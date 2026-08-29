-- Branch contact details for clinic workspaces, readable by assigned patients.

alter table public.pse_clinics
  add column if not exists location text,
  add column if not exists email text,
  add column if not exists phone text;

comment on column public.pse_clinics.location is 'Public branch location shown to assigned patients.';
comment on column public.pse_clinics.email is 'Public branch email shown to assigned patients.';
comment on column public.pse_clinics.phone is 'Public branch contact number shown to assigned patients.';

drop policy if exists "pse_clinics_select_assigned_patient" on public.pse_clinics;
create policy "pse_clinics_select_assigned_patient"
  on public.pse_clinics
  for select
  to authenticated
  using (
    public.current_patient_clinic_id() is not null
    and id = public.current_patient_clinic_id()
  );
