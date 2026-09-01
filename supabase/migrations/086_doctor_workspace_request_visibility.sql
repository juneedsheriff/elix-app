-- Doctors must see assigned cases on /elixhealth/workspace the same way PSE sees them
-- in Request coordination. Legacy policy 058 only allowed doctor_id + stages
-- scheduled/paid/completed (or status in_review/closed), so scheduled-via-selected_doctor_id
-- and payment_pending / schedule_confirmed cases were invisible to the doctor.
--
-- Do not SELECT opinion_request_recommendations from this policy: that table's RLS
-- queries opinion_requests, which Postgres reports as infinite recursion.

create or replace function public.doctor_recommended_on_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opinion_request_recommendations rec
    where rec.request_id = p_request_id
      and rec.doctor_id = public.current_doctor_id()
  );
$$;

comment on function public.doctor_recommended_on_request(uuid) is
  'Whether the signed-in doctor is listed on a request recommendation (bypasses recommendations RLS).';

revoke all on function public.doctor_recommended_on_request(uuid) from public;
grant execute on function public.doctor_recommended_on_request(uuid) to authenticated;

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests
  for select
  to authenticated
  using (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
      or public.doctor_recommended_on_request(opinion_requests.id)
    )
  );

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests
  for update
  to authenticated
  using (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
    )
  )
  with check (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
    )
  );

-- Keep doctor_id in sync so older clients and FK embeds resolve.
update public.opinion_requests
set doctor_id = selected_doctor_id
where doctor_id is null
  and selected_doctor_id is not null;

-- Legacy 058 also required in_review/closed unless stage was scheduled/paid/completed.
update public.opinion_requests
set status = 'in_review'
where status = 'submitted'
  and (doctor_id is not null or selected_doctor_id is not null)
  and consultation_stage in (
    'schedule_confirmed',
    'scheduled',
    'payment_pending',
    'paid'
  );

comment on policy "opinion_requests_select_doctor" on public.opinion_requests is
  'Assigned doctors see their cases at every workflow stage, including selected_doctor_id.';

alter function public.doctor_recommended_on_request(uuid) owner to postgres;
