-- Ensure opinion_requests.doctor_id always references public.doctors(id)

-- If doctor_id was stored as auth.users id by mistake, map to doctors.id
update public.opinion_requests o
set
  doctor_id = d.id,
  doctor_name = coalesce(o.doctor_name, d.full_name)
from public.doctors d
where d.auth_user_id = o.doctor_id
  and o.doctor_id <> d.id;

-- Backfill doctor_name from doctors when missing
update public.opinion_requests o
set doctor_name = d.full_name
from public.doctors d
where d.id = o.doctor_id
  and (o.doctor_name is null or o.doctor_name = '');

-- Remove requests that still do not reference a valid doctor (should not exist with FK)
delete from public.opinion_requests o
where not exists (select 1 from public.doctors d where d.id = o.doctor_id);

-- Enforce FK (idempotent if already present)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opinion_requests_doctor_id_fkey'
      and conrelid = 'public.opinion_requests'::regclass
  ) then
    alter table public.opinion_requests
      add constraint opinion_requests_doctor_id_fkey
      foreign key (doctor_id) references public.doctors (id) on delete cascade;
  end if;
end $$;

comment on column public.opinion_requests.doctor_id is 'FK to public.doctors.id (not auth.users id)';
