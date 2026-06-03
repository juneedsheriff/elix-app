-- Ensure opinion_request_records links to uploaded_files and staff/patients can read linked files

do $$
begin
  alter table public.opinion_request_records
    drop constraint if exists opinion_request_records_record_id_fkey;

  alter table public.opinion_request_records
    add constraint opinion_request_records_record_id_fkey
    foreign key (record_id) references public.uploaded_files (id) on delete cascade;
exception
  when others then
    raise notice 'opinion_request_records FK to uploaded_files: %', sqlerrm;
end $$;

-- Patients: read files attached to their own opinion requests
drop policy if exists "uploaded_files_select_patient_request" on public.uploaded_files;
create policy "uploaded_files_select_patient_request"
  on public.uploaded_files for select to authenticated
  using (
    exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.patient_id = auth.uid()
    )
  );

-- Staff: administrators see files on any request; PSE sees files on assigned requests
drop policy if exists "uploaded_files_select_staff_request" on public.uploaded_files;
create policy "uploaded_files_select_staff_request"
  on public.uploaded_files for select to authenticated
  using (
    public.is_staff()
    and exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and (
          public.is_administrator()
          or (
            public.is_patient_service_executive()
            and oreq.assigned_to = public.current_staff_id()
          )
        )
    )
  );

-- Doctors: read files on requests they can access (in_review / closed / consultation workflow)
drop policy if exists "uploaded_files_select_doctor_request" on public.uploaded_files;
create policy "uploaded_files_select_doctor_request"
  on public.uploaded_files for select to authenticated
  using (
    exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where orr.record_id = uploaded_files.id
        and d.auth_user_id = auth.uid()
        and (
          oreq.status in ('in_review', 'closed')
          or oreq.consultation_stage in ('scheduled', 'paid', 'completed')
        )
    )
  );
