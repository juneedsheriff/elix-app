-- Admins can list all staff (admin) accounts

drop policy if exists "admins_select_all_admins" on public.admins;
create policy "admins_select_all_admins"
  on public.admins
  for select
  to authenticated
  using (public.is_admin());
