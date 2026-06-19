-- RLS for pse_clinics (was created without policies in 045)

alter table public.pse_clinics enable row level security;

drop policy if exists "pse_clinics_select_platform_staff" on public.pse_clinics;
create policy "pse_clinics_select_platform_staff"
  on public.pse_clinics for select to authenticated
  using (public.is_administrator() or public.is_platform_patient_service_executive());

drop policy if exists "pse_clinics_select_clinic_pse" on public.pse_clinics;
create policy "pse_clinics_select_clinic_pse"
  on public.pse_clinics for select to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and id = public.current_clinic_id()
  );
