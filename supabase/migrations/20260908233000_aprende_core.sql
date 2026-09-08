create schema if not exists private;

create type public.app_role as enum ('teacher', 'student');
create type public.submission_status as enum ('draft', 'submitted');

create table private.teacher_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into private.teacher_invites (email)
values ('ribeiroleonardoti@gmail.com');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  subject text not null check (char_length(subject) between 2 and 80),
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.memberships (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  subject text not null check (char_length(subject) between 2 and 80),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  due_at timestamptz,
  points integer not null default 10 check (points between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null default '' check (char_length(answer) <= 12000),
  status public.submission_status not null default 'draft',
  score numeric(7,2),
  feedback text check (char_length(feedback) <= 4000),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index memberships_user_id_idx on public.memberships(user_id);
create index assignments_classroom_id_idx on public.assignments(classroom_id);
create index submissions_student_id_idx on public.submissions(student_id);
create index submissions_assignment_id_idx on public.submissions(assignment_id);
create index announcements_classroom_id_created_at_idx on public.announcements(classroom_id, created_at desc);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from private.teacher_invites where email = lower(new.email))
      then 'teacher'::public.app_role else 'student'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

create function private.is_class_teacher(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classrooms
    where id = target_classroom and owner_id = (select auth.uid())
  );
$$;

create function private.is_class_member(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_class_teacher(target_classroom) or exists (
    select 1 from public.memberships
    where classroom_id = target_classroom and user_id = (select auth.uid())
  );
$$;

create function private.can_view_profile(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user = (select auth.uid()) or exists (
    select 1
    from public.classrooms c
    join public.memberships m on m.classroom_id = c.id
    where (c.owner_id = (select auth.uid()) and m.user_id = target_user)
       or (c.owner_id = target_user and m.user_id = (select auth.uid()))
  );
$$;

create function public.join_class_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into target_id from public.classrooms where join_code = upper(trim(code));
  if target_id is null then raise exception 'Invalid class code'; end if;
  insert into public.memberships (classroom_id, user_id)
  values (target_id, auth.uid()) on conflict do nothing;
  return target_id;
end;
$$;

create function public.grade_submission(target_submission uuid, new_score numeric, new_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classrooms c on c.id = a.classroom_id
    where s.id = target_submission and c.owner_id = auth.uid()
  ) then raise exception 'Not authorized'; end if;
  update public.submissions
  set score = new_score, feedback = nullif(trim(new_feedback), ''), updated_at = now()
  where id = target_submission;
end;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_class_teacher(uuid) to authenticated;
grant execute on function private.is_class_member(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
revoke all on function public.join_class_by_code(text) from public, anon;
revoke all on function public.grade_submission(uuid, numeric, text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.announcements enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using ((select private.can_view_profile(id)));

create policy classrooms_read on public.classrooms for select to authenticated
using ((select private.is_class_member(id)));
create policy classrooms_create on public.classrooms for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.profiles where id = (select auth.uid()) and role = 'teacher'
));
create policy classrooms_change on public.classrooms for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy classrooms_remove on public.classrooms for delete to authenticated
using (owner_id = (select auth.uid()));

create policy memberships_read on public.memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_class_teacher(classroom_id)));

create policy assignments_read on public.assignments for select to authenticated
using ((select private.is_class_member(classroom_id)));
create policy assignments_create on public.assignments for insert to authenticated
with check (created_by = (select auth.uid()) and (select private.is_class_teacher(classroom_id)));
create policy assignments_change on public.assignments for update to authenticated
using ((select private.is_class_teacher(classroom_id)))
with check (created_by = (select auth.uid()) and (select private.is_class_teacher(classroom_id)));
create policy assignments_remove on public.assignments for delete to authenticated
using ((select private.is_class_teacher(classroom_id)));

create policy submissions_read on public.submissions for select to authenticated
using (student_id = (select auth.uid()) or exists (
  select 1 from public.assignments a
  where a.id = assignment_id and (select private.is_class_teacher(a.classroom_id))
));
create policy submissions_create on public.submissions for insert to authenticated
with check (student_id = (select auth.uid()) and exists (
  select 1 from public.assignments a
  where a.id = assignment_id and (select private.is_class_member(a.classroom_id))
));
create policy submissions_change on public.submissions for update to authenticated
using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

create policy announcements_read on public.announcements for select to authenticated
using ((select private.is_class_member(classroom_id)));
create policy announcements_create on public.announcements for insert to authenticated
with check (author_id = (select auth.uid()) and (select private.is_class_teacher(classroom_id)));
create policy announcements_remove on public.announcements for delete to authenticated
using (author_id = (select auth.uid()) and (select private.is_class_teacher(classroom_id)));

grant select on public.profiles, public.classrooms, public.memberships, public.assignments, public.submissions, public.announcements to authenticated;
grant insert, update, delete on public.classrooms, public.assignments, public.announcements to authenticated;
grant insert (assignment_id, student_id, answer, status, submitted_at) on public.submissions to authenticated;
grant update (answer, status, submitted_at, updated_at) on public.submissions to authenticated;

