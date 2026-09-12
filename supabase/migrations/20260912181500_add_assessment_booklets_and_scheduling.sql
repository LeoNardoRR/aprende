-- Aprendê - Fase 3: cadernos imutáveis, mapa curricular e agendamento institucional.

create table public.assessment_booklets (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.diagnostic_assessments(id) on delete cascade,
  network_id uuid not null references public.networks(id) on delete cascade,
  code text not null check (code in ('A','B','C','D','E')),
  title text not null check (char_length(title) between 1 and 100),
  generation_strategy text not null default 'manual' check (generation_strategy in ('manual','same_items_shuffled','skill_alternating','difficulty_balanced')),
  generation_seed text check (generation_seed is null or char_length(generation_seed) between 1 and 200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assessment_id, network_id) references public.diagnostic_assessments(id, network_id),
  unique (assessment_id, code),
  unique (id, assessment_id)
);

create table public.assessment_booklet_items (
  id uuid primary key default gen_random_uuid(),
  booklet_id uuid not null,
  assessment_id uuid not null references public.diagnostic_assessments(id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items(id) on delete restrict,
  assessment_item_version_id uuid not null references public.assessment_item_versions(id) on delete restrict,
  position integer not null check (position > 0),
  points numeric(10,2) not null default 10 check (points > 0),
  grouping_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (booklet_id, assessment_id) references public.assessment_booklets(id, assessment_id) on delete cascade,
  unique (booklet_id, position),
  unique (booklet_id, assessment_item_id)
);

create table public.assessment_schedules (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null,
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','active','closed','cancelled')),
  token_required boolean not null default true,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assessment_id, network_id) references public.diagnostic_assessments(id, network_id),
  foreign key (school_id, network_id) references public.schools(id, network_id),
  check (ends_at > starts_at),
  unique (id, assessment_id)
);

create table public.assessment_classrooms (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.assessment_schedules(id) on delete cascade,
  assessment_id uuid not null references public.diagnostic_assessments(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  booklet_assignment_strategy text not null default 'balanced' check (booklet_assignment_strategy in ('balanced','single')),
  created_at timestamptz not null default now(),
  foreign key (schedule_id, assessment_id) references public.assessment_schedules(id, assessment_id),
  unique (schedule_id, classroom_id)
);

create index assessment_booklets_assessment_idx on public.assessment_booklets(assessment_id, code);
create index assessment_booklet_items_map_idx on public.assessment_booklet_items(assessment_id, booklet_id, position);
create index assessment_schedules_scope_idx on public.assessment_schedules(network_id, school_id, status, starts_at, ends_at);
create index assessment_classrooms_classroom_idx on public.assessment_classrooms(classroom_id, assessment_id);

create or replace function public.create_assessment_booklet(
  target_assessment uuid, booklet_title text default null, strategy text default 'manual', deterministic_seed text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare assessment public.diagnostic_assessments%rowtype; next_code text; new_id uuid;
begin
  select * into assessment from public.diagnostic_assessments where id = target_assessment for update;
  if assessment.id is null or assessment.status <> 'draft' or not private.can_manage_diagnostic_assessment(assessment.id) then raise exception 'Not authorized'; end if;
  if strategy not in ('manual','same_items_shuffled','skill_alternating','difficulty_balanced') then raise exception 'Invalid generation strategy'; end if;
  select candidate.code into next_code from unnest(array['A','B','C','D','E']) as candidate(code)
  where not exists (select 1 from public.assessment_booklets b where b.assessment_id = target_assessment and b.code = candidate.code)
  order by candidate.code limit 1;
  if next_code is null then raise exception 'An assessment supports at most five booklets'; end if;
  insert into public.assessment_booklets(assessment_id, network_id, code, title, generation_strategy, generation_seed, created_by)
  values (assessment.id, assessment.network_id, next_code, coalesce(nullif(trim(booklet_title),''), 'Caderno ' || next_code), strategy, nullif(deterministic_seed,''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.add_approved_item_to_booklet(
  target_booklet uuid, target_item uuid, target_position integer, item_points numeric default 10
) returns uuid language plpgsql security definer set search_path = '' as $$
declare booklet public.assessment_booklets%rowtype; item public.assessment_items%rowtype; version_id uuid; link_id uuid;
begin
  select * into booklet from public.assessment_booklets where id = target_booklet for update;
  if booklet.id is null or not private.can_manage_diagnostic_assessment(booklet.assessment_id) then raise exception 'Not authorized'; end if;
  select * into item from public.assessment_items where id = target_item and status = 'approved';
  if item.id is null then raise exception 'Only approved items are eligible'; end if;
  if item.network_id <> booklet.network_id then raise exception 'Item is outside assessment scope'; end if;
  select id into version_id from public.assessment_item_versions where item_id = item.id order by version_number desc limit 1;
  if version_id is null then raise exception 'Approved item has no immutable version'; end if;
  insert into public.assessment_booklet_items(booklet_id, assessment_id, assessment_item_id, assessment_item_version_id, position, points)
  values (booklet.id, booklet.assessment_id, item.id, version_id, target_position, item_points) returning id into link_id;
  update public.diagnostic_assessments set total_points = (
    select coalesce(max(total),0) from (select sum(points) total from public.assessment_booklet_items where assessment_id = booklet.assessment_id group by booklet_id) totals
  ), updated_at = now() where id = booklet.assessment_id;
  return link_id;
end;
$$;

create or replace function public.duplicate_assessment_booklet(target_booklet uuid, deterministic_seed text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source public.assessment_booklets%rowtype; new_booklet uuid;
begin
  select * into source from public.assessment_booklets where id = target_booklet;
  if source.id is null then raise exception 'Booklet not found'; end if;
  new_booklet := public.create_assessment_booklet(source.assessment_id, null, 'same_items_shuffled', coalesce(deterministic_seed, source.generation_seed, source.id::text));
  insert into public.assessment_booklet_items(booklet_id, assessment_id, assessment_item_id, assessment_item_version_id, position, points, grouping_metadata)
  select new_booklet, assessment_id, assessment_item_id, assessment_item_version_id,
    row_number() over (order by md5(coalesce(deterministic_seed, source.generation_seed, source.id::text) || assessment_item_id::text)),
    points, grouping_metadata from public.assessment_booklet_items where booklet_id = source.id;
  return new_booklet;
end;
$$;

create or replace function private.validate_diagnostic_assessment(target_assessment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare assessment public.diagnostic_assessments%rowtype; booklet_count integer; empty_count integer; invalid_count integer;
begin
  select * into assessment from public.diagnostic_assessments where id = target_assessment;
  if assessment.id is null then raise exception 'Assessment not found'; end if;
  if assessment.curriculum_id is null or assessment.subject_id is null or assessment.curriculum_school_year_id is null then raise exception 'Curriculum, subject and grade are required'; end if;
  if assessment.duration_minutes not between 1 and 600 then raise exception 'Invalid duration'; end if;
  select count(*) into booklet_count from public.assessment_booklets where assessment_id = target_assessment;
  if booklet_count = 0 then raise exception 'Assessment requires at least one booklet'; end if;
  if booklet_count > 5 then raise exception 'Assessment supports at most five booklets'; end if;
  select count(*) into empty_count from public.assessment_booklets b where b.assessment_id = target_assessment
    and not exists (select 1 from public.assessment_booklet_items bi where bi.booklet_id = b.id);
  if empty_count > 0 then raise exception 'Every booklet requires at least one item'; end if;
  select count(*) into invalid_count from public.assessment_booklet_items bi
    join public.assessment_items i on i.id = bi.assessment_item_id
    left join public.assessment_item_versions v on v.id = bi.assessment_item_version_id and v.item_id = i.id
    where bi.assessment_id = target_assessment and (i.status <> 'approved' or v.id is null);
  if invalid_count > 0 then raise exception 'Assessment contains an ineligible item or version'; end if;
end;
$$;

create or replace function public.transition_diagnostic_assessment(target_assessment uuid, target_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare assessment public.diagnostic_assessments%rowtype; next_status text;
begin
  select * into assessment from public.diagnostic_assessments where id = target_assessment for update;
  if assessment.id is null or not private.can_manage_diagnostic_assessment(assessment.id) then raise exception 'Not authorized'; end if;
  if target_action = 'ready' and assessment.status = 'draft' then perform private.validate_diagnostic_assessment(assessment.id); next_status := 'ready';
  elsif target_action = 'archive' and assessment.status in ('draft','ready','closed') then next_status := 'archived';
  elsif target_action = 'close' and assessment.status in ('scheduled','active') then next_status := 'closed';
  else raise exception 'Invalid assessment transition'; end if;
  update public.diagnostic_assessments set status = next_status, updated_at = now() where id = assessment.id;
end;
$$;

create or replace function public.schedule_diagnostic_assessment(
  target_assessment uuid, target_school uuid, target_classrooms uuid[], window_starts_at timestamptz, window_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare assessment public.diagnostic_assessments%rowtype; schedule_id uuid; target_classroom uuid;
begin
  select * into assessment from public.diagnostic_assessments where id = target_assessment for update;
  if assessment.id is null or assessment.status not in ('ready','scheduled') or not private.has_permission('assessment.apply', assessment.network_id, target_school) then raise exception 'Not authorized'; end if;
  if window_ends_at <= window_starts_at then raise exception 'Invalid application window'; end if;
  if coalesce(array_length(target_classrooms,1),0) = 0 then raise exception 'Select at least one classroom'; end if;
  foreach target_classroom in array target_classrooms loop
    if not exists (select 1 from public.classrooms c where c.id = target_classroom and c.network_id = assessment.network_id and c.school_id = target_school and c.classroom_status = 'active') then
      raise exception 'Classroom is outside schedule scope';
    end if;
  end loop;
  insert into public.assessment_schedules(assessment_id, network_id, school_id, starts_at, ends_at, assigned_by)
  values (assessment.id, assessment.network_id, target_school, window_starts_at, window_ends_at, auth.uid()) returning id into schedule_id;
  insert into public.assessment_classrooms(schedule_id, assessment_id, classroom_id)
  select schedule_id, assessment.id, candidate.classroom_id from unnest(target_classrooms) as candidate(classroom_id);
  update public.diagnostic_assessments set status = 'scheduled', starts_at = window_starts_at, ends_at = window_ends_at, updated_at = now() where id = assessment.id;
  return schedule_id;
end;
$$;

create or replace function public.assessment_curriculum_map(target_assessment uuid)
returns table(skill_code text, thematic_unit text, knowledge_object text, difficulty text, item_count bigint, points numeric, percentage numeric)
language sql stable security definer set search_path = '' as $$
  select skill.code, unit.name, object.name, item.difficulty, count(*), sum(link.points),
    round(sum(link.points) * 100 / nullif(sum(sum(link.points)) over (),0), 2)
  from public.assessment_booklet_items link
  join public.assessment_items item on item.id = link.assessment_item_id
  join public.curriculum_skills skill on skill.id = item.skill_id
  left join public.curriculum_thematic_units unit on unit.id = item.thematic_unit_id
  left join public.curriculum_knowledge_objects object on object.id = item.knowledge_object_id
  where link.assessment_id = target_assessment and private.can_read_diagnostic_assessment(target_assessment)
  group by skill.code, unit.name, object.name, item.difficulty;
$$;

alter table public.assessment_booklets enable row level security;
alter table public.assessment_booklet_items enable row level security;
alter table public.assessment_schedules enable row level security;
alter table public.assessment_classrooms enable row level security;

create policy assessment_booklets_read on public.assessment_booklets for select to authenticated using (private.can_read_diagnostic_assessment(assessment_id));
create policy assessment_booklet_items_read on public.assessment_booklet_items for select to authenticated using (private.can_read_diagnostic_assessment(assessment_id));
create policy assessment_schedules_read on public.assessment_schedules for select to authenticated using (private.has_permission('assessment.apply', network_id, school_id));
create policy assessment_classrooms_read on public.assessment_classrooms for select to authenticated using (private.can_read_diagnostic_assessment(assessment_id));

grant select on public.assessment_booklets, public.assessment_booklet_items, public.assessment_schedules, public.assessment_classrooms to authenticated;
grant execute on function public.create_assessment_booklet(uuid,text,text,text) to authenticated;
grant execute on function public.add_approved_item_to_booklet(uuid,uuid,integer,numeric) to authenticated;
grant execute on function public.duplicate_assessment_booklet(uuid,text) to authenticated;
grant execute on function public.transition_diagnostic_assessment(uuid,text) to authenticated;
grant execute on function public.schedule_diagnostic_assessment(uuid,uuid,uuid[],timestamptz,timestamptz) to authenticated;
grant execute on function public.assessment_curriculum_map(uuid) to authenticated;

revoke all on function private.validate_diagnostic_assessment(uuid) from public, anon, authenticated;
revoke all on function public.create_assessment_booklet(uuid,text,text,text) from public, anon;
revoke all on function public.add_approved_item_to_booklet(uuid,uuid,integer,numeric) from public, anon;
revoke all on function public.duplicate_assessment_booklet(uuid,text) from public, anon;
revoke all on function public.transition_diagnostic_assessment(uuid,text) from public, anon;
revoke all on function public.schedule_diagnostic_assessment(uuid,uuid,uuid[],timestamptz,timestamptz) from public, anon;
revoke all on function public.assessment_curriculum_map(uuid) from public, anon;
