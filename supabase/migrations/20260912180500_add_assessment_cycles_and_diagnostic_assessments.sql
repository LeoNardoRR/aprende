-- Aprendê - Fase 3: ciclos e avaliações diagnósticas.
-- Domínio separado de assignments para preservar tarefas e provas simples.

create table public.assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 180),
  description text check (description is null or char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','closed','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (network_id, name)
);

create table public.diagnostic_assessments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  network_id uuid not null references public.networks(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete restrict,
  subject_id uuid not null,
  curriculum_school_year_id uuid not null,
  title text not null check (char_length(title) between 3 and 200),
  description text check (description is null or char_length(description) <= 5000),
  instructions text not null check (char_length(instructions) between 5 and 10000),
  total_points numeric(10,2) not null default 0 check (total_points >= 0),
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','active','closed','archived')),
  randomize_questions boolean not null default false,
  randomize_options boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, curriculum_id) references public.curriculum_subjects(id, curriculum_id),
  foreign key (curriculum_school_year_id, curriculum_id) references public.curriculum_school_years(id, curriculum_id),
  check (ends_at is null or starts_at is not null),
  check (ends_at is null or ends_at > starts_at),
  unique (cycle_id, title),
  unique (id, network_id)
);

create index assessment_cycles_scope_idx on public.assessment_cycles(network_id, status, starts_at);
create index diagnostic_assessments_scope_idx on public.diagnostic_assessments(network_id, status, starts_at);
create index diagnostic_assessments_cycle_idx on public.diagnostic_assessments(cycle_id, status);
create index diagnostic_assessments_curriculum_idx on public.diagnostic_assessments(curriculum_id, subject_id, curriculum_school_year_id);

create or replace function private.can_read_diagnostic_assessment(target_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.diagnostic_assessments assessment
    where assessment.id = target_assessment
      and private.has_permission('assessment.create', assessment.network_id)
  );
$$;

create or replace function private.can_manage_diagnostic_assessment(target_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.diagnostic_assessments assessment
    where assessment.id = target_assessment
      and (
        assessment.created_by = (select auth.uid())
        or private.has_permission('assessment.apply', assessment.network_id)
      )
  );
$$;

create or replace function private.audit_assessment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(network_id, actor_id, entity_type, entity_id, action, metadata)
  values (new.network_id, auth.uid(), tg_table_name, new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    jsonb_build_object('status', new.status));
  return new;
end;
$$;

create trigger assessment_cycles_audit after insert or update on public.assessment_cycles
for each row execute function private.audit_assessment_change();
create trigger diagnostic_assessments_audit after insert or update on public.diagnostic_assessments
for each row execute function private.audit_assessment_change();

alter table public.assessment_cycles enable row level security;
alter table public.diagnostic_assessments enable row level security;

create policy assessment_cycles_read on public.assessment_cycles for select to authenticated
using (private.has_permission('assessment.create', network_id) or private.has_permission('assessment.apply', network_id));
create policy assessment_cycles_create on public.assessment_cycles for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_permission('assessment.apply', network_id));
create policy assessment_cycles_change on public.assessment_cycles for update to authenticated
using (private.has_permission('assessment.apply', network_id))
with check (private.has_permission('assessment.apply', network_id));

create policy diagnostic_assessments_read on public.diagnostic_assessments for select to authenticated
using (private.can_read_diagnostic_assessment(id) or private.has_permission('assessment.apply', network_id));
create policy diagnostic_assessments_create on public.diagnostic_assessments for insert to authenticated
with check (
  created_by = (select auth.uid()) and private.has_permission('assessment.create', network_id)
  and exists (select 1 from public.assessment_cycles cycle where cycle.id = cycle_id and cycle.network_id = network_id)
  and exists (select 1 from public.curricula curriculum where curriculum.id = curriculum_id and curriculum.active and (curriculum.network_id is null or curriculum.network_id = network_id))
);
create policy diagnostic_assessments_change on public.diagnostic_assessments for update to authenticated
using (private.can_manage_diagnostic_assessment(id) and status = 'draft')
with check (private.can_manage_diagnostic_assessment(id) and status = 'draft');

grant select, insert on public.assessment_cycles, public.diagnostic_assessments to authenticated;
grant update (name, description, starts_at, ends_at, updated_at) on public.assessment_cycles to authenticated;
grant update (title, description, instructions, duration_minutes, starts_at, ends_at, randomize_questions, randomize_options, updated_at) on public.diagnostic_assessments to authenticated;

revoke all on function private.can_read_diagnostic_assessment(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_diagnostic_assessment(uuid) from public, anon, authenticated;
revoke all on function private.audit_assessment_change() from public, anon, authenticated;
