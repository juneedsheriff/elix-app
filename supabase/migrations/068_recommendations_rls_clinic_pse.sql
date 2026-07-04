-- Fix opinion_request_recommendations RLS for clinic PSE and administrators.
-- Migration 019 only allowed platform PSE on strictly assigned requests.

drop policy if exists "recommendations_write_pse" on public.opinion_request_recommendations;

drop policy if exists "recommendations_write_administrator" on public.opinion_request_recommendations;
create policy "recommendations_write_administrator"
  on public.opinion_request_recommendations for all to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());

drop policy if exists "recommendations_write_platform_pse" on public.opinion_request_recommendations;
create policy "recommendations_write_platform_pse"
  on public.opinion_request_recommendations for all to authenticated
  using (
    public.is_platform_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = opinion_request_recommendations.request_id
        and r.clinic_id is null
        and r.assigned_to = public.current_staff_id()
    )
  )
  with check (
    public.is_platform_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = request_id
        and r.clinic_id is null
        and r.assigned_to = public.current_staff_id()
    )
  );

drop policy if exists "recommendations_write_clinic_pse" on public.opinion_request_recommendations;
create policy "recommendations_write_clinic_pse"
  on public.opinion_request_recommendations for all to authenticated
  using (
    public.is_clinic_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = opinion_request_recommendations.request_id
        and r.clinic_id = public.current_clinic_id()
        and (
          r.assigned_to = public.current_staff_id()
          or r.assigned_to is null
        )
    )
  )
  with check (
    public.is_clinic_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = request_id
        and r.clinic_id = public.current_clinic_id()
        and r.assigned_to = public.current_staff_id()
    )
  );

-- Staff read access scoped to requests they can coordinate (mirrors opinion_requests_select_staff).
drop policy if exists "recommendations_select_staff" on public.opinion_request_recommendations;
create policy "recommendations_select_staff"
  on public.opinion_request_recommendations for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_platform_patient_service_executive()
      and exists (
        select 1
        from public.opinion_requests r
        where r.id = opinion_request_recommendations.request_id
          and r.clinic_id is null
          and r.assigned_to = public.current_staff_id()
      )
    )
    or (
      public.is_clinic_patient_service_executive()
      and exists (
        select 1
        from public.opinion_requests r
        where r.id = opinion_request_recommendations.request_id
          and r.clinic_id = public.current_clinic_id()
          and (
            r.assigned_to = public.current_staff_id()
            or r.assigned_to is null
          )
      )
    )
  );
