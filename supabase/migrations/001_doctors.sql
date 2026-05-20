-- Doctors directory for Second Opinion Doctor app
-- Run in Supabase Dashboard → SQL Editor, then: npm run db:seed

create extension if not exists "pgcrypto";

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null,
  years_experience integer not null check (years_experience >= 0),
  hospital text not null,
  rating numeric(3, 2) not null check (rating >= 0 and rating <= 5),
  languages text not null,
  fee_usd integer not null check (fee_usd >= 0),
  image_url text not null,
  country text not null,
  bio text,
  created_at timestamptz not null default now()
);

create index if not exists doctors_specialty_idx on public.doctors (specialty);
create index if not exists doctors_rating_idx on public.doctors (rating desc);

alter table public.doctors enable row level security;

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors
  for select
  to anon, authenticated
  using (true);

-- Optional: allow service role / dashboard to manage rows (seed script uses service role)
