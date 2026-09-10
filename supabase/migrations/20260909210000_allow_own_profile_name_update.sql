drop policy if exists profiles_update_own_name on public.profiles;

create policy profiles_update_own_name
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
