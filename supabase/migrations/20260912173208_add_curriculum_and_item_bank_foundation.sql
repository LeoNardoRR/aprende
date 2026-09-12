-- Aprendê - Fase 2: catálogos curriculares e banco profissional de itens.
--
-- Os catálogos oficiais possuem network_id nulo e são somente leitura para
-- usuários autenticados autorizados. Currículos próprios permanecem isolados
-- por rede. Nenhum conteúdo pedagógico oficial é inventado nesta migration.

insert into private.permissions (key, description)
values
  ('curriculum.read', 'Consultar catálogos curriculares'),
  ('item.update_own', 'Alterar os próprios itens enquanto editáveis'),
  ('item.archive', 'Arquivar itens avaliativos')
on conflict (key) do nothing;

insert into private.role_permissions (role, permission_key)
values
  ('network_admin', 'curriculum.read'),
  ('network_admin', 'item.update_own'),
  ('network_admin', 'item.archive'),
  ('manager', 'curriculum.read'),
  ('manager', 'item.create'),
  ('manager', 'item.read'),
  ('manager', 'item.update_own'),
  ('manager', 'item.review'),
  ('manager', 'item.approve'),
  ('manager', 'item.archive'),
  ('reviewer', 'curriculum.read'),
  ('reviewer', 'item.read'),
  ('reviewer', 'item.update_own'),
  ('approver', 'curriculum.read'),
  ('approver', 'item.archive'),
  ('teacher', 'curriculum.read'),
  ('teacher', 'item.read'),
  ('teacher', 'item.create'),
  ('teacher', 'item.update_own')
on conflict do nothing;

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  network_id uuid references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  curriculum_type text not null check (curriculum_type in ('bncc', 'saeb', 'custom')),
  version text not null check (char_length(version) between 1 and 40),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((curriculum_type in ('bncc', 'saeb') and network_id is null)
    or (curriculum_type = 'custom' and network_id is not null))
);

create unique index curricula_official_name_version_ux
  on public.curricula (curriculum_type, name, version) where network_id is null;
create unique index curricula_network_name_version_ux
  on public.curricula (network_id, name, version) where network_id is not null;
create index curricula_network_active_idx on public.curricula(network_id, active);

create table public.curriculum_areas (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  code text,
  name text not null check (char_length(name) between 2 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, name),
  unique (id, curriculum_id)
);

create table public.curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  area_id uuid not null references public.curriculum_areas(id) on delete cascade,
  code text,
  name text not null check (char_length(name) between 2 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (area_id, curriculum_id) references public.curriculum_areas(id, curriculum_id),
  unique (curriculum_id, name),
  unique (id, curriculum_id)
);

create table public.curriculum_school_years (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  school_year_id uuid references public.school_years(id) on delete restrict,
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, code),
  unique (id, curriculum_id)
);

create table public.curriculum_thematic_units (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  subject_id uuid not null,
  curriculum_school_year_id uuid,
  name text not null check (char_length(name) between 2 and 240),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, curriculum_id) references public.curriculum_subjects(id, curriculum_id),
  foreign key (curriculum_school_year_id, curriculum_id)
    references public.curriculum_school_years(id, curriculum_id),
  unique (id, curriculum_id),
  unique (curriculum_id, subject_id, curriculum_school_year_id, name)
);

create table public.curriculum_knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  thematic_unit_id uuid not null,
  name text not null check (char_length(name) between 2 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (thematic_unit_id, curriculum_id)
    references public.curriculum_thematic_units(id, curriculum_id),
  unique (id, curriculum_id),
  unique (curriculum_id, thematic_unit_id, name)
);

create table public.curriculum_skills (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  subject_id uuid not null,
  curriculum_school_year_id uuid not null,
  thematic_unit_id uuid,
  knowledge_object_id uuid,
  code text not null check (char_length(code) between 2 and 60),
  description text not null check (char_length(description) between 5 and 4000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, curriculum_id) references public.curriculum_subjects(id, curriculum_id),
  foreign key (curriculum_school_year_id, curriculum_id)
    references public.curriculum_school_years(id, curriculum_id),
  foreign key (thematic_unit_id, curriculum_id)
    references public.curriculum_thematic_units(id, curriculum_id),
  foreign key (knowledge_object_id, curriculum_id)
    references public.curriculum_knowledge_objects(id, curriculum_id),
  unique (curriculum_id, code),
  unique (id, curriculum_id)
);

create index curriculum_areas_curriculum_idx on public.curriculum_areas(curriculum_id, sort_order);
create index curriculum_subjects_curriculum_idx on public.curriculum_subjects(curriculum_id, area_id, sort_order);
create index curriculum_school_years_curriculum_idx on public.curriculum_school_years(curriculum_id, sort_order);
create index curriculum_units_subject_idx on public.curriculum_thematic_units(curriculum_id, subject_id, curriculum_school_year_id);
create index curriculum_objects_unit_idx on public.curriculum_knowledge_objects(curriculum_id, thematic_unit_id);
create index curriculum_skills_filter_idx on public.curriculum_skills(curriculum_id, subject_id, curriculum_school_year_id, active);
create index curriculum_skills_code_idx on public.curriculum_skills(code);

create table public.curriculum_imports (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete cascade,
  file_name text not null,
  format text not null check (format in ('csv', 'json')),
  status text not null default 'preview' check (status in ('preview', 'validated', 'imported', 'failed', 'cancelled')),
  row_count integer not null default 0 check (row_count >= 0),
  valid_count integer not null default 0 check (valid_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  preview_rows jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);
create index curriculum_imports_network_idx on public.curriculum_imports(network_id, created_at desc);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete restrict,
  curriculum_school_year_id uuid not null,
  subject_id uuid not null,
  skill_id uuid not null,
  thematic_unit_id uuid,
  knowledge_object_id uuid,
  internal_title text not null check (char_length(internal_title) between 2 and 180),
  statement text not null check (char_length(statement) between 5 and 20000),
  support_text text check (support_text is null or char_length(support_text) <= 30000),
  pedagogical_comment text check (pedagogical_comment is null or char_length(pedagogical_comment) <= 10000),
  correct_answer_justification text check (correct_answer_justification is null or char_length(correct_answer_justification) <= 10000),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  item_type text not null check (item_type in ('multiple_choice', 'true_false', 'essay')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'reviewed', 'approved', 'rejected', 'archived')),
  author_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_id uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (curriculum_school_year_id, curriculum_id)
    references public.curriculum_school_years(id, curriculum_id),
  foreign key (subject_id, curriculum_id) references public.curriculum_subjects(id, curriculum_id),
  foreign key (skill_id, curriculum_id) references public.curriculum_skills(id, curriculum_id),
  foreign key (thematic_unit_id, curriculum_id)
    references public.curriculum_thematic_units(id, curriculum_id),
  foreign key (knowledge_object_id, curriculum_id)
    references public.curriculum_knowledge_objects(id, curriculum_id)
);

create table public.assessment_item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.assessment_items(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 8),
  content text not null check (char_length(content) between 1 and 10000),
  is_correct boolean not null default false,
  feedback text check (feedback is null or char_length(feedback) <= 10000),
  distractor_analysis text check (distractor_analysis is null or char_length(distractor_analysis) <= 10000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, label)
);

create table public.assessment_item_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.assessment_items(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_summary text check (change_summary is null or char_length(change_summary) <= 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (item_id, version_number)
);

create table public.assessment_item_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.assessment_items(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  action text not null check (action in ('submitted', 'returned', 'reviewed', 'approved', 'rejected', 'archived', 'restored')),
  comment text check (comment is null or char_length(comment) <= 4000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  network_id uuid references public.networks(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assessment_items_network_status_idx on public.assessment_items(network_id, status, updated_at desc);
create index assessment_items_curriculum_idx on public.assessment_items(curriculum_id, updated_at desc);
create index assessment_items_subject_year_idx on public.assessment_items(subject_id, curriculum_school_year_id);
create index assessment_items_skill_idx on public.assessment_items(skill_id);
create index assessment_items_author_idx on public.assessment_items(author_id, updated_at desc);
create index assessment_items_reviewer_idx on public.assessment_items(reviewer_id, status);
create index assessment_items_approver_idx on public.assessment_items(approver_id, status);
create index assessment_items_search_idx on public.assessment_items using gin
  (to_tsvector('portuguese', internal_title || ' ' || statement));
create index assessment_item_options_item_idx on public.assessment_item_options(item_id, sort_order);
create index assessment_item_versions_item_idx on public.assessment_item_versions(item_id, version_number desc);
create index assessment_item_reviews_item_idx on public.assessment_item_reviews(item_id, created_at desc);
create index audit_logs_scope_idx on public.audit_logs(network_id, entity_type, created_at desc);

create or replace function private.can_read_curriculum(target_curriculum uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.curricula curriculum
    where curriculum.id = target_curriculum
      and curriculum.active
      and private.has_permission('curriculum.read', curriculum.network_id)
  );
$$;

create or replace function private.can_manage_curriculum(target_curriculum uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.curricula curriculum
    where curriculum.id = target_curriculum
      and curriculum.curriculum_type = 'custom'
      and curriculum.network_id is not null
      and private.has_permission('curriculum.manage', curriculum.network_id)
  );
$$;

create or replace function private.can_read_item(target_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_items item
    where item.id = target_item and private.has_permission('item.read', item.network_id)
  );
$$;

create or replace function private.can_edit_item(target_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_items item
    where item.id = target_item
      and item.status in ('draft', 'rejected')
      and (
        (item.author_id = (select auth.uid()) and private.has_permission('item.update_own', item.network_id))
        or private.has_permission('item.archive', item.network_id)
      )
  );
$$;

create or replace function private.item_snapshot(target_item uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(item) || jsonb_build_object(
    'options', coalesce((
      select jsonb_agg(to_jsonb(option_row) order by option_row.sort_order, option_row.label)
      from public.assessment_item_options option_row where option_row.item_id = item.id
    ), '[]'::jsonb)
  )
  from public.assessment_items item where item.id = target_item;
$$;

create or replace function private.validate_item(target_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.assessment_items%rowtype; option_count integer; correct_count integer;
begin
  select * into item from public.assessment_items where id = target_item;
  if item.id is null then raise exception 'Item not found'; end if;
  if not exists (
    select 1 from public.curricula curriculum
    where curriculum.id = item.curriculum_id and curriculum.active
      and (curriculum.network_id is null or curriculum.network_id = item.network_id)
  ) then raise exception 'Curriculum is outside item scope or inactive'; end if;
  if not exists (select 1 from public.curriculum_skills skill where skill.id = item.skill_id and skill.active)
  then raise exception 'Skill does not exist or is inactive'; end if;
  if item.item_type = 'multiple_choice' then
    select count(*), count(*) filter (where is_correct) into option_count, correct_count
    from public.assessment_item_options where item_id = target_item;
    if option_count < 4 then raise exception 'Multiple choice item requires at least four options'; end if;
    if correct_count <> 1 then raise exception 'Multiple choice item requires exactly one correct option'; end if;
  elsif item.item_type = 'true_false' then
    select count(*), count(*) filter (where is_correct) into option_count, correct_count
    from public.assessment_item_options where item_id = target_item;
    if option_count <> 2 or correct_count <> 1 then
      raise exception 'True/false item requires two options and one correct answer';
    end if;
  end if;
end;
$$;

create or replace function public.transition_assessment_item(
  target_item uuid,
  target_action text,
  action_comment text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.assessment_items%rowtype; next_status text; action_name text; next_version integer;
begin
  select * into item from public.assessment_items where id = target_item for update;
  if item.id is null then raise exception 'Item not found'; end if;

  if target_action = 'submit' then
    if item.status not in ('draft', 'rejected') or not private.can_edit_item(item.id) then raise exception 'Not authorized'; end if;
    perform private.validate_item(item.id); next_status := 'in_review'; action_name := 'submitted';
  elsif target_action = 'return' then
    if item.status <> 'in_review' or not private.has_permission('item.review', item.network_id) then raise exception 'Not authorized'; end if;
    next_status := 'rejected'; action_name := 'returned';
  elsif target_action = 'review' then
    if item.status <> 'in_review' or not private.has_permission('item.review', item.network_id) then raise exception 'Not authorized'; end if;
    perform private.validate_item(item.id); next_status := 'reviewed'; action_name := 'reviewed';
  elsif target_action = 'approve' then
    if item.status <> 'reviewed' or not private.has_permission('item.approve', item.network_id) then raise exception 'Not authorized'; end if;
    perform private.validate_item(item.id); next_status := 'approved'; action_name := 'approved';
  elsif target_action = 'reject' then
    if item.status not in ('in_review', 'reviewed') or not private.has_permission('item.approve', item.network_id) then raise exception 'Not authorized'; end if;
    next_status := 'rejected'; action_name := 'rejected';
  elsif target_action = 'archive' then
    if item.status = 'archived' or not private.has_permission('item.archive', item.network_id) then raise exception 'Not authorized'; end if;
    next_status := 'archived'; action_name := 'archived';
  else raise exception 'Invalid item action';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.assessment_item_versions where item_id = item.id;
  insert into public.assessment_item_versions(item_id, version_number, snapshot, change_summary, created_by)
  values (item.id, next_version, private.item_snapshot(item.id), nullif(trim(action_comment), ''), auth.uid());

  update public.assessment_items set status = next_status,
    reviewer_id = case when action_name in ('reviewed', 'returned') then auth.uid() else reviewer_id end,
    approver_id = case when action_name in ('approved', 'rejected') then auth.uid() else approver_id end,
    current_version = next_version, updated_at = now()
  where id = item.id;

  insert into public.assessment_item_reviews(item_id, from_status, to_status, action, comment, actor_id)
  values (item.id, item.status, next_status, action_name, nullif(trim(action_comment), ''), auth.uid());
  insert into public.audit_logs(network_id, actor_id, entity_type, entity_id, action, metadata)
  values (item.network_id, auth.uid(), 'assessment_item', item.id, action_name,
    jsonb_build_object('from_status', item.status, 'to_status', next_status, 'version', next_version));
end;
$$;

create or replace function public.list_assessment_items(
  target_network uuid,
  status_filter text default '',
  curriculum_filter uuid default null,
  subject_filter uuid default null,
  school_year_filter uuid default null,
  skill_filter uuid default null,
  difficulty_filter text default '',
  author_filter uuid default null,
  reviewer_filter uuid default null,
  approver_filter uuid default null,
  search_query text default '',
  page_size integer default 25,
  page_offset integer default 0
)
returns table (
  item_id uuid, internal_title text, statement text, item_type text, difficulty text,
  item_status text, curriculum_name text, subject_name text, school_year_name text,
  skill_code text, author_name text, reviewer_name text, approver_name text,
  current_version integer, updated_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_permission('item.read', target_network) then raise exception 'Not authorized'; end if;
  return query
  select item.id, item.internal_title, item.statement, item.item_type, item.difficulty,
    item.status, curriculum.name, subject.name, school_year.name, skill.code,
    author.display_name, reviewer.display_name, approver.display_name,
    item.current_version, item.updated_at, count(*) over()
  from public.assessment_items item
  join public.curricula curriculum on curriculum.id = item.curriculum_id
  join public.curriculum_subjects subject on subject.id = item.subject_id
  join public.curriculum_school_years school_year on school_year.id = item.curriculum_school_year_id
  join public.curriculum_skills skill on skill.id = item.skill_id
  join public.profiles author on author.id = item.author_id
  left join public.profiles reviewer on reviewer.id = item.reviewer_id
  left join public.profiles approver on approver.id = item.approver_id
  where item.network_id = target_network
    and (coalesce(trim(status_filter), '') = '' or item.status = status_filter)
    and (curriculum_filter is null or item.curriculum_id = curriculum_filter)
    and (subject_filter is null or item.subject_id = subject_filter)
    and (school_year_filter is null or item.curriculum_school_year_id = school_year_filter)
    and (skill_filter is null or item.skill_id = skill_filter)
    and (coalesce(trim(difficulty_filter), '') = '' or item.difficulty = difficulty_filter)
    and (author_filter is null or item.author_id = author_filter)
    and (reviewer_filter is null or item.reviewer_id = reviewer_filter)
    and (approver_filter is null or item.approver_id = approver_filter)
    and (coalesce(trim(search_query), '') = '' or
      to_tsvector('portuguese', item.internal_title || ' ' || item.statement)
        @@ plainto_tsquery('portuguese', trim(search_query)))
  order by item.updated_at desc, item.id
  limit least(greatest(page_size, 1), 100) offset greatest(page_offset, 0);
end;
$$;

create or replace view public.approved_assessment_items
with (security_invoker = true) as
select * from public.assessment_items where status = 'approved';

alter table public.curricula enable row level security;
alter table public.curriculum_areas enable row level security;
alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_school_years enable row level security;
alter table public.curriculum_thematic_units enable row level security;
alter table public.curriculum_knowledge_objects enable row level security;
alter table public.curriculum_skills enable row level security;
alter table public.curriculum_imports enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_item_options enable row level security;
alter table public.assessment_item_versions enable row level security;
alter table public.assessment_item_reviews enable row level security;
alter table public.audit_logs enable row level security;

create policy curricula_read on public.curricula for select to authenticated
using (private.can_read_curriculum(id));
create policy curricula_create on public.curricula for insert to authenticated
with check (curriculum_type = 'custom' and network_id is not null
  and created_by = (select auth.uid()) and private.has_permission('curriculum.manage', network_id));
create policy curricula_change on public.curricula for update to authenticated
using (private.can_manage_curriculum(id)) with check (private.can_manage_curriculum(id));

create policy curriculum_areas_read on public.curriculum_areas for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_areas_manage on public.curriculum_areas for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));
create policy curriculum_subjects_read on public.curriculum_subjects for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_subjects_manage on public.curriculum_subjects for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));
create policy curriculum_years_read on public.curriculum_school_years for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_years_manage on public.curriculum_school_years for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));
create policy curriculum_units_read on public.curriculum_thematic_units for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_units_manage on public.curriculum_thematic_units for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));
create policy curriculum_objects_read on public.curriculum_knowledge_objects for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_objects_manage on public.curriculum_knowledge_objects for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));
create policy curriculum_skills_read on public.curriculum_skills for select to authenticated
using (private.can_read_curriculum(curriculum_id));
create policy curriculum_skills_manage on public.curriculum_skills for all to authenticated
using (private.can_manage_curriculum(curriculum_id)) with check (private.can_manage_curriculum(curriculum_id));

create policy curriculum_imports_read on public.curriculum_imports for select to authenticated
using (private.has_permission('curriculum.manage', network_id));
create policy curriculum_imports_create on public.curriculum_imports for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_permission('curriculum.manage', network_id));
create policy curriculum_imports_change on public.curriculum_imports for update to authenticated
using (created_by = (select auth.uid()) and status in ('preview', 'validated'))
with check (created_by = (select auth.uid()) and private.has_permission('curriculum.manage', network_id));

create policy assessment_items_read on public.assessment_items for select to authenticated
using (private.has_permission('item.read', network_id));
create policy assessment_items_create on public.assessment_items for insert to authenticated
with check (author_id = (select auth.uid()) and status = 'draft'
  and private.has_permission('item.create', network_id)
  and exists (select 1 from public.curricula curriculum where curriculum.id = curriculum_id
    and curriculum.active and (curriculum.network_id is null or curriculum.network_id = network_id)));
create policy assessment_items_change on public.assessment_items for update to authenticated
using (private.can_edit_item(id)) with check (private.can_edit_item(id));

create policy item_options_read on public.assessment_item_options for select to authenticated
using (private.can_read_item(item_id));
create policy item_options_create on public.assessment_item_options for insert to authenticated
with check (private.can_edit_item(item_id));
create policy item_options_change on public.assessment_item_options for update to authenticated
using (private.can_edit_item(item_id)) with check (private.can_edit_item(item_id));
create policy item_options_remove on public.assessment_item_options for delete to authenticated
using (private.can_edit_item(item_id));

create policy item_versions_read on public.assessment_item_versions for select to authenticated
using (private.can_read_item(item_id));
create policy item_reviews_read on public.assessment_item_reviews for select to authenticated
using (private.can_read_item(item_id));
create policy audit_logs_read on public.audit_logs for select to authenticated
using (private.has_permission('report.read', network_id));

grant select, insert, update on public.curricula, public.curriculum_areas, public.curriculum_subjects,
  public.curriculum_school_years, public.curriculum_thematic_units,
  public.curriculum_knowledge_objects, public.curriculum_skills, public.curriculum_imports to authenticated;
grant delete on public.curriculum_areas, public.curriculum_subjects, public.curriculum_school_years,
  public.curriculum_thematic_units, public.curriculum_knowledge_objects, public.curriculum_skills to authenticated;
grant select, insert, update on public.assessment_items to authenticated;
grant select, insert, update, delete on public.assessment_item_options to authenticated;
grant select on public.assessment_item_versions, public.assessment_item_reviews,
  public.audit_logs, public.approved_assessment_items to authenticated;

revoke all on function public.transition_assessment_item(uuid, text, text) from public, anon;
revoke all on function public.list_assessment_items(uuid, text, uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer, integer) from public, anon;
grant execute on function public.transition_assessment_item(uuid, text, text) to authenticated;
grant execute on function public.list_assessment_items(uuid, text, uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer, integer) to authenticated;

revoke all on function private.can_read_curriculum(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_curriculum(uuid) from public, anon, authenticated;
revoke all on function private.can_read_item(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_item(uuid) from public, anon, authenticated;
revoke all on function private.item_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.validate_item(uuid) from public, anon, authenticated;
grant execute on function private.can_read_curriculum(uuid) to authenticated;
grant execute on function private.can_manage_curriculum(uuid) to authenticated;
grant execute on function private.can_read_item(uuid) to authenticated;
grant execute on function private.can_edit_item(uuid) to authenticated;
