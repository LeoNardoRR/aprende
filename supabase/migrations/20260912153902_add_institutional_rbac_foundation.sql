-- Aprendê - Fase 1: hierarquia institucional, matrículas e RBAC escopado.
--
-- Esta migration é aditiva. As turmas legadas continuam válidas com os
-- campos institucionais nulos até que a rede faça a vinculação assistida.

alter type public.app_role add value if not exists 'network_admin';
alter type public.app_role add value if not exists 'manager';
alter type public.app_role add value if not exists 'reviewer';
alter type public.app_role add value if not exists 'approver';

create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  municipality text check (municipality is null or char_length(municipality) between 2 and 120),
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  code text not null check (char_length(code) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, code)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  label text not null check (char_length(label) between 4 and 30),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned', 'open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (network_id, label)
);

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  code text not null check (char_length(code) between 1 and 40),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

alter table public.classrooms
  add column if not exists network_id uuid references public.networks(id) on delete restrict,
  add column if not exists school_id uuid references public.schools(id) on delete restrict,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict,
  add column if not exists school_year_id uuid references public.school_years(id) on delete restrict,
  add column if not exists classroom_status text not null default 'active'
    check (classroom_status in ('active', 'archived'));

create index if not exists schools_network_id_idx on public.schools(network_id);
create index if not exists academic_years_network_id_idx on public.academic_years(network_id);
create index if not exists school_years_school_id_idx on public.school_years(school_id);
create index if not exists classrooms_network_id_idx on public.classrooms(network_id);
create index if not exists classrooms_school_id_idx on public.classrooms(school_id);
create index if not exists classrooms_academic_year_id_idx on public.classrooms(academic_year_id);
create index if not exists classrooms_school_year_id_idx on public.classrooms(school_year_id);
create unique index if not exists classrooms_school_year_name_ux
  on public.classrooms (school_id, academic_year_id, name)
  where school_id is not null and academic_year_id is not null;
create unique index if not exists classrooms_scope_ux
  on public.classrooms (id, network_id, school_id, academic_year_id);

create table if not exists public.institutional_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role text not null check (role in ('network_admin', 'manager', 'reviewer', 'approver', 'teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, network_id, school_id, role)
);

create unique index if not exists schools_id_network_ux
  on public.schools (id, network_id);
create unique index if not exists academic_years_id_network_ux
  on public.academic_years (id, network_id);

alter table public.institutional_memberships
  add constraint institutional_memberships_school_network_fkey
  foreign key (school_id, network_id)
  references public.schools (id, network_id);

create index if not exists institutional_memberships_network_idx
  on public.institutional_memberships(network_id, school_id, role)
  where status = 'active';
create index if not exists institutional_memberships_user_idx
  on public.institutional_memberships(user_id, status);
create unique index if not exists institutional_memberships_network_role_ux
  on public.institutional_memberships(user_id, network_id, role)
  where school_id is null;

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  classroom_id uuid references public.classrooms(id) on delete set null,
  status text not null default 'enrolled'
    check (status in ('enrolled', 'transferred', 'suspended', 'removed', 'completed')),
  starts_on date not null default current_date,
  ends_on date,
  source text not null default 'manual' check (source in ('manual', 'csv', 'promotion', 'transfer', 'sync')),
  external_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

alter table public.student_enrollments
  add constraint student_enrollments_school_network_fkey
  foreign key (school_id, network_id)
  references public.schools (id, network_id),
  add constraint student_enrollments_year_network_fkey
  foreign key (academic_year_id, network_id)
  references public.academic_years (id, network_id),
  add constraint student_enrollments_classroom_scope_fkey
  foreign key (classroom_id, network_id, school_id, academic_year_id)
  references public.classrooms (id, network_id, school_id, academic_year_id);

create unique index if not exists student_enrollments_active_ux
  on public.student_enrollments(student_id, academic_year_id)
  where status = 'enrolled';
create index if not exists student_enrollments_scope_idx
  on public.student_enrollments(network_id, school_id, academic_year_id, status);
create index if not exists student_enrollments_classroom_idx
  on public.student_enrollments(classroom_id, status);

create table if not exists public.student_movements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  from_classroom_id uuid references public.classrooms(id) on delete set null,
  to_classroom_id uuid references public.classrooms(id) on delete set null,
  movement_type text not null check (movement_type in ('promotion', 'transfer', 'suspension', 'removal', 'reactivation')),
  reason text check (reason is null or char_length(reason) <= 1000),
  effective_on date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_movements_student_idx
  on public.student_movements(student_id, effective_on desc);
create index if not exists student_movements_enrollment_idx
  on public.student_movements(enrollment_id, effective_on desc);

create table if not exists private.permissions (
  key text primary key,
  description text not null
);

create table if not exists private.role_permissions (
  role text not null check (role in ('network_admin', 'manager', 'reviewer', 'approver', 'teacher', 'student')),
  permission_key text not null references private.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

insert into private.permissions (key, description)
values
  ('network.read', 'Visualizar a rede de ensino'),
  ('network.manage', 'Administrar a rede de ensino'),
  ('school.read', 'Visualizar escolas'),
  ('school.manage', 'Administrar escolas'),
  ('classroom.read', 'Visualizar turmas institucionais'),
  ('classroom.manage', 'Administrar turmas institucionais'),
  ('enrollment.read', 'Visualizar matrículas'),
  ('enrollment.manage', 'Administrar matrículas e movimentações'),
  ('curriculum.manage', 'Administrar estrutura curricular'),
  ('item.create', 'Criar itens avaliativos'),
  ('item.read', 'Visualizar itens avaliativos'),
  ('item.review', 'Revisar itens avaliativos'),
  ('item.approve', 'Aprovar itens avaliativos'),
  ('assessment.create', 'Criar avaliações'),
  ('assessment.apply', 'Programar e aplicar avaliações'),
  ('report.read', 'Consultar relatórios e painéis'),
  ('support.manage', 'Administrar chamados de suporte')
on conflict (key) do nothing;

insert into private.role_permissions (role, permission_key)
select roles.role, permissions.key
from (values
  ('network_admin'),
  ('manager')
) as roles(role)
cross join private.permissions
where roles.role = 'network_admin'
   or permissions.key in (
     'network.read', 'school.read', 'school.manage', 'classroom.read',
     'classroom.manage', 'enrollment.read', 'enrollment.manage',
     'curriculum.manage', 'assessment.create', 'assessment.apply',
     'report.read', 'support.manage'
   )
on conflict do nothing;

insert into private.role_permissions (role, permission_key)
values
  ('reviewer', 'item.create'),
  ('reviewer', 'item.review'),
  ('approver', 'item.read'),
  ('approver', 'item.review'),
  ('approver', 'item.approve'),
  ('teacher', 'classroom.read'),
  ('teacher', 'assessment.create'),
  ('teacher', 'assessment.apply'),
  ('teacher', 'report.read'),
  ('student', 'classroom.read')
on conflict do nothing;

create or replace function private.has_permission(
  target_permission text,
  target_network uuid default null,
  target_school uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join private.role_permissions role_permission
      on role_permission.role = profile.role::text
    where profile.id = (select auth.uid())
      and profile.role::text = 'network_admin'
      and role_permission.permission_key = target_permission
  )
  or exists (
    select 1
    from public.institutional_memberships membership
    join private.role_permissions role_permission
      on role_permission.role = membership.role
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and role_permission.permission_key = target_permission
      and (target_network is null or membership.network_id = target_network)
      and (target_school is null or membership.school_id is null or membership.school_id = target_school)
  );
$$;

create or replace function private.can_manage_classroom(target_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classrooms classroom
    where classroom.id = target_classroom
      and classroom.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.classrooms classroom
    where classroom.id = target_classroom
      and private.has_permission('classroom.manage', classroom.network_id, classroom.school_id)
  );
$$;

create or replace function private.can_view_institutional_scope(target_network uuid, target_school uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('network.read', target_network, target_school)
      or private.has_permission('school.read', target_network, target_school)
      or private.has_permission('classroom.read', target_network, target_school);
$$;

revoke all on schema private from public;
revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.has_permission(text, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_classroom(uuid) from public, anon, authenticated;
revoke all on function private.can_view_institutional_scope(uuid, uuid) from public, anon, authenticated;
grant execute on function private.has_permission(text, uuid, uuid) to authenticated;
grant execute on function private.can_manage_classroom(uuid) to authenticated;
grant execute on function private.can_view_institutional_scope(uuid, uuid) to authenticated;

alter table public.networks enable row level security;
alter table public.schools enable row level security;
alter table public.academic_years enable row level security;
alter table public.school_years enable row level security;
alter table public.institutional_memberships enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.student_movements enable row level security;

drop policy if exists networks_read_institutional on public.networks;
create policy networks_read_institutional on public.networks
for select to authenticated
using (created_by = (select auth.uid()) or private.can_view_institutional_scope(id));

drop policy if exists networks_create_institutional on public.networks;
create policy networks_create_institutional on public.networks
for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_permission('network.manage', id));

drop policy if exists networks_change_institutional on public.networks;
create policy networks_change_institutional on public.networks
for update to authenticated
using (private.has_permission('network.manage', id))
with check (private.has_permission('network.manage', id));

drop policy if exists networks_remove_institutional on public.networks;
create policy networks_remove_institutional on public.networks
for delete to authenticated
using (private.has_permission('network.manage', id));

drop policy if exists schools_read_institutional on public.schools;
create policy schools_read_institutional on public.schools
for select to authenticated
using (private.can_view_institutional_scope(network_id, id));

drop policy if exists schools_create_institutional on public.schools;
create policy schools_create_institutional on public.schools
for insert to authenticated
with check (private.has_permission('school.manage', network_id, id));

drop policy if exists schools_change_institutional on public.schools;
create policy schools_change_institutional on public.schools
for update to authenticated
using (private.has_permission('school.manage', network_id, id))
with check (private.has_permission('school.manage', network_id, id));

drop policy if exists schools_remove_institutional on public.schools;
create policy schools_remove_institutional on public.schools
for delete to authenticated
using (private.has_permission('school.manage', network_id, id));

drop policy if exists academic_years_read_institutional on public.academic_years;
create policy academic_years_read_institutional on public.academic_years
for select to authenticated
using (private.can_view_institutional_scope(network_id));

drop policy if exists academic_years_manage_institutional on public.academic_years;
create policy academic_years_manage_institutional on public.academic_years
for all to authenticated
using (private.has_permission('school.manage', network_id))
with check (private.has_permission('school.manage', network_id));

drop policy if exists school_years_read_institutional on public.school_years;
create policy school_years_read_institutional on public.school_years
for select to authenticated
using (exists (
  select 1 from public.schools school
  where school.id = school_years.school_id
    and private.can_view_institutional_scope(school.network_id, school.id)
));

drop policy if exists school_years_manage_institutional on public.school_years;
create policy school_years_manage_institutional on public.school_years
for all to authenticated
using (exists (
  select 1 from public.schools school
  where school.id = school_years.school_id
    and private.has_permission('school.manage', school.network_id, school.id)
))
with check (exists (
  select 1 from public.schools school
  where school.id = school_years.school_id
    and private.has_permission('school.manage', school.network_id, school.id)
));

drop policy if exists institutional_memberships_read on public.institutional_memberships;
create policy institutional_memberships_read on public.institutional_memberships
for select to authenticated
using (user_id = (select auth.uid()) or private.can_view_institutional_scope(network_id, school_id));

drop policy if exists institutional_memberships_manage on public.institutional_memberships;
create policy institutional_memberships_manage on public.institutional_memberships
for all to authenticated
using (private.has_permission('enrollment.manage', network_id, school_id))
with check (private.has_permission('enrollment.manage', network_id, school_id));

drop policy if exists student_enrollments_read on public.student_enrollments;
create policy student_enrollments_read on public.student_enrollments
for select to authenticated
using (
  student_id = (select auth.uid())
  or private.has_permission('enrollment.read', network_id, school_id)
  or (classroom_id is not null and private.can_manage_classroom(classroom_id))
);

drop policy if exists student_enrollments_create on public.student_enrollments;
create policy student_enrollments_create on public.student_enrollments
for insert to authenticated
with check (
  private.has_permission('enrollment.manage', network_id, school_id)
  or (classroom_id is not null and private.can_manage_classroom(classroom_id))
);

drop policy if exists student_enrollments_change on public.student_enrollments;
create policy student_enrollments_change on public.student_enrollments
for update to authenticated
using (
  private.has_permission('enrollment.manage', network_id, school_id)
  or (classroom_id is not null and private.can_manage_classroom(classroom_id))
)
with check (
  private.has_permission('enrollment.manage', network_id, school_id)
  or (classroom_id is not null and private.can_manage_classroom(classroom_id))
);

drop policy if exists student_enrollments_remove on public.student_enrollments;
create policy student_enrollments_remove on public.student_enrollments
for delete to authenticated
using (
  private.has_permission('enrollment.manage', network_id, school_id)
  or (classroom_id is not null and private.can_manage_classroom(classroom_id))
);

drop policy if exists student_movements_read on public.student_movements;
create policy student_movements_read on public.student_movements
for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.student_enrollments enrollment
    where enrollment.id = student_movements.enrollment_id
      and (
        private.has_permission('enrollment.read', enrollment.network_id, enrollment.school_id)
        or (enrollment.classroom_id is not null and private.can_manage_classroom(enrollment.classroom_id))
      )
  )
);

drop policy if exists student_movements_manage on public.student_movements;
create policy student_movements_manage on public.student_movements
for all to authenticated
using (
  exists (
    select 1 from public.student_enrollments enrollment
    where enrollment.id = student_movements.enrollment_id
      and (
        private.has_permission('enrollment.manage', enrollment.network_id, enrollment.school_id)
        or (enrollment.classroom_id is not null and private.can_manage_classroom(enrollment.classroom_id))
      )
  )
)
with check (
  exists (
    select 1 from public.student_enrollments enrollment
    where enrollment.id = student_movements.enrollment_id
      and (
        private.has_permission('enrollment.manage', enrollment.network_id, enrollment.school_id)
        or (enrollment.classroom_id is not null and private.can_manage_classroom(enrollment.classroom_id))
      )
  )
);

drop policy if exists classrooms_read_institutional on public.classrooms;
create policy classrooms_read_institutional on public.classrooms
for select to authenticated
using (network_id is not null and private.can_view_institutional_scope(network_id, school_id));

drop policy if exists classrooms_change_institutional on public.classrooms;
create policy classrooms_change_institutional on public.classrooms
for update to authenticated
using (network_id is not null and private.has_permission('classroom.manage', network_id, school_id))
with check (network_id is not null and private.has_permission('classroom.manage', network_id, school_id));

drop policy if exists assignments_read_institutional on public.assignments;
create policy assignments_read_institutional on public.assignments
for select to authenticated
using (exists (
  select 1 from public.classrooms classroom
  where classroom.id = assignments.classroom_id
    and classroom.network_id is not null
    and private.can_view_institutional_scope(classroom.network_id, classroom.school_id)
));

drop policy if exists assignments_create_institutional on public.assignments;
create policy assignments_create_institutional on public.assignments
for insert to authenticated
with check (exists (
  select 1 from public.classrooms classroom
  where classroom.id = assignments.classroom_id
    and classroom.network_id is not null
    and created_by = (select auth.uid())
    and private.has_permission('assessment.create', classroom.network_id, classroom.school_id)
));

grant select on public.networks, public.schools, public.academic_years, public.school_years,
  public.institutional_memberships, public.student_enrollments, public.student_movements to authenticated;
grant insert, update, delete on public.networks, public.schools, public.academic_years,
  public.school_years, public.institutional_memberships, public.student_enrollments,
  public.student_movements to authenticated;
