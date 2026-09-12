-- Corrige a resolução do papel principal sem misturar enum, text e name.
create or replace function private.refresh_institutional_profile_role(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_role_text text;
  current_role_text text;
  resolved_role_text text;
begin
  select profile.role::text into current_role_text
  from public.profiles profile where profile.id = target_user;

  select membership.role into next_role_text
  from public.institutional_memberships membership
  where membership.user_id = target_user and membership.status = 'active'
  order by case membership.role
    when 'network_admin' then 60
    when 'manager' then 50
    when 'approver' then 40
    when 'reviewer' then 30
    when 'teacher' then 20
    else 10
  end desc
  limit 1;

  resolved_role_text := coalesce(
    next_role_text,
    case when current_role_text in ('teacher', 'student') then current_role_text else 'student' end
  );

  update public.profiles
  set role = resolved_role_text::public.app_role
  where id = target_user;
end;
$$;

revoke all on function private.refresh_institutional_profile_role(uuid)
  from public, anon, authenticated;
