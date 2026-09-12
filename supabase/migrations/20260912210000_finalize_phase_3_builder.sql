-- Aprendê - fechamento da Fase 3.
-- Completa o construtor de cadernos, o mapa curricular e a leitura de alunos
-- programados sem antecipar tentativas/respostas da Fase 4.

create or replace function public.list_assessment_item_candidates(
  target_assessment uuid,
  search_query text default '',
  page_size integer default 100
)
returns table (
  item_id uuid,
  internal_title text,
  statement text,
  item_type text,
  difficulty text,
  skill_code text,
  skill_description text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assessment public.diagnostic_assessments%rowtype;
begin
  select * into assessment
  from public.diagnostic_assessments
  where id = target_assessment;

  if assessment.id is null or not private.can_read_diagnostic_assessment(assessment.id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    item.id,
    item.internal_title,
    item.statement,
    item.item_type,
    item.difficulty,
    skill.code,
    skill.description
  from public.assessment_items item
  join public.curriculum_skills skill on skill.id = item.skill_id
  where item.network_id = assessment.network_id
    and item.curriculum_id = assessment.curriculum_id
    and item.subject_id = assessment.subject_id
    and item.curriculum_school_year_id = assessment.curriculum_school_year_id
    and item.status = 'approved'
    and exists (
      select 1
      from public.assessment_item_versions version
      where version.item_id = item.id
    )
    and (
      coalesce(trim(search_query), '') = ''
      or to_tsvector('portuguese', item.internal_title || ' ' || item.statement || ' ' || skill.code || ' ' || skill.description)
        @@ plainto_tsquery('portuguese', trim(search_query))
    )
  order by skill.code, item.internal_title, item.id
  limit least(greatest(page_size, 1), 100);
end;
$$;

create or replace function public.list_assessment_booklet_items(target_booklet uuid)
returns table (
  link_id uuid,
  item_id uuid,
  position integer,
  points numeric,
  internal_title text,
  statement text,
  item_type text,
  difficulty text,
  skill_code text,
  version_number integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  booklet public.assessment_booklets%rowtype;
begin
  select * into booklet
  from public.assessment_booklets
  where id = target_booklet;

  if booklet.id is null or not private.can_read_diagnostic_assessment(booklet.assessment_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    link.id,
    item.id,
    link.position,
    link.points,
    item.internal_title,
    item.statement,
    item.item_type,
    item.difficulty,
    skill.code,
    version.version_number
  from public.assessment_booklet_items link
  join public.assessment_items item on item.id = link.assessment_item_id
  join public.assessment_item_versions version on version.id = link.assessment_item_version_id
  join public.curriculum_skills skill on skill.id = item.skill_id
  where link.booklet_id = booklet.id
  order by link.position, link.id;
end;
$$;

create or replace function private.recompute_assessment_total(target_assessment uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.diagnostic_assessments
  set total_points = coalesce((
    select max(booklet_total)
    from (
      select sum(link.points) as booklet_total
      from public.assessment_booklet_items link
      where link.assessment_id = target_assessment
      group by link.booklet_id
    ) totals
  ), 0),
  updated_at = now()
  where id = target_assessment;
$$;

create or replace function public.reorder_assessment_booklet_items(
  target_booklet uuid,
  ordered_links uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  booklet public.assessment_booklets%rowtype;
  assessment public.diagnostic_assessments%rowtype;
  expected_count integer;
  unique_count integer;
  offset_value integer;
  item_index integer;
begin
  select * into booklet
  from public.assessment_booklets
  where id = target_booklet
  for update;

  if booklet.id is null then
    raise exception 'Booklet not found';
  end if;

  select * into assessment
  from public.diagnostic_assessments
  where id = booklet.assessment_id
  for update;

  if assessment.id is null or assessment.status <> 'draft' or not private.can_manage_diagnostic_assessment(assessment.id) then
    raise exception 'Not authorized';
  end if;

  select count(*) into expected_count
  from public.assessment_booklet_items
  where booklet_id = booklet.id;

  select count(distinct candidate.link_id) into unique_count
  from unnest(coalesce(ordered_links, array[]::uuid[])) as candidate(link_id);

  if coalesce(array_length(ordered_links, 1), 0) <> expected_count
    or unique_count <> expected_count
    or exists (
      select 1
      from unnest(coalesce(ordered_links, array[]::uuid[])) as candidate(link_id)
      where not exists (
        select 1
        from public.assessment_booklet_items link
        where link.id = candidate.link_id and link.booklet_id = booklet.id
      )
    )
  then
    raise exception 'Ordered links must contain every booklet item exactly once';
  end if;

  if expected_count = 0 then
    return;
  end if;

  select coalesce(max(position), 0) + expected_count + 1000 into offset_value
  from public.assessment_booklet_items
  where booklet_id = booklet.id;

  update public.assessment_booklet_items
  set position = position + offset_value
  where booklet_id = booklet.id;

  for item_index in 1..expected_count loop
    update public.assessment_booklet_items
    set position = item_index
    where id = ordered_links[item_index]
      and booklet_id = booklet.id;
  end loop;
end;
$$;

create or replace function public.remove_assessment_booklet_item(target_link uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.assessment_booklet_items%rowtype;
  booklet public.assessment_booklets%rowtype;
  assessment public.diagnostic_assessments%rowtype;
  offset_value integer;
  current_link uuid;
  item_index integer := 0;
begin
  select * into link
  from public.assessment_booklet_items
  where id = target_link
  for update;

  if link.id is null then
    raise exception 'Booklet item not found';
  end if;

  select * into booklet
  from public.assessment_booklets
  where id = link.booklet_id
  for update;

  select * into assessment
  from public.diagnostic_assessments
  where id = booklet.assessment_id
  for update;

  if assessment.id is null or assessment.status <> 'draft' or not private.can_manage_diagnostic_assessment(assessment.id) then
    raise exception 'Not authorized';
  end if;

  delete from public.assessment_booklet_items
  where id = link.id;

  select coalesce(max(position), 0) + 1000 into offset_value
  from public.assessment_booklet_items
  where booklet_id = booklet.id;

  update public.assessment_booklet_items
  set position = position + offset_value
  where booklet_id = booklet.id;

  for current_link in
    select id
    from public.assessment_booklet_items
    where booklet_id = booklet.id
    order by position, id
  loop
    item_index := item_index + 1;
    update public.assessment_booklet_items
    set position = item_index
    where id = current_link;
  end loop;

  perform private.recompute_assessment_total(assessment.id);
end;
$$;

create or replace function public.list_scheduled_assessment_students(
  target_network uuid,
  target_assessment uuid default null
)
returns table (
  schedule_id uuid,
  assessment_id uuid,
  assessment_title text,
  school_id uuid,
  school_name text,
  classroom_id uuid,
  classroom_name text,
  student_id uuid,
  student_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  schedule_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('assessment.apply', target_network) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    schedule.id,
    assessment.id,
    assessment.title,
    school.id,
    school.name,
    classroom.id,
    classroom.name,
    enrollment.student_id,
    profile.display_name,
    schedule.starts_at,
    schedule.ends_at,
    schedule.status
  from public.assessment_schedules schedule
  join public.diagnostic_assessments assessment on assessment.id = schedule.assessment_id
  join public.schools school on school.id = schedule.school_id
  join public.assessment_classrooms assessment_classroom on assessment_classroom.schedule_id = schedule.id
  join public.classrooms classroom on classroom.id = assessment_classroom.classroom_id
  left join public.student_enrollments enrollment
    on enrollment.classroom_id = classroom.id
    and enrollment.network_id = schedule.network_id
    and enrollment.school_id = schedule.school_id
    and enrollment.status = 'enrolled'
  left join public.profiles profile on profile.id = enrollment.student_id
  where schedule.network_id = target_network
    and (target_assessment is null or schedule.assessment_id = target_assessment)
    and private.has_permission('assessment.apply', schedule.network_id, schedule.school_id)
  order by schedule.starts_at, school.name, classroom.name, profile.display_name nulls last;
end;
$$;

-- O mapa da prova deve representar a blueprint da avaliação e não multiplicar
-- a mesma questão quando ela aparece em cadernos diferentes apenas reordenada.
create or replace function public.assessment_curriculum_map(target_assessment uuid)
returns table(
  skill_code text,
  thematic_unit text,
  knowledge_object text,
  difficulty text,
  item_count bigint,
  points numeric,
  percentage numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with distinct_items as (
    select
      link.assessment_item_id,
      max(link.points) as points
    from public.assessment_booklet_items link
    where link.assessment_id = target_assessment
    group by link.assessment_item_id
  )
  select
    skill.code,
    unit.name,
    object.name,
    item.difficulty,
    count(*) as item_count,
    sum(distinct_item.points) as points,
    round(
      sum(distinct_item.points) * 100
      / nullif(sum(sum(distinct_item.points)) over (), 0),
      2
    ) as percentage
  from distinct_items distinct_item
  join public.assessment_items item on item.id = distinct_item.assessment_item_id
  join public.curriculum_skills skill on skill.id = item.skill_id
  left join public.curriculum_thematic_units unit on unit.id = item.thematic_unit_id
  left join public.curriculum_knowledge_objects object on object.id = item.knowledge_object_id
  where private.can_read_diagnostic_assessment(target_assessment)
  group by skill.code, unit.name, object.name, item.difficulty;
$$;

revoke all on function private.recompute_assessment_total(uuid) from public, anon, authenticated;

revoke all on function public.list_assessment_item_candidates(uuid,text,integer) from public, anon;
revoke all on function public.list_assessment_booklet_items(uuid) from public, anon;
revoke all on function public.reorder_assessment_booklet_items(uuid,uuid[]) from public, anon;
revoke all on function public.remove_assessment_booklet_item(uuid) from public, anon;
revoke all on function public.list_scheduled_assessment_students(uuid,uuid) from public, anon;
revoke all on function public.assessment_curriculum_map(uuid) from public, anon;

grant execute on function public.list_assessment_item_candidates(uuid,text,integer) to authenticated;
grant execute on function public.list_assessment_booklet_items(uuid) to authenticated;
grant execute on function public.reorder_assessment_booklet_items(uuid,uuid[]) to authenticated;
grant execute on function public.remove_assessment_booklet_item(uuid) to authenticated;
grant execute on function public.list_scheduled_assessment_students(uuid,uuid) to authenticated;
grant execute on function public.assessment_curriculum_map(uuid) to authenticated;
