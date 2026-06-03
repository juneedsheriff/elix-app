-- Run in Supabase SQL Editor to enable Realtime for patient request updates
-- (replaces frontend polling on /app/my-requests)

alter table public.opinion_requests replica identity full;
alter table public.consultation_summaries replica identity full;
alter table public.opinion_request_recommendations replica identity full;

alter publication supabase_realtime add table public.opinion_requests;
alter publication supabase_realtime add table public.opinion_request_recommendations;
alter publication supabase_realtime add table public.consultation_summaries;
