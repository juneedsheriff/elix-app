-- Allow administrators to view clinic-scoped requests as well as global requests.
-- Keeps existing platform/clinic PSE behavior unchanged.

drop policy if exists "opinion_requests_select_staff" on public.opinion_requests;
create policy "opinion_requests_select_staff"
  on public.opinion_requests
  for select
  to authenticated
  using (
    public.is_administrator()
    or (
      public.is_platform_patient_service_executive()
      and clinic_id is null
      and assigned_to = public.current_staff_id()
    )
    or (
      public.is_clinic_patient_service_executive()
      and clinic_id = public.current_clinic_id()
      and (
        assigned_to = public.current_staff_id()
        or assigned_to is null
      )
    )
  );

-- Ensure admins can still read files attached to clinic requests.
drop policy if exists "uploaded_files_select_platform_staff" on public.uploaded_files;
create policy "uploaded_files_select_platform_staff"
  on public.uploaded_files
  for select
  to authenticated
  using (
    public.is_administrator()
    or (
      public.is_platform_patient_service_executive()
      and not exists (
        select 1
        from public.opinion_request_records orr
        join public.opinion_requests oreq on oreq.id = orr.request_id
        where orr.record_id = uploaded_files.id
          and oreq.clinic_id is not null
      )
    )
  );
