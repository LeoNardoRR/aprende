-- Aprendê - Fase 7: recomposição, jornadas, fluência e recursos pedagógicos.
-- Migration aditiva. Conteúdo do seed é sintético e produção não é acessada.

insert into private.permissions(key, description) values
  ('pedagogy.read', 'Consultar catálogo e intervenções pedagógicas'),
  ('pedagogy.manage', 'Criar e editar recursos e jornadas'),
  ('pedagogy.review', 'Revisar e publicar conteúdo pedagógico'),
  ('pedagogy.assign', 'Atribuir jornadas e acompanhar progresso'),
  ('fluency.manage', 'Agendar e registrar aplicações de fluência'),
  ('equity.read', 'Consultar agregações de equidade com supressão')
on conflict (key) do nothing;

insert into private.role_permissions(role, permission_key) values
  ('network_admin','pedagogy.read'),('network_admin','pedagogy.manage'),('network_admin','pedagogy.review'),('network_admin','pedagogy.assign'),('network_admin','fluency.manage'),('network_admin','equity.read'),
  ('manager','pedagogy.read'),('manager','pedagogy.manage'),('manager','pedagogy.assign'),('manager','fluency.manage'),('manager','equity.read'),
  ('teacher','pedagogy.read'),('teacher','pedagogy.manage'),('teacher','pedagogy.assign'),('teacher','fluency.manage'),
  ('reviewer','pedagogy.read'),('reviewer','pedagogy.review'),
  ('approver','pedagogy.read'),('approver','pedagogy.review')
on conflict do nothing;

create table public.pedagogical_resources (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete restrict,
  subject_id uuid references public.curriculum_subjects(id) on delete restrict,
  curriculum_school_year_id uuid references public.curriculum_school_years(id) on delete restrict,
  thematic_unit_id uuid references public.curriculum_thematic_units(id) on delete restrict,
  knowledge_object_id uuid references public.curriculum_knowledge_objects(id) on delete restrict,
  skill_id uuid references public.curriculum_skills(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 5 and 5000),
  resource_type text not null check (resource_type in ('text','image','video','audio','pdf','presentation','link','interactive','quiz','exercise','game')),
  difficulty text not null default 'adaptive' check (difficulty in ('introductory','easy','medium','advanced','adaptive')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
  accessibility jsonb not null default '{}'::jsonb check (jsonb_typeof(accessibility)='object'),
  source_name text,
  external_url text check (external_url is null or external_url ~ '^https://'),
  storage_path text,
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  author_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is null or storage_path like network_id::text || '/%')
);

create table public.pedagogical_resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.pedagogical_resources(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  change_summary text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(resource_id, version_number)
);

create table public.remediation_programs (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 180),
  description text not null check (char_length(description) between 5 and 5000),
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','active','closed','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(network_id, name)
);

create table public.learning_journeys (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  program_id uuid references public.remediation_programs(id) on delete set null,
  curriculum_id uuid references public.curricula(id) on delete restrict,
  subject_id uuid references public.curriculum_subjects(id) on delete restrict,
  curriculum_school_year_id uuid references public.curriculum_school_years(id) on delete restrict,
  knowledge_object_id uuid references public.curriculum_knowledge_objects(id) on delete restrict,
  skill_id uuid references public.curriculum_skills(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 5 and 5000),
  difficulty text not null default 'adaptive' check (difficulty in ('introductory','easy','medium','advanced','adaptive')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1200),
  mastery_threshold numeric(5,2) not null default 70 check (mastery_threshold between 0 and 100),
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_journey_versions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.learning_journeys(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(journey_id, version_number)
);

create table public.learning_journey_steps (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.learning_journeys(id) on delete cascade,
  resource_id uuid references public.pedagogical_resources(id) on delete restrict,
  assessment_id uuid references public.diagnostic_assessments(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 180),
  instructions text not null check (char_length(instructions) between 3 and 5000),
  step_type text not null check (step_type in ('content','interactive','exercise','quiz','reassessment','review')),
  position integer not null check (position > 0),
  required boolean not null default true,
  pedagogical_points integer not null default 0 check (pedagogical_points >= 0),
  gamification_points integer not null default 0 check (gamification_points >= 0),
  created_at timestamptz not null default now(),
  unique(journey_id, position),
  check (resource_id is not null or assessment_id is not null)
);

create table public.learning_journey_prerequisites (
  journey_id uuid not null references public.learning_journeys(id) on delete cascade,
  prerequisite_journey_id uuid not null references public.learning_journeys(id) on delete restrict,
  primary key(journey_id, prerequisite_journey_id),
  check (journey_id <> prerequisite_journey_id)
);

create table public.learning_journey_assignments (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.learning_journeys(id) on delete restrict,
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  target_type text not null check (target_type in ('classroom','student')),
  target_student_id uuid references public.profiles(id) on delete restrict,
  source_assessment_id uuid references public.diagnostic_assessments(id) on delete set null,
  source_skill_id uuid references public.curriculum_skills(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 2000),
  starts_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'active' check (status in ('scheduled','active','closed','cancelled')),
  idempotency_key uuid not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (due_at is null or due_at >= starts_at),
  check ((target_type='student' and target_student_id is not null) or (target_type='classroom' and target_student_id is null)),
  unique(assigned_by, idempotency_key)
);

create table public.learning_journey_students (
  assignment_id uuid not null references public.learning_journey_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed','cancelled')),
  progress_percentage numeric(5,2) not null default 0 check (progress_percentage between 0 and 100),
  pedagogical_score numeric(10,2),
  gamification_points integer not null default 0 check (gamification_points >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(assignment_id, student_id)
);

create table public.learning_journey_step_progress (
  assignment_id uuid not null,
  student_id uuid not null,
  step_id uuid not null references public.learning_journey_steps(id) on delete restrict,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  response jsonb not null default '{}'::jsonb check (jsonb_typeof(response)='object'),
  pedagogical_score numeric(10,2),
  teacher_feedback text check (teacher_feedback is null or char_length(teacher_feedback)<=5000),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(assignment_id, student_id, step_id),
  foreign key(assignment_id, student_id) references public.learning_journey_students(assignment_id, student_id) on delete cascade
);

create table public.pedagogical_evidence (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  student_id uuid not null,
  step_id uuid references public.learning_journey_steps(id) on delete restrict,
  evidence_type text not null check (evidence_type in ('text','file','link','teacher_observation')),
  content text check (content is null or char_length(content)<=10000),
  storage_path text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(assignment_id, student_id) references public.learning_journey_students(assignment_id, student_id) on delete cascade
);

create table public.pedagogical_recommendations (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  assessment_id uuid references public.diagnostic_assessments(id) on delete set null,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  journey_id uuid references public.learning_journeys(id) on delete set null,
  observed_percentage numeric(5,2) check (observed_percentage between 0 and 100),
  threshold_percentage numeric(5,2) not null check (threshold_percentage between 0 and 100),
  explanation text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','replaced')),
  decided_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  decided_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.ai_pedagogical_suggestions (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('activity','explanation','item','difficulty_adaptation','summary','feedback')),
  structured_prompt jsonb not null check (jsonb_typeof(structured_prompt)='object'),
  generated_content jsonb not null check (jsonb_typeof(generated_content)='object'),
  provider text,
  model text,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (not structured_prompt ?| array['student_name','student_email','cpf','rg','ra'])
);

create table public.reading_fluency_activities (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  resource_id uuid not null references public.pedagogical_resources(id) on delete restrict,
  title text not null,
  starts_at timestamptz not null,
  due_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','active','closed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (due_at is null or due_at >= starts_at)
);

create table public.reading_fluency_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.reading_fluency_activities(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  words_read integer not null check (words_read >= 0),
  correct_words integer not null check (correct_words >= 0 and correct_words <= words_read),
  errors integer not null default 0 check (errors >= 0),
  omissions integer not null default 0 check (omissions >= 0),
  substitutions integer not null default 0 check (substitutions >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  correct_words_per_minute numeric(8,2) generated always as (round((correct_words::numeric * 60) / duration_seconds, 2)) stored,
  classification text,
  audio_path text,
  notes text check (notes is null or char_length(notes)<=5000),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique(activity_id, student_id)
);

create table public.equity_group_definitions (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text not null check (char_length(description) between 3 and 2000),
  minimum_group_size integer not null default 10 check (minimum_group_size between 3 and 100),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(network_id, name)
);

create table public.equity_group_members (
  group_id uuid not null references public.equity_group_definitions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key(group_id, student_id)
);

create table private.journey_progress_operations (
  assignment_id uuid not null,
  student_id uuid not null,
  request_key uuid not null,
  completed_at timestamptz not null default now(),
  primary key(assignment_id, student_id, request_key),
  foreign key(assignment_id, student_id) references public.learning_journey_students(assignment_id, student_id) on delete cascade
);

create index pedagogical_resources_catalog_idx on public.pedagogical_resources(network_id,status,resource_type,skill_id,created_at desc);
create index learning_journeys_catalog_idx on public.learning_journeys(network_id,status,skill_id,created_at desc);
create index journey_steps_order_idx on public.learning_journey_steps(journey_id,position);
create index journey_assignments_scope_idx on public.learning_journey_assignments(network_id,school_id,classroom_id,status,created_at desc);
create index journey_students_student_idx on public.learning_journey_students(student_id,status,updated_at desc);
create index recommendations_scope_idx on public.pedagogical_recommendations(network_id,school_id,classroom_id,status,skill_id);
create index fluency_sessions_student_idx on public.reading_fluency_sessions(student_id,recorded_at desc);
create index equity_members_student_idx on public.equity_group_members(student_id,group_id);

create or replace function private.can_access_pedagogy_scope(target_network uuid,target_school uuid,target_classroom uuid default null,target_student uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    (target_student is not null and target_student=(select auth.uid()))
    or exists(select 1 from public.institutional_memberships m where m.user_id=(select auth.uid()) and m.network_id=target_network and m.status='active' and (m.role='network_admin' or (m.role='manager' and m.school_id=target_school)))
    or (target_classroom is not null and exists(select 1 from public.classrooms c where c.id=target_classroom and c.network_id=target_network and c.school_id=target_school and c.owner_id=(select auth.uid())))
  );
$$;

alter table public.pedagogical_resources enable row level security;
alter table public.pedagogical_resource_versions enable row level security;
alter table public.remediation_programs enable row level security;
alter table public.learning_journeys enable row level security;
alter table public.learning_journey_versions enable row level security;
alter table public.learning_journey_steps enable row level security;
alter table public.learning_journey_prerequisites enable row level security;
alter table public.learning_journey_assignments enable row level security;
alter table public.learning_journey_students enable row level security;
alter table public.learning_journey_step_progress enable row level security;
alter table public.pedagogical_evidence enable row level security;
alter table public.pedagogical_recommendations enable row level security;
alter table public.ai_pedagogical_suggestions enable row level security;
alter table public.reading_fluency_activities enable row level security;
alter table public.reading_fluency_sessions enable row level security;
alter table public.equity_group_definitions enable row level security;
alter table public.equity_group_members enable row level security;
alter table private.journey_progress_operations enable row level security;

create policy pedagogical_resources_read on public.pedagogical_resources for select to authenticated using (status='published' and private.has_permission('pedagogy.read',network_id) or author_id=(select auth.uid()) or private.has_permission('pedagogy.review',network_id));
create policy pedagogical_versions_read on public.pedagogical_resource_versions for select to authenticated using (exists(select 1 from public.pedagogical_resources r where r.id=resource_id and (r.status='published' and private.has_permission('pedagogy.read',r.network_id) or r.author_id=(select auth.uid()) or private.has_permission('pedagogy.review',r.network_id))));
create policy remediation_programs_read on public.remediation_programs for select to authenticated using (private.has_permission('pedagogy.read',network_id));
create policy learning_journeys_read on public.learning_journeys for select to authenticated using ((status='published' and private.has_permission('pedagogy.read',network_id)) or created_by=(select auth.uid()) or private.has_permission('pedagogy.review',network_id));
create policy journey_versions_read on public.learning_journey_versions for select to authenticated using (exists(select 1 from public.learning_journeys j where j.id=journey_id and ((j.status='published' and private.has_permission('pedagogy.read',j.network_id)) or j.created_by=(select auth.uid()) or private.has_permission('pedagogy.review',j.network_id))));
create policy journey_steps_read on public.learning_journey_steps for select to authenticated using (exists(select 1 from public.learning_journeys j where j.id=journey_id and ((j.status='published' and private.has_permission('pedagogy.read',j.network_id)) or j.created_by=(select auth.uid()) or private.has_permission('pedagogy.review',j.network_id))));
create policy journey_prerequisites_read on public.learning_journey_prerequisites for select to authenticated using (exists(select 1 from public.learning_journeys j where j.id=journey_id and j.status='published' and private.has_permission('pedagogy.read',j.network_id)));
create policy journey_assignments_read on public.learning_journey_assignments for select to authenticated using (private.can_access_pedagogy_scope(network_id,school_id,classroom_id,target_student_id));
create policy journey_students_read on public.learning_journey_students for select to authenticated using (student_id=(select auth.uid()) or exists(select 1 from public.learning_journey_assignments a where a.id=assignment_id and private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,student_id)));
create policy journey_progress_read on public.learning_journey_step_progress for select to authenticated using (student_id=(select auth.uid()) or exists(select 1 from public.learning_journey_assignments a where a.id=assignment_id and private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,student_id)));
create policy pedagogical_evidence_read on public.pedagogical_evidence for select to authenticated using (student_id=(select auth.uid()) or exists(select 1 from public.learning_journey_assignments a where a.id=assignment_id and private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,student_id)));
create policy recommendations_read on public.pedagogical_recommendations for select to authenticated using (private.can_access_pedagogy_scope(network_id,school_id,classroom_id,student_id));
create policy ai_suggestions_read on public.ai_pedagogical_suggestions for select to authenticated using (requested_by=(select auth.uid()) or private.has_permission('pedagogy.review',network_id));
create policy fluency_activities_read on public.reading_fluency_activities for select to authenticated using (private.can_access_pedagogy_scope(network_id,school_id,classroom_id,null));
create policy fluency_sessions_read on public.reading_fluency_sessions for select to authenticated using (student_id=(select auth.uid()) or exists(select 1 from public.reading_fluency_activities a where a.id=activity_id and private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,student_id)));
create policy equity_groups_read on public.equity_group_definitions for select to authenticated using (private.has_permission('equity.read',network_id));
create policy equity_members_read on public.equity_group_members for select to authenticated using (exists(select 1 from public.equity_group_definitions g where g.id=group_id and private.has_permission('equity.read',g.network_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('pedagogical-resources','pedagogical-resources',false,104857600,array['image/png','image/jpeg','image/webp','audio/mpeg','audio/ogg','video/mp4','application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('reading-fluency-audio','reading-fluency-audio',false,52428800,array['audio/mpeg','audio/ogg','audio/webm','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy pedagogical_storage_read on storage.objects for select to authenticated using (bucket_id='pedagogical-resources' and private.has_permission('pedagogy.read',(storage.foldername(name))[1]::uuid));
create policy pedagogical_storage_write on storage.objects for insert to authenticated with check (bucket_id='pedagogical-resources' and owner_id=(select auth.uid()::text) and private.has_permission('pedagogy.manage',(storage.foldername(name))[1]::uuid));
create policy fluency_audio_read on storage.objects for select to authenticated using (bucket_id='reading-fluency-audio' and exists(select 1 from public.reading_fluency_sessions s join public.reading_fluency_activities a on a.id=s.activity_id where s.audio_path=storage.objects.name and private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,s.student_id)));
create policy fluency_audio_write on storage.objects for insert to authenticated with check (bucket_id='reading-fluency-audio' and owner_id=(select auth.uid()::text) and private.has_permission('fluency.manage',(storage.foldername(name))[1]::uuid));

create or replace function public.create_learning_journey(target_network uuid,title text,description text,target_skill uuid default null,mastery_threshold numeric default 70)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
  if not private.has_permission('pedagogy.manage',target_network) then raise exception 'Not authorized'; end if;
  if target_skill is not null and not exists(select 1 from public.curriculum_skills s join public.curricula c on c.id=s.curriculum_id where s.id=target_skill and (c.network_id is null or c.network_id=target_network)) then raise exception 'Skill outside network'; end if;
  insert into public.learning_journeys(network_id,skill_id,title,description,mastery_threshold,created_by)
  values(target_network,target_skill,trim(title),trim(description),mastery_threshold,auth.uid()) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.create_pedagogical_resource(target_network uuid,title text,description text,resource_type text,target_skill uuid default null,estimated_minutes integer default null,source_name text default null,external_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
  if not private.has_permission('pedagogy.manage',target_network) then raise exception 'Not authorized'; end if;
  if resource_type not in ('text','image','video','audio','pdf','presentation','link','interactive','quiz','exercise','game') then raise exception 'Invalid resource type'; end if;
  insert into public.pedagogical_resources(network_id,title,description,resource_type,skill_id,estimated_minutes,source_name,external_url,author_id)
  values(target_network,trim(title),trim(description),resource_type,target_skill,estimated_minutes,nullif(trim(source_name),''),nullif(trim(external_url),''),auth.uid()) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.transition_pedagogical_resource(target_resource uuid,target_status text,change_summary text default null)
returns public.pedagogical_resources language plpgsql security definer set search_path='' as $$
declare resource public.pedagogical_resources; next_version integer;
begin
  select * into resource from public.pedagogical_resources where id=target_resource for update;
  if resource.id is null then raise exception 'Resource not found'; end if;
  if target_status='review' and resource.author_id=(select auth.uid()) and resource.status='draft' then null;
  elsif target_status in ('approved','published','archived') and private.has_permission('pedagogy.review',resource.network_id) then null;
  else raise exception 'Not authorized transition'; end if;
  next_version:=resource.current_version+1;
  if target_status='published' then
    insert into public.pedagogical_resource_versions(resource_id,version_number,snapshot,change_summary,created_by)
    values(resource.id,next_version,to_jsonb(resource)-'updated_at',change_summary,auth.uid());
  end if;
  update public.pedagogical_resources set status=target_status,reviewed_by=case when target_status in ('approved','published') then auth.uid() else reviewed_by end,approved_by=case when target_status in ('approved','published') then auth.uid() else approved_by end,published_at=case when target_status='published' then now() else published_at end,current_version=case when target_status='published' then next_version else current_version end,updated_at=now() where id=resource.id returning * into resource;
  return resource;
end; $$;

create or replace function public.add_learning_journey_step(target_journey uuid,step_title text,step_instructions text,step_type text,target_position integer,target_resource uuid default null,target_assessment uuid default null,pedagogical_points integer default 0,gamification_points integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys; step_id uuid;
begin
  select * into journey from public.learning_journeys where id=target_journey for update;
  if journey.id is null or journey.status<>'draft' or (journey.created_by<>(select auth.uid()) and not private.has_permission('pedagogy.manage',journey.network_id)) then raise exception 'Not authorized'; end if;
  if (target_resource is null and target_assessment is null) or (target_resource is not null and target_assessment is not null) then raise exception 'Choose one step source'; end if;
  if target_resource is not null and not exists(select 1 from public.pedagogical_resources r where r.id=target_resource and r.network_id=journey.network_id and r.status in ('approved','published')) then raise exception 'Resource unavailable'; end if;
  insert into public.learning_journey_steps(journey_id,resource_id,assessment_id,title,instructions,step_type,position,pedagogical_points,gamification_points)
  values(journey.id,target_resource,target_assessment,trim(step_title),trim(step_instructions),step_type,target_position,pedagogical_points,gamification_points) returning id into step_id;
  return step_id;
end; $$;

create or replace function public.transition_learning_journey(target_journey uuid,target_status text)
returns public.learning_journeys language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys; next_version integer;
begin
  select * into journey from public.learning_journeys where id=target_journey for update;
  if journey.id is null then raise exception 'Journey not found'; end if;
  if target_status='review' and journey.created_by=(select auth.uid()) and journey.status='draft' then null;
  elsif target_status in ('approved','published','archived') and private.has_permission('pedagogy.review',journey.network_id) then null;
  else raise exception 'Not authorized transition'; end if;
  if target_status='published' and not exists(select 1 from public.learning_journey_steps s where s.journey_id=journey.id) then raise exception 'Journey requires steps'; end if;
  next_version:=journey.current_version+1;
  if target_status='published' then
    insert into public.learning_journey_versions(journey_id,version_number,snapshot,created_by)
    select journey.id,next_version,jsonb_build_object('journey',to_jsonb(journey)-'updated_at','steps',coalesce(jsonb_agg(to_jsonb(s) order by s.position),'[]'::jsonb)),auth.uid()
    from public.learning_journey_steps s where s.journey_id=journey.id;
  end if;
  update public.learning_journeys set status=target_status,reviewed_by=case when target_status in ('approved','published') then auth.uid() else reviewed_by end,approved_by=case when target_status in ('approved','published') then auth.uid() else approved_by end,published_at=case when target_status='published' then now() else published_at end,current_version=case when target_status='published' then current_version+1 else current_version end,updated_at=now() where id=journey.id returning * into journey;
  return journey;
end; $$;

create or replace function public.decide_pedagogical_recommendation(target_recommendation uuid,decision text,decision_reason text default null,replacement_journey uuid default null)
returns public.pedagogical_recommendations language plpgsql security definer set search_path='' as $$
declare recommendation public.pedagogical_recommendations;
begin
  select * into recommendation from public.pedagogical_recommendations where id=target_recommendation for update;
  if recommendation.id is null or decision not in ('accepted','rejected','replaced') or not private.can_access_pedagogy_scope(recommendation.network_id,recommendation.school_id,recommendation.classroom_id,recommendation.student_id) or not private.has_permission('pedagogy.assign',recommendation.network_id,recommendation.school_id) then raise exception 'Not authorized'; end if;
  if decision='replaced' and not exists(select 1 from public.learning_journeys j where j.id=replacement_journey and j.network_id=recommendation.network_id and j.status='published') then raise exception 'Replacement unavailable'; end if;
  update public.pedagogical_recommendations set status=decision,journey_id=case when decision='replaced' then replacement_journey else journey_id end,decided_by=auth.uid(),decision_reason=decision_reason,decided_at=now() where id=recommendation.id returning * into recommendation;
  return recommendation;
end; $$;

create or replace function public.request_ai_pedagogical_suggestion(target_network uuid,suggestion_type text,structured_prompt jsonb,generated_content jsonb,provider text default null,model text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare suggestion_id uuid;
begin
  if not private.has_permission('pedagogy.manage',target_network) or jsonb_typeof(structured_prompt)<>'object' or jsonb_typeof(generated_content)<>'object' then raise exception 'Not authorized'; end if;
  insert into public.ai_pedagogical_suggestions(network_id,suggestion_type,structured_prompt,generated_content,provider,model,requested_by)
  values(target_network,suggestion_type,structured_prompt,generated_content,provider,model,auth.uid()) returning id into suggestion_id;
  return suggestion_id;
end; $$;

create or replace function public.create_reading_fluency_activity(target_classroom uuid,target_resource uuid,title text,starts_at timestamptz,due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare classroom public.classrooms; activity_id uuid;
begin
  select * into classroom from public.classrooms where id=target_classroom;
  if classroom.id is null or not private.can_access_pedagogy_scope(classroom.network_id,classroom.school_id,classroom.id,null) or not private.has_permission('fluency.manage',classroom.network_id,classroom.school_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.pedagogical_resources r where r.id=target_resource and r.network_id=classroom.network_id and r.resource_type='text' and r.status='published') then raise exception 'Published reading text required'; end if;
  insert into public.reading_fluency_activities(network_id,school_id,classroom_id,resource_id,title,starts_at,due_at,created_by) values(classroom.network_id,classroom.school_id,classroom.id,target_resource,trim(title),starts_at,due_at,auth.uid()) returning id into activity_id;
  return activity_id;
end; $$;

create or replace function public.create_equity_group(target_network uuid,name text,description text,minimum_group_size integer,target_students uuid[] default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare group_id uuid; valid_count integer;
begin
  if not private.has_permission('equity.read',target_network) then raise exception 'Not authorized'; end if;
  select count(distinct e.student_id) into valid_count from public.student_enrollments e where e.network_id=target_network and e.status='enrolled' and e.student_id=any(target_students);
  if valid_count<>cardinality(target_students) then raise exception 'Student outside network'; end if;
  insert into public.equity_group_definitions(network_id,name,description,minimum_group_size,created_by) values(target_network,trim(name),trim(description),minimum_group_size,auth.uid()) returning id into group_id;
  insert into public.equity_group_members(group_id,student_id,added_by) select group_id,student,auth.uid() from unnest(target_students) student;
  return group_id;
end; $$;

create or replace function public.assign_learning_journey(target_journey uuid,target_classroom uuid,target_students uuid[] default null,assignment_reason text default 'Intervenção pedagógica',source_assessment uuid default null,request_key uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys; classroom public.classrooms; assignment_id uuid; requested_count integer; inserted_count integer;
begin
  select * into journey from public.learning_journeys where id=target_journey and status='published';
  select * into classroom from public.classrooms where id=target_classroom;
  if journey.id is null or classroom.id is null or journey.network_id<>classroom.network_id or not private.can_access_pedagogy_scope(classroom.network_id,classroom.school_id,classroom.id,null) or not private.has_permission('pedagogy.assign',classroom.network_id,classroom.school_id) then raise exception 'Not authorized'; end if;
  select id into assignment_id from public.learning_journey_assignments where assigned_by=auth.uid() and idempotency_key=request_key;
  if assignment_id is not null then return assignment_id; end if;
  if target_students is not null then
    select cardinality(target_students) into requested_count;
    select count(*) into inserted_count from public.student_enrollments e where e.classroom_id=classroom.id and e.status='enrolled' and e.student_id=any(target_students);
    if requested_count=0 or inserted_count<>requested_count then raise exception 'Student outside classroom'; end if;
  end if;
  insert into public.learning_journey_assignments(journey_id,network_id,school_id,classroom_id,target_type,target_student_id,source_assessment_id,source_skill_id,reason,idempotency_key,assigned_by)
  values(journey.id,classroom.network_id,classroom.school_id,classroom.id,case when cardinality(target_students)=1 then 'student' else 'classroom' end,case when cardinality(target_students)=1 then target_students[1] end,source_assessment,journey.skill_id,trim(assignment_reason),request_key,auth.uid()) returning id into assignment_id;
  insert into public.learning_journey_students(assignment_id,student_id)
  select assignment_id,e.student_id from public.student_enrollments e where e.classroom_id=classroom.id and e.status='enrolled' and (target_students is null or e.student_id=any(target_students));
  return assignment_id;
end; $$;

create or replace function public.get_my_learning_journeys()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'journey_id',j.id,'title',j.title,'description',j.description,'skill_id',j.skill_id,'status',recipient.status,'progress_percentage',recipient.progress_percentage,'gamification_points',recipient.gamification_points,'due_at',a.due_at,'steps',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'instructions',s.instructions,'step_type',s.step_type,'position',s.position,'required',s.required,'pedagogical_points',s.pedagogical_points,'gamification_points',s.gamification_points,'status',coalesce(p.status,'not_started'),'response',coalesce(p.response,'{}'::jsonb)) order by s.position),'[]'::jsonb) from public.learning_journey_steps s left join public.learning_journey_step_progress p on p.assignment_id=a.id and p.student_id=recipient.student_id and p.step_id=s.id where s.journey_id=j.id)) order by a.created_at desc),'[]'::jsonb)
  from public.learning_journey_students recipient join public.learning_journey_assignments a on a.id=recipient.assignment_id join public.learning_journeys j on j.id=a.journey_id
  where recipient.student_id=(select auth.uid()) and a.status in ('scheduled','active');
$$;

create or replace function public.save_journey_step_progress(target_assignment uuid,target_step uuid,target_status text,response_payload jsonb default '{}'::jsonb,request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare student uuid:=auth.uid(); journey_id uuid; required_steps integer; completed_steps integer; total_points integer; result jsonb;
begin
  if student is null or target_status not in ('in_progress','completed') or jsonb_typeof(response_payload)<>'object' then raise exception 'Invalid progress'; end if;
  if not exists(select 1 from public.learning_journey_students r where r.assignment_id=target_assignment and r.student_id=student and r.status<>'cancelled') then raise exception 'Not authorized'; end if;
  if exists(select 1 from private.journey_progress_operations o where o.assignment_id=target_assignment and o.student_id=student and o.request_key=request_key) then select jsonb_build_object('assignment_id',target_assignment,'idempotent',true) into result; return result; end if;
  select a.journey_id into journey_id from public.learning_journey_assignments a where a.id=target_assignment;
  if not exists(select 1 from public.learning_journey_steps s where s.id=target_step and s.journey_id=journey_id) then raise exception 'Step outside journey'; end if;
  insert into public.learning_journey_step_progress(assignment_id,student_id,step_id,status,response,started_at,completed_at)
  values(target_assignment,student,target_step,target_status,response_payload,now(),case when target_status='completed' then now() end)
  on conflict(assignment_id,student_id,step_id) do update set status=excluded.status,response=excluded.response,started_at=coalesce(public.learning_journey_step_progress.started_at,now()),completed_at=case when excluded.status='completed' then coalesce(public.learning_journey_step_progress.completed_at,now()) end,updated_at=now();
  insert into private.journey_progress_operations values(target_assignment,student,request_key,now());
  select count(*) filter(where required),count(*) filter(where required and p.status='completed') into required_steps,completed_steps from public.learning_journey_steps s left join public.learning_journey_step_progress p on p.step_id=s.id and p.assignment_id=target_assignment and p.student_id=student where s.journey_id=journey_id;
  select coalesce(sum(s.gamification_points),0) into total_points from public.learning_journey_steps s join public.learning_journey_step_progress p on p.step_id=s.id and p.assignment_id=target_assignment and p.student_id=student and p.status='completed' where s.journey_id=journey_id;
  update public.learning_journey_students set status=case when required_steps>0 and completed_steps=required_steps then 'completed' else 'in_progress' end,progress_percentage=case when required_steps=0 then 0 else round(100.0*completed_steps/required_steps,2) end,gamification_points=total_points,started_at=coalesce(started_at,now()),completed_at=case when required_steps>0 and completed_steps=required_steps then coalesce(completed_at,now()) end,updated_at=now() where assignment_id=target_assignment and student_id=student returning jsonb_build_object('assignment_id',assignment_id,'status',status,'progress_percentage',progress_percentage,'gamification_points',gamification_points,'idempotent',false) into result;
  return result;
end; $$;

create or replace function public.get_pedagogical_dashboard(filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  with scoped as (
    select a.*,r.student_id,r.status student_status,r.progress_percentage,r.gamification_points,j.title,j.skill_id
    from public.learning_journey_assignments a join public.learning_journey_students r on r.assignment_id=a.id join public.learning_journeys j on j.id=a.journey_id
    where private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,r.student_id)
      and (filters->>'network_id' is null or a.network_id=(filters->>'network_id')::uuid)
      and (filters->>'school_id' is null or a.school_id=(filters->>'school_id')::uuid)
      and (filters->>'classroom_id' is null or a.classroom_id=(filters->>'classroom_id')::uuid)
      and (filters->>'student_id' is null or r.student_id=(filters->>'student_id')::uuid)
      and (filters->>'skill_id' is null or j.skill_id=(filters->>'skill_id')::uuid)
  )
  select jsonb_build_object('state',case when count(*)=0 then 'empty' else 'success' end,'summary',jsonb_build_object('students',count(distinct student_id),'assignments',count(*),'in_progress',count(*) filter(where student_status='in_progress'),'completed',count(*) filter(where student_status='completed'),'average_progress',case when count(*)=0 then null else round(avg(progress_percentage),2) end,'gamification_points',coalesce(sum(gamification_points),0)),'students',coalesce(jsonb_agg(jsonb_build_object('assignment_id',id,'student_id',student_id,'journey',title,'skill_id',skill_id,'status',student_status,'progress_percentage',progress_percentage,'gamification_points',gamification_points)),'[]'::jsonb)) into result from scoped;
  return result;
end; $$;

create or replace function public.recommend_learning_journeys(target_classroom uuid,target_skill uuid,observed_percentage numeric,threshold_percentage numeric default 60,target_student uuid default null,target_assessment uuid default null)
returns setof public.pedagogical_recommendations language plpgsql security definer set search_path='' as $$
declare classroom public.classrooms; journey uuid;
begin
  select * into classroom from public.classrooms where id=target_classroom;
  if classroom.id is null or not private.can_access_pedagogy_scope(classroom.network_id,classroom.school_id,classroom.id,target_student) or not private.has_permission('pedagogy.assign',classroom.network_id,classroom.school_id) then raise exception 'Not authorized'; end if;
  if observed_percentage>=threshold_percentage then return; end if;
  select id into journey from public.learning_journeys where network_id=classroom.network_id and skill_id=target_skill and status='published' order by created_at desc limit 1;
  return query insert into public.pedagogical_recommendations(network_id,school_id,classroom_id,student_id,assessment_id,skill_id,journey_id,observed_percentage,threshold_percentage,explanation,created_by) values(classroom.network_id,classroom.school_id,classroom.id,target_student,target_assessment,target_skill,journey,observed_percentage,threshold_percentage,format('Desempenho observado de %s%% abaixo do limiar configurado de %s%%.',observed_percentage,threshold_percentage),auth.uid()) returning *;
end; $$;

create or replace function public.review_ai_pedagogical_suggestion(target_suggestion uuid,decision text,notes text default null)
returns public.ai_pedagogical_suggestions language plpgsql security definer set search_path='' as $$
declare suggestion public.ai_pedagogical_suggestions;
begin
  select * into suggestion from public.ai_pedagogical_suggestions where id=target_suggestion for update;
  if suggestion.id is null or decision not in ('approved','rejected') or not private.has_permission('pedagogy.review',suggestion.network_id) then raise exception 'Not authorized'; end if;
  update public.ai_pedagogical_suggestions set status=decision,reviewed_by=auth.uid(),review_notes=notes,reviewed_at=now() where id=target_suggestion returning * into suggestion;
  return suggestion;
end; $$;

create or replace function public.record_reading_fluency_session(target_activity uuid,target_student uuid,words_read integer,correct_words integer,errors integer default 0,omissions integer default 0,substitutions integer default 0,duration_seconds integer default 60,classification text default null,audio_path text default null,notes text default null)
returns public.reading_fluency_sessions language plpgsql security definer set search_path='' as $$
declare activity public.reading_fluency_activities; session public.reading_fluency_sessions;
begin
  select * into activity from public.reading_fluency_activities where id=target_activity;
  if activity.id is null or not private.can_access_pedagogy_scope(activity.network_id,activity.school_id,activity.classroom_id,target_student) or not private.has_permission('fluency.manage',activity.network_id,activity.school_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.student_enrollments e where e.student_id=target_student and e.classroom_id=activity.classroom_id and e.status='enrolled') then raise exception 'Student outside classroom'; end if;
  if audio_path is not null and audio_path not like activity.network_id::text||'/%' then raise exception 'Invalid audio path'; end if;
  insert into public.reading_fluency_sessions(activity_id,student_id,words_read,correct_words,errors,omissions,substitutions,duration_seconds,classification,audio_path,notes,recorded_by)
  values(target_activity,target_student,words_read,correct_words,errors,omissions,substitutions,duration_seconds,classification,audio_path,notes,auth.uid())
  on conflict(activity_id,student_id) do update set words_read=excluded.words_read,correct_words=excluded.correct_words,errors=excluded.errors,omissions=excluded.omissions,substitutions=excluded.substitutions,duration_seconds=excluded.duration_seconds,classification=excluded.classification,audio_path=excluded.audio_path,notes=excluded.notes,recorded_by=auth.uid(),recorded_at=now() returning * into session;
  return session;
end; $$;

create or replace function public.get_equity_summary(target_network uuid,target_assessment uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when not private.has_permission('equity.read',target_network) then (select jsonb_build_object('state','denied')) else coalesce((
    select jsonb_build_object('state',case when count(*)=0 then 'empty' else 'success' end,'methodology','Evolução observada por grupo configurável; não representa fórmula oficial VAAR.','groups',coalesce(jsonb_agg(jsonb_build_object('group_id',g.id,'name',g.name,'minimum_group_size',g.minimum_group_size,'students',stats.students,'percentage',case when stats.students>=g.minimum_group_size then stats.percentage end,'suppressed',stats.students<g.minimum_group_size)),'[]'::jsonb))
    from public.equity_group_definitions g left join lateral (select count(distinct f.student_id)::integer students,round(avg(f.percentage),2) percentage from private.analytics_attempt_facts f join public.equity_group_members m on m.student_id=f.student_id and m.group_id=g.id where f.network_id=target_network and f.percentage is not null and (target_assessment is null or f.assessment_id=target_assessment)) stats on true where g.network_id=target_network and g.active
  ),jsonb_build_object('state','empty')) end;
$$;

revoke all on function private.can_access_pedagogy_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_access_pedagogy_scope(uuid,uuid,uuid,uuid) to authenticated;
revoke all on function public.create_learning_journey(uuid,text,text,uuid,numeric),public.create_pedagogical_resource(uuid,text,text,text,uuid,integer,text,text),public.transition_pedagogical_resource(uuid,text,text),public.add_learning_journey_step(uuid,text,text,text,integer,uuid,uuid,integer,integer),public.transition_learning_journey(uuid,text),public.assign_learning_journey(uuid,uuid,uuid[],text,uuid,uuid),public.get_my_learning_journeys(),public.save_journey_step_progress(uuid,uuid,text,jsonb,uuid),public.get_pedagogical_dashboard(jsonb),public.recommend_learning_journeys(uuid,uuid,numeric,numeric,uuid,uuid),public.decide_pedagogical_recommendation(uuid,text,text,uuid),public.request_ai_pedagogical_suggestion(uuid,text,jsonb,jsonb,text,text),public.review_ai_pedagogical_suggestion(uuid,text,text),public.create_reading_fluency_activity(uuid,uuid,text,timestamptz,timestamptz),public.record_reading_fluency_session(uuid,uuid,integer,integer,integer,integer,integer,integer,text,text,text),public.create_equity_group(uuid,text,text,integer,uuid[]),public.get_equity_summary(uuid,uuid) from public,anon;
grant execute on function public.create_learning_journey(uuid,text,text,uuid,numeric),public.create_pedagogical_resource(uuid,text,text,text,uuid,integer,text,text),public.transition_pedagogical_resource(uuid,text,text),public.add_learning_journey_step(uuid,text,text,text,integer,uuid,uuid,integer,integer),public.transition_learning_journey(uuid,text),public.assign_learning_journey(uuid,uuid,uuid[],text,uuid,uuid),public.get_my_learning_journeys(),public.save_journey_step_progress(uuid,uuid,text,jsonb,uuid),public.get_pedagogical_dashboard(jsonb),public.recommend_learning_journeys(uuid,uuid,numeric,numeric,uuid,uuid),public.decide_pedagogical_recommendation(uuid,text,text,uuid),public.request_ai_pedagogical_suggestion(uuid,text,jsonb,jsonb,text,text),public.review_ai_pedagogical_suggestion(uuid,text,text),public.create_reading_fluency_activity(uuid,uuid,text,timestamptz,timestamptz),public.record_reading_fluency_session(uuid,uuid,integer,integer,integer,integer,integer,integer,text,text,text),public.create_equity_group(uuid,text,text,integer,uuid[]),public.get_equity_summary(uuid,uuid) to authenticated;

comment on table public.ai_pedagogical_suggestions is 'Registro auditável de sugestões assistivas; nenhuma sugestão é publicada sem revisão humana.';
comment on function public.get_equity_summary(uuid,uuid) is 'Agregação configurável com supressão de grupos pequenos; não implementa nem declara fórmula oficial VAAR.';
