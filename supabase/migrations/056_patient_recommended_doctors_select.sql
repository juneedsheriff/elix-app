-- Patients must read doctors recommended or assigned on their own opinion requests.
-- Without this, resolveDoctorRecord / nested recommendation joins fail for clinic or
-- non-visible doctors that PSE shared with the patient.

drop policy if exists "doctors_select_patient_request" on public.doctors;
create policy "doctors_select_patient_request"
  on public.doctors for select to authenticated
  using (
    deleted_at is null
    and (
      exists (
        select 1
        from public.opinion_request_recommendations rec
        inner join public.opinion_requests r on r.id = rec.request_id
        where rec.doctor_id = doctors.id
          and r.patient_id = auth.uid()
      )
      or exists (
        select 1
        from public.opinion_requests r
        where r.patient_id = auth.uid()
          and (r.doctor_id = doctors.id or r.selected_doctor_id = doctors.id)
      )
    )
  );
