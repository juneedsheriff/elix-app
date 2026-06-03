-- Enable Supabase Realtime for patient request workflow (replaces frontend polling)

alter table public.opinion_requests replica identity full;
alter table public.consultation_summaries replica identity full;
alter table public.opinion_request_recommendations replica identity full;

alter publication supabase_realtime add table public.opinion_requests;
alter publication supabase_realtime add table public.opinion_request_recommendations;
alter publication supabase_realtime add table public.consultation_summaries;
