-- Aprendê - conclusão operacional da Fase 1.
--
-- Mantém as tabelas já criadas e adiciona consistência entre escopos e RPCs
-- transacionais. E-mails de auth.users só são expostos a gestores autorizados.

create unique index if not exists school_years_id_school_ux
  on public.school_years (id, school_id);

alter table public.classrooms
  add constraint classrooms_complete_institutional_scope_check
  check (
    (network_id is null and school_id is null and academic_year_id is null and school_year_id is null)
    or
    (network_id is not null and school_id is not null and academic_year_id is not null and school_year_id is not null)
  ),
  add constraint classrooms_school_network_fkey
  foreign key (school_id, network_id)
  references public.schools (id, network_id),
  add constraint classrooms_year_network_fkey
  foreign key (academic_year_id, network_id)
  references public.academic_years (id, network_id),
  add constraint classrooms_school_year_school_fkey
  foreign key (school_year_id, school_id)
  references public.school_years (id, school_id);

alter table public.student_movements
  drop constraint if exists student_movements_movement_type_check;
alter table public.student_movements
  add constraint student_movements_movement_type_check
  check (movement_type in ('promotion', 'transfer', 'suspension', 'removal', 'reactivation', 'completion'));

create or replace function private.can_assign_institutional_role(
  target_network uuid,
  target_school uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_role not in ('network_admin', 'manager', 'reviewer', 'approver', 'teacher', 'student') then false
    when exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'network_admin'
    ) then true
    when target_role in ('network_admin', 'manager') then false
    when target_school is null then false
    else private.has_permission('enrollment.manage', target_network, target_school)
  end;
$$;

create or replace function private.refresh_institutional_profile_role(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_role public.app_role;
  current_role public.app_role;
begin
  select role into current_role from public.profiles where id = target_user;
  select membership.role::public.app_role
    into next_role
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

  update public.profiles
  set role = coalesce(
    next_role,
    case when current_role in ('teacher', 'student') then current_role else 'student'::public.app_role end
  )
  where id = target_user;
end;
$$;

create or replace function public.find_profile_for_institution(
  target_email text,
  target_network uuid,
  target_school uuid default null
)
returns table (user_id uuid, email text, display_name text, profile_role public.app_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('enrollment.manage', target_network, target_school) then
    raise exception 'Not authorized';
  end if;
  return query
  select profile.id, account.email::text, profile.display_name, profile.role
  from auth.users account
  join public.profiles profile on profile.id = account.id
  where lower(account.email) = lower(trim(target_email))
  limit 1;
end;
$$;

create or replace function public.list_institutional_users(
  target_network uuid,
  search_query text default '',
  page_size integer default 25,
  page_offset integer default 0
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  profile_role public.app_role,
  membership_role text,
  network_id uuid,
  network_name text,
  school_id uuid,
  school_name text,
  membership_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('enrollment.read', target_network) then
    raise exception 'Not authorized';
  end if;
  return query
  select membership.id, profile.id, account.email::text, profile.display_name,
    profile.role, membership.role, membership.network_id, network.name,
    membership.school_id, school.name, membership.status, membership.created_at
  from public.institutional_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  join auth.users account on account.id = membership.user_id
  join public.networks network on network.id = membership.network_id
  left join public.schools school on school.id = membership.school_id
  where membership.network_id = target_network
    and private.can_view_institutional_scope(membership.network_id, membership.school_id)
    and (
      coalesce(trim(search_query), '') = ''
      or profile.display_name ilike '%' || trim(search_query) || '%'
      or account.email ilike '%' || trim(search_query) || '%'
    )
  order by profile.display_name, membership.created_at desc
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

create or replace function public.set_institutional_membership(
  target_email text,
  target_network uuid,
  target_school uuid,
  target_role text,
  target_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  existing_membership uuid;
begin
  if target_status not in ('active', 'inactive') then raise exception 'Invalid status'; end if;
  if not private.can_assign_institutional_role(target_network, target_school, target_role) then
    raise exception 'Not authorized to assign this role';
  end if;
  if target_school is not null and not exists (
    select 1 from public.schools where id = target_school and network_id = target_network
  ) then raise exception 'School does not belong to network'; end if;
  if target_role in ('teacher', 'student') and target_school is null then
    raise exception 'School is required for teacher and student roles';
  end if;

  select account.id into target_user
  from auth.users account
  where lower(account.email) = lower(trim(target_email));
  if target_user is null then raise exception 'User not found'; end if;

  -- A pessoa possui um papel efetivo por escopo. O vínculo anterior permanece
  -- no histórico como inativo quando o papel é alterado.
  update public.institutional_memberships
  set status = 'inactive', updated_at = now()
  where user_id = target_user
    and network_id = target_network
    and school_id is not distinct from target_school
    and role <> target_role
    and status = 'active';

  select id into existing_membership
  from public.institutional_memberships
  where user_id = target_user
    and network_id = target_network
    and school_id is not distinct from target_school
    and role = target_role
  limit 1;

  if existing_membership is null then
    insert into public.institutional_memberships
      (user_id, network_id, school_id, role, status, created_by)
    values
      (target_user, target_network, target_school, target_role, target_status, auth.uid())
    returning id into existing_membership;
  else
    update public.institutional_memberships
    set status = target_status, updated_at = now(), created_by = auth.uid()
    where id = existing_membership;
  end if;

  perform private.refresh_institutional_profile_role(target_user);
  return existing_membership;
end;
$$;

create or replace function public.list_legacy_classrooms(
  target_network uuid,
  search_query text default '',
  page_size integer default 25
)
returns table (
  classroom_id uuid,
  classroom_name text,
  subject text,
  owner_id uuid,
  owner_name text,
  owner_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('network.manage', target_network) then
    raise exception 'Not authorized';
  end if;
  return query
  select classroom.id, classroom.name, classroom.subject, profile.id,
    profile.display_name, account.email::text
  from public.classrooms classroom
  join public.profiles profile on profile.id = classroom.owner_id
  join auth.users account on account.id = classroom.owner_id
  where classroom.network_id is null
    and (
      coalesce(trim(search_query), '') = ''
      or classroom.name ilike '%' || trim(search_query) || '%'
      or profile.display_name ilike '%' || trim(search_query) || '%'
    )
  order by classroom.created_at desc
  limit least(greatest(page_size, 1), 100);
end;
$$;

create or replace function public.list_student_enrollments(
  target_network uuid,
  search_query text default '',
  status_filter text default '',
  page_size integer default 25,
  page_offset integer default 0
)
returns table (
  enrollment_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  network_id uuid,
  school_id uuid,
  school_name text,
  academic_year_id uuid,
  academic_year_label text,
  classroom_id uuid,
  classroom_name text,
  enrollment_status text,
  starts_on date,
  ends_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('enrollment.read', target_network) then
    raise exception 'Not authorized';
  end if;
  return query
  select enrollment.id, profile.id, profile.display_name, account.email::text,
    enrollment.network_id, enrollment.school_id, school.name,
    enrollment.academic_year_id, academic_year.label,
    enrollment.classroom_id, classroom.name, enrollment.status,
    enrollment.starts_on, enrollment.ends_on
  from public.student_enrollments enrollment
  join public.profiles profile on profile.id = enrollment.student_id
  join auth.users account on account.id = enrollment.student_id
  join public.schools school on school.id = enrollment.school_id
  join public.academic_years academic_year on academic_year.id = enrollment.academic_year_id
  left join public.classrooms classroom on classroom.id = enrollment.classroom_id
  where enrollment.network_id = target_network
    and private.has_permission('enrollment.read', enrollment.network_id, enrollment.school_id)
    and (coalesce(trim(status_filter), '') = '' or enrollment.status = status_filter)
    and (
      coalesce(trim(search_query), '') = ''
      or profile.display_name ilike '%' || trim(search_query) || '%'
      or account.email ilike '%' || trim(search_query) || '%'
    )
  order by profile.display_name, enrollment.created_at desc
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

create or replace function public.set_institutional_membership_status(
  target_membership uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.institutional_memberships%rowtype;
begin
  if target_status not in ('active', 'inactive') then raise exception 'Invalid status'; end if;
  select * into membership from public.institutional_memberships where id = target_membership;
  if membership.id is null then raise exception 'Membership not found'; end if;
  if not private.can_assign_institutional_role(membership.network_id, membership.school_id, membership.role) then
    raise exception 'Not authorized to change this membership';
  end if;
  if target_status = 'active' then
    update public.institutional_memberships
    set status = 'inactive', updated_at = now()
    where user_id = membership.user_id
      and network_id = membership.network_id
      and school_id is not distinct from membership.school_id
      and id <> membership.id
      and status = 'active';
  end if;
  update public.institutional_memberships
  set status = target_status, updated_at = now()
  where id = target_membership;
  perform private.refresh_institutional_profile_role(membership.user_id);
end;
$$;

create or replace function public.link_classroom_to_institution(
  target_classroom uuid,
  target_network uuid,
  target_school uuid,
  target_academic_year uuid,
  target_school_year uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('classroom.manage', target_network, target_school) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.schools where id = target_school and network_id = target_network)
    or not exists (select 1 from public.academic_years where id = target_academic_year and network_id = target_network)
    or not exists (select 1 from public.school_years where id = target_school_year and school_id = target_school)
  then raise exception 'Institutional scope is inconsistent'; end if;
  if not exists (
    select 1
    from public.classrooms classroom
    join public.institutional_memberships membership
      on membership.user_id = classroom.owner_id
      and membership.network_id = target_network
      and membership.school_id = target_school
      and membership.role = 'teacher'
      and membership.status = 'active'
    where classroom.id = target_classroom
  ) then raise exception 'Responsible teacher must be linked to school'; end if;
  update public.classrooms
  set network_id = target_network, school_id = target_school,
    academic_year_id = target_academic_year, school_year_id = target_school_year
  where id = target_classroom;
  if not found then raise exception 'Classroom not found'; end if;
end;
$$;

create or replace function public.set_institutional_classroom_status(
  target_classroom uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  classroom public.classrooms%rowtype;
begin
  if target_status not in ('active', 'archived') then raise exception 'Invalid status'; end if;
  select * into classroom from public.classrooms where id = target_classroom;
  if classroom.id is null or classroom.network_id is null
    or not private.has_permission('classroom.manage', classroom.network_id, classroom.school_id)
  then raise exception 'Not authorized'; end if;
  update public.classrooms set classroom_status = target_status where id = target_classroom;
end;
$$;

create or replace function public.create_student_enrollment(
  target_email text,
  target_network uuid,
  target_school uuid,
  target_academic_year uuid,
  target_classroom uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_student uuid;
  enrollment_id uuid;
begin
  if not private.has_permission('enrollment.manage', target_network, target_school) then
    raise exception 'Not authorized';
  end if;
  select account.id into target_student
  from auth.users account join public.profiles profile on profile.id = account.id
  where lower(account.email) = lower(trim(target_email)) and profile.role = 'student';
  if target_student is null then raise exception 'Student not found'; end if;
  if not exists (
    select 1 from public.classrooms
    where id = target_classroom and network_id = target_network and school_id = target_school
      and academic_year_id = target_academic_year and classroom_status = 'active'
  ) then raise exception 'Classroom scope is inconsistent'; end if;
  insert into public.student_enrollments
    (student_id, network_id, school_id, academic_year_id, classroom_id, source, created_by)
  values
    (target_student, target_network, target_school, target_academic_year, target_classroom, 'manual', auth.uid())
  returning id into enrollment_id;
  return enrollment_id;
end;
$$;

create or replace function public.transition_student_enrollment(
  target_enrollment uuid,
  target_action text,
  target_classroom uuid default null,
  action_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.student_enrollments%rowtype;
  old_classroom uuid;
  next_status text;
  movement text;
begin
  select * into enrollment from public.student_enrollments where id = target_enrollment for update;
  if enrollment.id is null or not private.has_permission('enrollment.manage', enrollment.network_id, enrollment.school_id) then
    raise exception 'Not authorized';
  end if;
  old_classroom := enrollment.classroom_id;
  if target_action = 'transfer' then
    if enrollment.status <> 'enrolled' then raise exception 'Only active enrollment can be transferred'; end if;
    if target_classroom is null or not exists (
      select 1 from public.classrooms
      where id = target_classroom and network_id = enrollment.network_id
        and school_id = enrollment.school_id and academic_year_id = enrollment.academic_year_id
        and classroom_status = 'active'
    ) then raise exception 'Target classroom scope is inconsistent'; end if;
    next_status := 'enrolled'; movement := 'transfer';
  elsif target_action = 'suspend' then
    if enrollment.status <> 'enrolled' then raise exception 'Only active enrollment can be suspended'; end if;
    next_status := 'suspended'; movement := 'suspension'; target_classroom := old_classroom;
  elsif target_action = 'reactivate' then
    if enrollment.status <> 'suspended' then raise exception 'Only suspended enrollment can be reactivated'; end if;
    next_status := 'enrolled'; movement := 'reactivation'; target_classroom := coalesce(target_classroom, old_classroom);
    if target_classroom is null or not exists (
      select 1 from public.classrooms
      where id = target_classroom and network_id = enrollment.network_id
        and school_id = enrollment.school_id and academic_year_id = enrollment.academic_year_id
        and classroom_status = 'active'
    ) then raise exception 'Classroom scope is inconsistent for reactivation'; end if;
  elsif target_action = 'remove' then
    if enrollment.status not in ('enrolled', 'suspended') then raise exception 'Enrollment cannot be removed from current status'; end if;
    next_status := 'removed'; movement := 'removal'; target_classroom := old_classroom;
  elsif target_action = 'complete' then
    if enrollment.status <> 'enrolled' then raise exception 'Only active enrollment can be completed'; end if;
    next_status := 'completed'; movement := 'completion'; target_classroom := old_classroom;
  else raise exception 'Invalid enrollment action';
  end if;

  update public.student_enrollments
  set status = next_status,
    classroom_id = target_classroom,
    ends_on = case when next_status in ('removed', 'completed') then current_date else null end,
    updated_at = now()
  where id = target_enrollment;

  insert into public.student_movements
    (enrollment_id, student_id, from_classroom_id, to_classroom_id, movement_type, reason, created_by)
  values
    (enrollment.id, enrollment.student_id, old_classroom, target_classroom, movement, nullif(trim(action_reason), ''), auth.uid());
end;
$$;

drop policy if exists classrooms_create on public.classrooms;
create policy classrooms_create on public.classrooms
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'teacher')
  and (
    network_id is null
    or private.has_permission('classroom.manage', network_id, school_id)
    or exists (
      select 1 from public.institutional_memberships membership
      where membership.user_id = (select auth.uid()) and membership.network_id = classrooms.network_id
        and membership.school_id = classrooms.school_id and membership.role = 'teacher'
        and membership.status = 'active'
    )
  )
);

drop policy if exists profiles_read_institutional on public.profiles;
create policy profiles_read_institutional on public.profiles
for select to authenticated
using (exists (
  select 1 from public.institutional_memberships membership
  where membership.user_id = profiles.id
    and private.can_view_institutional_scope(membership.network_id, membership.school_id)
));

drop policy if exists institutional_memberships_manage on public.institutional_memberships;

revoke insert, update, delete on public.institutional_memberships from authenticated;
revoke insert, update, delete on public.student_enrollments from authenticated;
revoke insert, update, delete on public.student_movements from authenticated;
revoke update on public.classrooms from authenticated;
grant update (name, subject, image_url) on public.classrooms to authenticated;

revoke all on function public.find_profile_for_institution(text, uuid, uuid) from public, anon;
revoke all on function public.list_institutional_users(uuid, text, integer, integer) from public, anon;
revoke all on function public.set_institutional_membership(text, uuid, uuid, text, text) from public, anon;
revoke all on function public.list_legacy_classrooms(uuid, text, integer) from public, anon;
revoke all on function public.list_student_enrollments(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.set_institutional_membership_status(uuid, text) from public, anon;
revoke all on function public.link_classroom_to_institution(uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.set_institutional_classroom_status(uuid, text) from public, anon;
revoke all on function public.create_student_enrollment(text, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.transition_student_enrollment(uuid, text, uuid, text) from public, anon;

grant execute on function public.find_profile_for_institution(text, uuid, uuid) to authenticated;
grant execute on function public.list_institutional_users(uuid, text, integer, integer) to authenticated;
grant execute on function public.set_institutional_membership(text, uuid, uuid, text, text) to authenticated;
grant execute on function public.list_legacy_classrooms(uuid, text, integer) to authenticated;
grant execute on function public.list_student_enrollments(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.set_institutional_membership_status(uuid, text) to authenticated;
grant execute on function public.link_classroom_to_institution(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.set_institutional_classroom_status(uuid, text) to authenticated;
grant execute on function public.create_student_enrollment(text, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.transition_student_enrollment(uuid, text, uuid, text) to authenticated;

revoke all on function private.can_assign_institutional_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.refresh_institutional_profile_role(uuid) from public, anon, authenticated;
grant execute on function private.can_assign_institutional_role(uuid, uuid, text) to authenticated;
