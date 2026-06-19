-- Enable Supabase Realtime for clinic PSE / admin doctors workspace (grant add/remove)

alter table public.clinic_doctor_grants replica identity full;
alter table public.doctors replica identity full;

alter publication supabase_realtime add table public.clinic_doctor_grants;
alter publication supabase_realtime add table public.doctors;
