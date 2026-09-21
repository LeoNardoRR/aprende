-- Impede que um titular atribua sua solicitação à rede de outro tenant.
create function private.phase8_guard_privacy_request_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.requester_id is distinct from (select auth.uid()) then
    raise exception 'Requester must be the authenticated user';
  end if;
  if new.network_id is not null and not (
    exists (
      select 1 from public.institutional_memberships m
      where m.user_id = new.requester_id and m.network_id = new.network_id and m.status = 'active'
    ) or exists (
      select 1 from public.student_enrollments e
      where e.student_id = new.requester_id and e.network_id = new.network_id
    ) or exists (
      select 1 from public.classrooms c
      where c.owner_id = new.requester_id and c.network_id = new.network_id
    )
  ) then
    raise exception 'Privacy request network is outside requester scope';
  end if;
  return new;
end $$;

create trigger privacy_request_insert_guard
before insert on public.privacy_requests
for each row execute function private.phase8_guard_privacy_request_insert();

revoke execute on function private.phase8_guard_privacy_request_insert() from public, anon, authenticated;
