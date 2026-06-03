-- Allow administrators to delete opinion requests (cascades to records, recommendations, summaries).

drop policy if exists "opinion_requests_delete_administrator" on public.opinion_requests;
create policy "opinion_requests_delete_administrator"
  on public.opinion_requests
  for delete
  to authenticated
  using (public.is_administrator());
