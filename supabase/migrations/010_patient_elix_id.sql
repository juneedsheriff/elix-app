-- Human-readable patient ID: elix-aa0000 (2 letters + 4 digits, sequential)

create sequence if not exists public.patient_elix_id_seq;

create or replace function public.generate_patient_elix_id()
returns text
language plpgsql
as $$
declare
  n bigint;
  pair_index bigint;
  num_part int;
  first_letter text;
  second_letter text;
begin
  n := nextval('public.patient_elix_id_seq') - 1;
  if n >= 6760000 then
    raise exception 'patient elix_id sequence exhausted (max 6,760,000 IDs)';
  end if;
  pair_index := n / 10000;
  num_part := (n % 10000)::int;
  first_letter := chr(97 + ((pair_index / 26) % 26)::int);
  second_letter := chr(97 + (pair_index % 26)::int);
  return 'elix-' || first_letter || second_letter || lpad(num_part::text, 4, '0');
end;
$$;

alter table public.patients
  add column if not exists elix_id text;

comment on column public.patients.elix_id is 'Public patient number, format elix-aa0000 (unique, auto-generated)';

do $$
declare
  r record;
begin
  for r in
    select id from public.patients
    where elix_id is null
    order by created_at asc, id asc
  loop
    update public.patients
    set elix_id = public.generate_patient_elix_id()
    where id = r.id;
  end loop;
end;
$$;

select setval(
  'public.patient_elix_id_seq',
  greatest(1, coalesce((select count(*) from public.patients), 0)),
  true
);

alter table public.patients
  alter column elix_id set not null;

alter table public.patients
  drop constraint if exists patients_elix_id_format_chk;

alter table public.patients
  add constraint patients_elix_id_format_chk
  check (elix_id ~ '^elix-[a-z]{2}[0-9]{4}$');

create unique index if not exists patients_elix_id_idx on public.patients (elix_id);

create or replace function public.set_patient_elix_id()
returns trigger
language plpgsql
as $$
begin
  if new.elix_id is null or btrim(new.elix_id) = '' then
    new.elix_id := public.generate_patient_elix_id();
  end if;
  return new;
end;
$$;

drop trigger if exists patients_set_elix_id on public.patients;

create trigger patients_set_elix_id
  before insert on public.patients
  for each row
  execute function public.set_patient_elix_id();
