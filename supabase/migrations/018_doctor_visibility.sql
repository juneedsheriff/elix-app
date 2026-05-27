-- Doctor visibility controls for patient search and admin management

alter table public.doctors
  add column if not exists is_visible boolean not null default true,
  add column if not exists deleted_at timestamptz;

create index if not exists doctors_visible_search_idx
  on public.doctors (is_visible, deleted_at, rating desc);

comment on column public.doctors.is_visible is 'Controls whether a doctor appears in patient-facing search';
comment on column public.doctors.deleted_at is 'Soft delete marker; deleted doctors are hidden from active lists';
