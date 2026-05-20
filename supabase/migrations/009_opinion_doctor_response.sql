-- Doctor written response visible to patient

alter table public.opinion_requests
  add column if not exists doctor_response text,
  add column if not exists responded_at timestamptz;

comment on column public.opinion_requests.doctor_response is 'Second opinion text from the assigned doctor';
comment on column public.opinion_requests.responded_at is 'When the doctor submitted their response';

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.doctors d
      where d.id = opinion_requests.doctor_id
        and d.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors d
      where d.id = opinion_requests.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );
