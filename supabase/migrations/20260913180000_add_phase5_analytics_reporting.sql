-- Aprendê - Fase 5: analytics, psychometrics, proficiency and report jobs.
-- Additive only. All analytical reads remain behind scoped SECURITY DEFINER RPCs.

insert into private.permissions(key, description) values
  ('analytics.read', 'Consultar indicadores educacionais no escopo autorizado'),
  ('analytics.manage', 'Configurar escalas e consolidações analíticas'),
  ('report.generate', 'Gerar relatórios educacionais no escopo autorizado')
on conflict (key) do nothing;

insert into private.role_permissions(role, permission_key) values
  ('network_admin','analytics.read'), ('network_admin','analytics.manage'), ('network_admin','report.generate'),
  ('manager','analytics.read'), ('manager','analytics.manage'), ('manager','report.generate'),
  ('teacher','analytics.read'), ('teacher','report.generate')
on conflict do nothing;

alter table public.assessment_attempt_items
  add column is_annulled boolean not null default false,
  add column annulment_reason text check (annulment_reason is null or char_length(annulment_reason) <= 2000),
  add column annulled_at timestamptz,
  add column annulled_by uuid references public.profiles(id) on delete set null,
  add column time_spent_seconds integer not null default 0 check (time_spent_seconds between 0 and 21600);

create index assessment_attempts_analytics_scope_idx
  on public.assessment_attempts(network_id, school_id, assessment_id, classroom_id, status, submitted_at desc);
create index assessment_attempts_analytics_student_idx
  on public.assessment_attempts(student_id, assessment_id, status, submitted_at desc);
create index assessment_attempt_items_analytics_skill_idx
  on public.assessment_attempt_items((snapshot ->> 'skill_id'), attempt_id)
  where not is_annulled;
create index assessment_responses_analytics_idx
  on public.assessment_responses(attempt_id, is_correct, review_status);

create table public.proficiency_scales (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  assessment_id uuid references public.diagnostic_assessments(id) on delete restrict,
  subject_id uuid references public.curriculum_subjects(id) on delete restrict,
  curriculum_school_year_id uuid references public.curriculum_school_years(id) on delete restrict,
  cycle_id uuid references public.assessment_cycles(id) on delete restrict,
  name text not null check (char_length(name) between 3 and 160),
  version integer not null check (version > 0),
  effective_from date not null,
  effective_to date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique(network_id, name, version)
);

create table public.proficiency_levels (
  id uuid primary key default gen_random_uuid(),
  scale_id uuid not null references public.proficiency_scales(id) on delete cascade,
  code text not null check (char_length(code) between 2 and 40),
  label text not null check (char_length(label) between 2 and 100),
  lower_bound numeric(7,3) not null,
  upper_bound numeric(7,3) not null,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  check (lower_bound >= 0 and upper_bound <= 100 and upper_bound > lower_bound),
  unique(scale_id, code), unique(scale_id, sort_order)
);

create table public.assessment_proficiency_scales (
  assessment_id uuid primary key references public.diagnostic_assessments(id) on delete restrict,
  scale_id uuid not null references public.proficiency_scales(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now()
);

create table public.analytics_report_jobs (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  report_type text not null check (report_type in ('student','classroom','school','network','student_batch')),
  format text not null check (format in ('pdf','docx','csv','zip')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  idempotency_key uuid not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  output_path text,
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(requested_by, idempotency_key),
  foreign key (school_id, network_id) references public.schools(id, network_id)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('analytics-reports','analytics-reports',false,104857600,array['application/zip','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create index proficiency_scales_scope_idx on public.proficiency_scales(network_id, subject_id, curriculum_school_year_id, cycle_id, effective_from desc);
create index proficiency_levels_scale_idx on public.proficiency_levels(scale_id, sort_order);
create index analytics_report_jobs_queue_idx on public.analytics_report_jobs(status, created_at) where status in ('queued','processing');
create index analytics_report_jobs_requester_idx on public.analytics_report_jobs(requested_by, created_at desc);

alter table public.proficiency_scales enable row level security;
alter table public.proficiency_levels enable row level security;
alter table public.assessment_proficiency_scales enable row level security;
alter table public.analytics_report_jobs enable row level security;

create or replace function private.analytics_can_access_scope(
  target_network uuid,
  target_school uuid,
  target_classroom uuid default null,
  target_student uuid default null
) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    (target_student is not null and target_student = (select auth.uid()))
    or exists (
      select 1 from public.institutional_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.network_id = target_network
        and membership.status = 'active'
        and (
          membership.role = 'network_admin'
          or (membership.role = 'manager' and membership.school_id = target_school)
        )
    )
    or (
      target_classroom is not null
      and exists (
        select 1 from public.classrooms classroom
        where classroom.id = target_classroom
          and classroom.owner_id = (select auth.uid())
          and classroom.network_id = target_network
          and classroom.school_id = target_school
      )
    )
  );
$$;

create or replace function private.analytics_can_access_attempt(target_attempt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_attempts attempt
    where attempt.id = target_attempt
      and private.analytics_can_access_scope(attempt.network_id, attempt.school_id, attempt.classroom_id, attempt.student_id)
  );
$$;

create or replace view private.analytics_attempt_facts as
select
  attempt.id as attempt_id, attempt.schedule_id,
  attempt.network_id, attempt.school_id, attempt.classroom_id, attempt.student_id,
  attempt.assessment_id, assessment.cycle_id, assessment.subject_id, assessment.curriculum_school_year_id,
  profile.display_name as student_name, school.name as school_name, classroom.name as classroom_name,
  assessment.title as assessment_title, subject.name as subject_name,
  attempt.status, attempt.submission_kind, attempt.started_at, attempt.submitted_at,
  coalesce(extract(epoch from (coalesce(attempt.submitted_at, attempt.closed_at, attempt.last_activity_at) - attempt.started_at)), 0)::bigint as total_time_seconds,
  count(item.id) filter (where not item.is_annulled)::integer as total_questions,
  count(response.id) filter (where not item.is_annulled and response.answer <> '{}'::jsonb)::integer as answered_questions,
  count(item.id) filter (where not item.is_annulled and (response.id is null or response.answer = '{}'::jsonb))::integer as unanswered_questions,
  count(response.id) filter (where not item.is_annulled and response.is_correct is true)::integer as correct_answers,
  count(response.id) filter (where not item.is_annulled and response.is_correct is false)::integer as incorrect_answers,
  coalesce(sum(response.points_awarded) filter (where not item.is_annulled), 0)::numeric(12,3) as score,
  coalesce(sum(item.max_points) filter (where not item.is_annulled), 0)::numeric(12,3) as max_score,
  bool_or(response.review_status = 'pending') as has_pending_review,
  case when attempt.status in ('graded','submitted','auto_submitted')
         and not coalesce(bool_or(response.review_status = 'pending'), false)
         and coalesce(sum(item.max_points) filter (where not item.is_annulled), 0) > 0
    then round(100 * coalesce(sum(response.points_awarded) filter (where not item.is_annulled), 0)
      / sum(item.max_points) filter (where not item.is_annulled), 4)
    else null end as percentage
from public.assessment_attempts attempt
join public.diagnostic_assessments assessment on assessment.id = attempt.assessment_id
join public.profiles profile on profile.id = attempt.student_id
join public.schools school on school.id = attempt.school_id
join public.classrooms classroom on classroom.id = attempt.classroom_id
join public.curriculum_subjects subject on subject.id = assessment.subject_id
left join public.assessment_attempt_items item on item.attempt_id = attempt.id
left join public.assessment_responses response on response.attempt_item_id = item.id
where attempt.status not in ('cancelled','invalidated')
group by attempt.id, assessment.id, profile.id, school.id, classroom.id, subject.id;

create or replace view private.analytics_item_facts as
select
  item.id as attempt_item_id, item.attempt_id, attempt.network_id, attempt.school_id,
  attempt.classroom_id, attempt.student_id, attempt.assessment_id,
  assessment.cycle_id, assessment.subject_id, assessment.curriculum_school_year_id,
  nullif(item.snapshot ->> 'id','') as item_id,
  nullif(item.snapshot ->> 'skill_id','') as skill_id,
  nullif(item.snapshot ->> 'thematic_unit_id','') as thematic_unit_id,
  nullif(item.snapshot ->> 'knowledge_object_id','') as knowledge_object_id,
  item.snapshot ->> 'item_type' as item_type,
  item.snapshot ->> 'statement' as statement,
  item.snapshot -> 'options' as options,
  item.is_annulled,
  response.id as response_id, response.answer, response.is_correct, response.points_awarded,
  response.review_status, item.time_spent_seconds,
  fact.percentage as attempt_percentage,
  attempt.status as attempt_status
from public.assessment_attempt_items item
join public.assessment_attempts attempt on attempt.id = item.attempt_id
join public.diagnostic_assessments assessment on assessment.id = attempt.assessment_id
join private.analytics_attempt_facts fact on fact.attempt_id = attempt.id
left join public.assessment_responses response on response.attempt_item_id = item.id
where attempt.status not in ('cancelled','invalidated');

create or replace function private.analytics_filters_match(
  fact private.analytics_attempt_facts,
  filters jsonb
) returns boolean language sql immutable set search_path = '' as $$
  select (filters ->> 'network_id' is null or fact.network_id = (filters ->> 'network_id')::uuid)
    and (filters ->> 'school_id' is null or fact.school_id = (filters ->> 'school_id')::uuid)
    and (filters ->> 'classroom_id' is null or fact.classroom_id = (filters ->> 'classroom_id')::uuid)
    and (filters ->> 'student_id' is null or fact.student_id = (filters ->> 'student_id')::uuid)
    and (filters ->> 'assessment_id' is null or fact.assessment_id = (filters ->> 'assessment_id')::uuid)
    and (filters ->> 'cycle_id' is null or fact.cycle_id = (filters ->> 'cycle_id')::uuid)
    and (filters ->> 'subject_id' is null or fact.subject_id = (filters ->> 'subject_id')::uuid)
    and (filters ->> 'curriculum_school_year_id' is null or fact.curriculum_school_year_id = (filters ->> 'curriculum_school_year_id')::uuid);
$$;

create or replace function public.get_analytics_dashboard(filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if jsonb_typeof(filters) <> 'object' then raise exception 'Invalid analytics filters'; end if;

  with eligible as (
    select distinct schedule.id as schedule_id, enrollment.student_id
    from public.assessment_schedules schedule
    join public.assessment_classrooms scheduled_classroom on scheduled_classroom.schedule_id=schedule.id
    join public.classrooms classroom on classroom.id=scheduled_classroom.classroom_id
    join public.student_enrollments enrollment on enrollment.classroom_id=classroom.id
      and enrollment.network_id=schedule.network_id and enrollment.school_id=schedule.school_id
      and enrollment.status='enrolled'
    join public.diagnostic_assessments assessment on assessment.id=schedule.assessment_id
    where schedule.status<>'cancelled'
      and private.analytics_can_access_scope(schedule.network_id,schedule.school_id,classroom.id,enrollment.student_id)
      and (filters->>'network_id' is null or schedule.network_id=(filters->>'network_id')::uuid)
      and (filters->>'school_id' is null or schedule.school_id=(filters->>'school_id')::uuid)
      and (filters->>'classroom_id' is null or classroom.id=(filters->>'classroom_id')::uuid)
      and (filters->>'student_id' is null or enrollment.student_id=(filters->>'student_id')::uuid)
      and (filters->>'assessment_id' is null or assessment.id=(filters->>'assessment_id')::uuid)
      and (filters->>'cycle_id' is null or assessment.cycle_id=(filters->>'cycle_id')::uuid)
      and (filters->>'subject_id' is null or assessment.subject_id=(filters->>'subject_id')::uuid)
      and (filters->>'curriculum_school_year_id' is null or assessment.curriculum_school_year_id=(filters->>'curriculum_school_year_id')::uuid)
      and (filters->>'skill_id' is null or exists (
        select 1 from public.assessment_booklet_items booklet_item
        join public.assessment_item_versions version on version.id=booklet_item.assessment_item_version_id
        where booklet_item.assessment_id=assessment.id and version.snapshot->>'skill_id'=filters->>'skill_id'
      ))
  ), scoped as (
    select fact.* from private.analytics_attempt_facts fact
    where private.analytics_can_access_attempt(fact.attempt_id)
      and private.analytics_filters_match(fact, filters)
      and (filters ->> 'skill_id' is null or exists (
        select 1 from private.analytics_item_facts filtered_item
        where filtered_item.attempt_id=fact.attempt_id and filtered_item.skill_id=filters->>'skill_id'
      ))
  ), definitive as (
    select * from scoped where percentage is not null
  ), proficiency as (
    select d.attempt_id, level.code, level.label, level.sort_order
    from definitive d
    join public.assessment_proficiency_scales assignment on assignment.assessment_id = d.assessment_id
    join public.proficiency_levels level on level.scale_id = assignment.scale_id
      and d.percentage >= level.lower_bound
      and (d.percentage < level.upper_bound or (level.upper_bound = 100 and d.percentage <= 100))
  ), proficiency_catalog as (
    select distinct level.code,level.label,level.sort_order
    from scoped
    join public.assessment_proficiency_scales assignment on assignment.assessment_id=scoped.assessment_id
    join public.proficiency_levels level on level.scale_id=assignment.scale_id
  ), skill_rows as (
    select item.skill_id, skill.code, skill.description,
      count(distinct item.attempt_id)::integer as students_evaluated,
      count(*) filter (where not item.is_annulled)::integer as item_count,
      count(item.response_id) filter (where not item.is_annulled and item.answer <> '{}'::jsonb)::integer as answered,
      count(*) filter (where not item.is_annulled and item.is_correct is true)::integer as correct,
      count(*) filter (where not item.is_annulled and item.is_correct is false)::integer as incorrect
    from private.analytics_item_facts item
    join scoped s on s.attempt_id = item.attempt_id
    left join public.curriculum_skills skill on skill.id::text = item.skill_id
    where item.skill_id is not null
    group by item.skill_id, skill.code, skill.description
  ), curriculum_rows as (
    select dimension.kind,dimension.entity_id,dimension.label,
      count(distinct item.attempt_id)::integer students_evaluated,
      count(*) filter(where not item.is_annulled)::integer item_count,
      count(item.response_id) filter(where not item.is_annulled and item.answer<>'{}'::jsonb)::integer answered,
      count(*) filter(where not item.is_annulled and item.is_correct is true)::integer correct,
      count(*) filter(where not item.is_annulled and item.is_correct is false)::integer incorrect
    from private.analytics_item_facts item
    join scoped on scoped.attempt_id=item.attempt_id
    left join public.curriculum_subjects subject on subject.id=item.subject_id
    left join public.curriculum_thematic_units thematic_unit on thematic_unit.id::text=item.thematic_unit_id
    left join public.curriculum_knowledge_objects knowledge_object on knowledge_object.id::text=item.knowledge_object_id
    left join public.curriculum_skills skill on skill.id::text=item.skill_id
    cross join lateral (values
      ('component',item.subject_id::text,subject.name),
      ('thematic_unit',item.thematic_unit_id,thematic_unit.name),
      ('knowledge_object',item.knowledge_object_id,knowledge_object.name),
      ('skill',item.skill_id,coalesce(skill.code||' · ','')||skill.description)
    ) dimension(kind,entity_id,label)
    where dimension.entity_id is not null
    group by dimension.kind,dimension.entity_id,dimension.label
  ), ranked_items as (
    select item.*, percent_rank() over(partition by item.assessment_id order by item.attempt_percentage) as performance_rank
    from private.analytics_item_facts item join scoped s on s.attempt_id=item.attempt_id
    where item.attempt_percentage is not null and item.is_correct is not null and item.student_id<>(select auth.uid())
  ), item_rows as (
    select item.item_id, item.statement, item.item_type,
      count(item.response_id) filter (where item.answer <> '{}'::jsonb)::integer as responses,
      count(*) filter (where item.is_correct is true)::integer as correct,
      count(*) filter (where item.is_correct is false)::integer as incorrect,
      count(*) filter (where item.response_id is null or item.answer = '{}'::jsonb)::integer as omissions,
      round(avg(item.time_spent_seconds),2) as average_time_seconds,
      case when count(item.response_id) filter (where item.answer <> '{}'::jsonb) >= 3
        then round(avg((item.is_correct)::integer),4) else null end as difficulty_index,
      case when count(item.response_id) filter (where item.answer <> '{}'::jsonb) >= 4
        then round(
          avg((item.is_correct)::integer) filter (where item.performance_rank >= 0.73)
          - avg((item.is_correct)::integer) filter (where item.performance_rank <= 0.27), 4)
        else null end as discrimination_index,
      case when count(item.response_id) filter (where item.answer <> '{}'::jsonb) >= 3
        and variance((item.is_correct)::integer) > 0 and variance(item.attempt_percentage) > 0
        then round(corr((item.is_correct)::integer, item.attempt_percentage)::numeric,4) else null end as point_biserial
    from ranked_items item
    where not item.is_annulled and item.item_type in ('multiple_choice','true_false')
    group by item.item_id, item.statement, item.item_type
  ), evolution_rows as (
    select definitive.assessment_id, definitive.assessment_title, min(definitive.submitted_at) as performed_at,
      round(avg(definitive.percentage),2) as percentage, count(*)::integer as observations,
      coalesce(assignment.scale_id::text,definitive.subject_id::text||':'||definitive.curriculum_school_year_id::text) as methodology_key,
      case when count(distinct definitive.student_id)=1 then max(proficiency.label) end as proficiency_label
    from definitive
    left join public.assessment_proficiency_scales assignment on assignment.assessment_id=definitive.assessment_id
    left join proficiency on proficiency.attempt_id=definitive.attempt_id
    group by definitive.assessment_id,definitive.assessment_title,definitive.subject_id,definitive.curriculum_school_year_id,assignment.scale_id
  ), evolution_with_change as (
    select evolution_rows.*,
      lag(percentage) over(partition by methodology_key order by performed_at,assessment_id) as previous_percentage,
      round(percentage-lag(percentage) over(partition by methodology_key order by performed_at,assessment_id),2) as absolute_difference,
      case when lag(percentage) over(partition by methodology_key order by performed_at,assessment_id) not in (0)
        then round(100*(percentage-lag(percentage) over(partition by methodology_key order by performed_at,assessment_id))/lag(percentage) over(partition by methodology_key order by performed_at,assessment_id),2) end as percentage_difference,
      lag(proficiency_label) over(partition by methodology_key order by performed_at,assessment_id) as previous_proficiency
    from evolution_rows
  ), stats as (
    select count(*)::integer n, round(avg(percentage),4) mean,
      round(percentile_cont(0.5) within group(order by percentage)::numeric,4) median,
      round(min(percentage),4) minimum, round(max(percentage),4) maximum,
      round(stddev_pop(percentage),4) standard_deviation,
      round(var_pop(percentage),4) variance
    from definitive
  )
  select jsonb_build_object(
    'state', case when (select count(*) from scoped) = 0 then 'empty'
                  when (select count(*) from definitive) < 2 then 'insufficient_data' else 'success' end,
    'methodology', jsonb_build_object('finalStatuses', jsonb_build_array('graded','submitted','auto_submitted'), 'pendingReviewIsProvisional', true, 'cancelledAndInvalidatedExcluded', true),
    'summary', (select jsonb_build_object(
      'attempts', count(*), 'students', count(distinct student_id),
      'eligible_students', (select count(*) from eligible),
      'completed', count(*) filter (where status in ('graded','submitted','auto_submitted','pending_review')),
      'pending_review', count(*) filter (where status = 'pending_review'),
      'questions', coalesce(sum(total_questions),0), 'answered', coalesce(sum(answered_questions),0),
      'unanswered', coalesce(sum(unanswered_questions),0), 'correct', coalesce(sum(correct_answers),0),
      'incorrect', coalesce(sum(incorrect_answers),0), 'score', coalesce(sum(score),0),
      'max_score', coalesce(sum(max_score),0),
      'participation_percentage', case when (select count(*) from eligible) > 0 then round(100.0 * count(distinct (schedule_id,student_id)) filter (where status in ('graded','submitted','auto_submitted','pending_review')) / (select count(*) from eligible),2) else null end,
      'average_time_seconds', round(avg(nullif(total_time_seconds,0)),2)
    ) from scoped),
    'statistics', (select to_jsonb(stats) from stats),
    'proficiency', coalesce((select jsonb_agg(row_data order by sort_order) from (
      select catalog.code,catalog.label,catalog.sort_order,count(proficiency.attempt_id)::integer count,
        case when (select count(*) from proficiency)>0 then round(100.0*count(proficiency.attempt_id)/(select count(*) from proficiency),2) end percentage
      from proficiency_catalog catalog left join proficiency using(code,label,sort_order)
      group by catalog.code,catalog.label,catalog.sort_order
    ) row_data), '[]'::jsonb),
    'skills', coalesce((select jsonb_agg(jsonb_build_object(
      'skill_id',skill_id,'code',code,'description',description,'students_evaluated',students_evaluated,
      'item_count',item_count,'answered',answered,'correct',correct,'incorrect',incorrect,
      'percentage',case when answered > 0 then round(100.0*correct/answered,2) else null end
    ) order by code) from skill_rows), '[]'::jsonb),
    'curriculum', coalesce((select jsonb_agg(jsonb_build_object(
      'dimension',kind,'id',entity_id,'label',label,'students_evaluated',students_evaluated,
      'item_count',item_count,'answered',answered,'correct',correct,'incorrect',incorrect,
      'percentage',case when answered>0 then round(100.0*correct/answered,2) else null end
    ) order by kind,label) from curriculum_rows), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(to_jsonb(student_row) order by student_name, attempt_id) from (
      select attempt_id,student_id,student_name,school_id,school_name,classroom_id,classroom_name,
        assessment_id,assessment_title,status,submitted_at,total_questions,answered_questions,correct_answers,
        incorrect_answers,score,max_score,percentage,total_time_seconds,has_pending_review
      from scoped order by student_name,attempt_id
      limit least(greatest(coalesce((filters->>'page_size')::integer,50),1),200)
      offset greatest(coalesce((filters->>'page')::integer,1)-1,0) * least(greatest(coalesce((filters->>'page_size')::integer,50),1),200)
    ) student_row), '[]'::jsonb),
    'comparison', jsonb_build_object(
      'compatible',(select count(distinct methodology_key)<=1 from evolution_rows),
      'methodology_groups',(select count(distinct methodology_key) from evolution_rows),
      'message',case when (select count(distinct methodology_key) from evolution_rows)>1 then 'Avaliações com escalas ou componentes incompatíveis foram separadas; refine os filtros para comparar.' else null end
    ),
    'evolution', coalesce((select jsonb_agg(to_jsonb(evolution_with_change) order by performed_at,assessment_id) from evolution_with_change
      where (select count(distinct methodology_key) from evolution_rows)<=1), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(item_rows) order by statement,item_id) from item_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_item_option_distribution(target_assessment uuid, filters jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  with scoped as (
    select item.*
    from private.analytics_item_facts item
    join private.analytics_attempt_facts fact on fact.attempt_id = item.attempt_id
    where item.assessment_id = target_assessment and not item.is_annulled
      and private.analytics_can_access_attempt(item.attempt_id)
      and item.student_id<>(select auth.uid())
      and private.analytics_filters_match(fact, filters)
      and item.item_type in ('multiple_choice','true_false')
  ), expanded as (
    select scoped.item_id, scoped.statement,
      option ->> 'id' option_id, option ->> 'label' label, option ->> 'content' content,
      count(*) filter (where scoped.answer ->> 'option_id' = option ->> 'id')::integer selected,
      count(scoped.response_id) filter (where scoped.answer <> '{}'::jsonb)::integer answered
    from scoped cross join lateral jsonb_array_elements(coalesce(scoped.options,'[]'::jsonb)) option
    group by scoped.item_id, scoped.statement, option
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'item_id',item_id,'statement',statement,'option_id',option_id,'label',label,'content',content,
      'selected',selected,'percentage',case when answered > 0 then round(100.0*selected/answered,2) else null end
    ) order by statement,label), '[]'::jsonb) from expanded;
$$;

create or replace function public.get_assessment_reliability(target_assessment uuid, filters jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  with scoped as (
    select item.* from private.analytics_item_facts item
    join private.analytics_attempt_facts fact on fact.attempt_id=item.attempt_id
    where item.assessment_id=target_assessment and not item.is_annulled
      and item.item_type in ('multiple_choice','true_false') and item.is_correct is not null
      and item.student_id<>(select auth.uid())
      and fact.percentage is not null and private.analytics_can_access_attempt(item.attempt_id)
      and private.analytics_filters_match(fact, filters)
  ), participant as (
    select attempt_id, count(*) item_count, sum((is_correct)::integer) total_score
    from scoped group by attempt_id
  ), dimensions as (
    select count(distinct item_id)::integer k, count(distinct attempt_id)::integer n from scoped
  ), item_variances as (
    select item_id, var_pop((is_correct)::integer) item_variance from scoped group by item_id
  ), totals as (select var_pop(total_score) total_variance from participant)
  select jsonb_build_object('items',dimensions.k,'participants',dimensions.n,
    'cronbach_alpha',case when dimensions.k >= 2 and dimensions.n >= 3 and totals.total_variance > 0
      then round((dimensions.k::numeric/(dimensions.k-1))*(1-coalesce((select sum(item_variance) from item_variances),0)/totals.total_variance),4)
      else null end,
    'available', dimensions.k >= 2 and dimensions.n >= 3 and totals.total_variance > 0)
  from dimensions cross join totals;
$$;

create or replace function public.create_proficiency_scale(
  target_network uuid, scale_name text, scale_version integer, effective_from date,
  levels jsonb, target_assessment uuid default null, target_subject uuid default null,
  target_school_year uuid default null, target_cycle uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_scale_id uuid; level_count integer; overlap_count integer; minimum_bound numeric; maximum_bound numeric; gap_count integer;
begin
  if not private.has_permission('analytics.manage', target_network) then raise exception 'Not authorized'; end if;
  if jsonb_typeof(levels) <> 'array' or jsonb_array_length(levels) < 4 then raise exception 'At least four proficiency levels are required'; end if;
  insert into public.proficiency_scales(network_id,assessment_id,subject_id,curriculum_school_year_id,cycle_id,name,version,effective_from,created_by)
  values(target_network,target_assessment,target_subject,target_school_year,target_cycle,trim(scale_name),scale_version,effective_from,auth.uid()) returning id into new_scale_id;
  insert into public.proficiency_levels(scale_id,code,label,lower_bound,upper_bound,sort_order)
  select new_scale_id, value->>'code', value->>'label', (value->>'lower_bound')::numeric, (value->>'upper_bound')::numeric, ordinality::integer
  from jsonb_array_elements(levels) with ordinality;
  select count(*) into level_count from public.proficiency_levels where proficiency_levels.scale_id=new_scale_id;
  select count(*) into overlap_count from public.proficiency_levels a join public.proficiency_levels b
    on a.scale_id=b.scale_id and a.id<b.id and numrange(a.lower_bound,a.upper_bound,'[)') && numrange(b.lower_bound,b.upper_bound,'[)')
    where a.scale_id=new_scale_id;
  select min(lower_bound),max(upper_bound) into minimum_bound,maximum_bound from public.proficiency_levels where scale_id=new_scale_id;
  select count(*) into gap_count from (
    select upper_bound,lead(lower_bound) over(order by sort_order) next_lower
    from public.proficiency_levels where scale_id=new_scale_id
  ) ordered where next_lower is not null and upper_bound<>next_lower;
  if level_count < 4 or overlap_count > 0 or minimum_bound<>0 or maximum_bound<>100 or gap_count>0
    or not (select array_agg(code order by code) @> array['advanced','adequate','basic','below_basic']::text[] from public.proficiency_levels where scale_id=new_scale_id)
  then raise exception 'Proficiency levels must include four required levels and cover 0 through 100 without gaps'; end if;
  return new_scale_id;
end;
$$;

create or replace function public.assign_assessment_proficiency_scale(target_assessment uuid, target_scale uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare assessment public.diagnostic_assessments%rowtype; scale public.proficiency_scales%rowtype;
begin
  select * into assessment from public.diagnostic_assessments where id=target_assessment;
  select * into scale from public.proficiency_scales where id=target_scale;
  if assessment.id is null or scale.id is null or assessment.network_id<>scale.network_id
    or not private.has_permission('analytics.manage',assessment.network_id) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.assessment_proficiency_scales where assessment_id=target_assessment)
    and exists(select 1 from public.assessment_attempts where assessment_id=target_assessment and status in ('submitted','auto_submitted','pending_review','graded'))
  then raise exception 'Historical proficiency assignment is immutable'; end if;
  insert into public.assessment_proficiency_scales(assessment_id,scale_id,assigned_by)
  values(target_assessment,target_scale,auth.uid())
  on conflict(assessment_id) do update set scale_id=excluded.scale_id,assigned_by=excluded.assigned_by,assigned_at=now();
end;
$$;

create or replace function public.set_assessment_item_annulled(target_attempt_item uuid, annulled boolean, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare attempt_id uuid;
begin
  select item.attempt_id into attempt_id from public.assessment_attempt_items item where item.id=target_attempt_item;
  if attempt_id is null or not private.analytics_can_access_attempt(attempt_id) or auth.uid()=(select student_id from public.assessment_attempts where id=attempt_id)
  then raise exception 'Not authorized'; end if;
  if annulled and nullif(trim(reason),'') is null then raise exception 'Annulment reason is required'; end if;
  update public.assessment_attempt_items set is_annulled=annulled,annulment_reason=case when annulled then trim(reason) else null end,
    annulled_at=case when annulled then now() else null end,annulled_by=case when annulled then auth.uid() else null end
  where id=target_attempt_item;
end;
$$;

create or replace function public.record_assessment_item_time(target_attempt uuid,target_attempt_item uuid,elapsed_seconds integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  if elapsed_seconds not between 0 and 3600 or not private.student_owns_active_attempt(target_attempt)
    or not exists(select 1 from public.assessment_attempts where id=target_attempt and status='in_progress' and deadline_at>now())
  then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.assessment_attempt_items where id=target_attempt_item and attempt_id=target_attempt) then raise exception 'Item unavailable'; end if;
  update public.assessment_attempt_items set time_spent_seconds=least(time_spent_seconds+elapsed_seconds,21600)
    where attempt_id=target_attempt and id=target_attempt_item returning time_spent_seconds into total;
  return total;
end;
$$;

create or replace function public.get_analytics_report_data(report_type text, filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare payload jsonb;
begin
  if report_type not in ('student','classroom','school','network') then raise exception 'Invalid report type'; end if;
  payload := public.get_analytics_dashboard(filters);
  return jsonb_build_object('report_type',report_type,'generated_at',now(),'filters',filters,'data',payload,
    'methodology_version','phase5-v1','provisional',coalesce((payload->'summary'->>'pending_review')::integer,0)>0);
end;
$$;

create or replace function public.request_analytics_report(
  report_type text, report_format text, filters jsonb, request_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare network uuid; school uuid; classroom uuid; job_id uuid; existing public.analytics_report_jobs%rowtype;
begin
  network := nullif(filters->>'network_id','')::uuid; school := nullif(filters->>'school_id','')::uuid; classroom := nullif(filters->>'classroom_id','')::uuid;
  if report_type not in ('student','classroom','school','network','student_batch') or report_format not in ('pdf','docx','csv','zip')
    or network is null or not private.analytics_can_access_scope(network,school,classroom,null) then raise exception 'Not authorized'; end if;
  select job.* into existing from public.analytics_report_jobs job
  where job.requested_by=auth.uid() and job.idempotency_key=request_key;
  if existing.id is not null then
    if existing.report_type<>report_type or existing.format<>report_format or existing.filters<>filters then raise exception 'Idempotency key conflict'; end if;
    return existing.id;
  end if;
  insert into public.analytics_report_jobs(network_id,school_id,classroom_id,report_type,format,filters,idempotency_key,requested_by)
  values(network,school,classroom,report_type,report_format,filters,request_key,auth.uid())
  returning id into job_id;
  return job_id;
end;
$$;

create or replace function public.list_analytics_report_jobs()
returns setof public.analytics_report_jobs language sql stable security definer set search_path = '' as $$
  select job.* from public.analytics_report_jobs job where job.requested_by=(select auth.uid()) order by job.created_at desc limit 100;
$$;

create or replace function public.retry_analytics_report_job(target_job uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.analytics_report_jobs set status='queued',progress=0,error_message=null,started_at=null,completed_at=null,updated_at=now()
  where id=target_job and requested_by=auth.uid() and status='failed';
  if not found then raise exception 'Report job cannot be retried'; end if;
end;
$$;

revoke all on function private.analytics_can_access_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.analytics_can_access_attempt(uuid) from public,anon,authenticated;
revoke all on function private.analytics_filters_match(private.analytics_attempt_facts,jsonb) from public,anon,authenticated;
grant execute on function private.analytics_can_access_scope(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function private.analytics_can_access_attempt(uuid) to authenticated;

revoke all on public.proficiency_scales,public.proficiency_levels,public.assessment_proficiency_scales,public.analytics_report_jobs from public,anon,authenticated;
grant select on public.proficiency_scales,public.proficiency_levels,public.assessment_proficiency_scales,public.analytics_report_jobs to authenticated;

revoke all on function public.get_analytics_dashboard(jsonb) from public,anon;
revoke all on function public.get_item_option_distribution(uuid,jsonb) from public,anon;
revoke all on function public.get_assessment_reliability(uuid,jsonb) from public,anon;
revoke all on function public.create_proficiency_scale(uuid,text,integer,date,jsonb,uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.assign_assessment_proficiency_scale(uuid,uuid) from public,anon;
revoke all on function public.set_assessment_item_annulled(uuid,boolean,text) from public,anon;
revoke all on function public.record_assessment_item_time(uuid,uuid,integer) from public,anon;
revoke all on function public.get_analytics_report_data(text,jsonb) from public,anon;
revoke all on function public.request_analytics_report(text,text,jsonb,uuid) from public,anon;
revoke all on function public.list_analytics_report_jobs() from public,anon;
revoke all on function public.retry_analytics_report_job(uuid) from public,anon;

grant execute on function public.get_analytics_dashboard(jsonb),public.get_item_option_distribution(uuid,jsonb),
  public.get_assessment_reliability(uuid,jsonb),public.create_proficiency_scale(uuid,text,integer,date,jsonb,uuid,uuid,uuid,uuid),
  public.assign_assessment_proficiency_scale(uuid,uuid),public.set_assessment_item_annulled(uuid,boolean,text),
  public.record_assessment_item_time(uuid,uuid,integer),public.get_analytics_report_data(text,jsonb),
  public.request_analytics_report(text,text,jsonb,uuid),public.list_analytics_report_jobs(),
  public.retry_analytics_report_job(uuid) to authenticated;

comment on view private.analytics_attempt_facts is 'Derived attempt-level Phase 5 facts. Pending essays keep percentage null; cancelled and invalidated attempts are excluded.';
comment on function public.get_assessment_reliability(uuid,jsonb) is 'Cronbach alpha uses population variances, at least two objective items and three participants; zero total variance returns null.';
comment on table public.assessment_proficiency_scales is 'Pins an assessment to a versioned scale so historical classifications never drift.';
comment on table public.analytics_report_jobs is 'Idempotent asynchronous report queue. A server-side worker produces private artifacts and updates progress.';
comment on column public.assessment_attempt_items.time_spent_seconds is 'Accumulated server-validated active time for the item; unavailable offline intervals are not guessed.';
