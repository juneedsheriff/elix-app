-- Denormalized names for Table Editor and app display

alter table public.opinion_requests
  add column if not exists patient_name text,
  add column if not exists doctor_name text;

comment on column public.opinion_requests.patient_name is 'Snapshot of patient full name at request time';
comment on column public.opinion_requests.doctor_name is 'Snapshot of doctor full name at request time';

update public.opinion_requests o
set patient_name = p.full_name
from public.patients p
where p.auth_user_id = o.patient_id
  and o.patient_id is not null
  and (o.patient_name is null or o.patient_name = '');

update public.opinion_requests o
set doctor_name = d.full_name
from public.doctors d
where d.id = o.doctor_id
  and (o.doctor_name is null or o.doctor_name = '');
