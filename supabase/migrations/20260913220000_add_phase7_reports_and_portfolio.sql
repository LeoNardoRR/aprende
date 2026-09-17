-- Fase 7: busca paginada, portfólio e relatórios pedagógicos.

create or replace function public.search_pedagogical_catalog(
  target_network uuid,
  filters jsonb default '{}'::jsonb,
  page integer default 1,
  page_size integer default 24
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.has_permission('pedagogy.read',target_network)
    or jsonb_typeof(filters)<>'object' or page<1 or page_size not between 1 and 100
  then raise exception 'Not authorized or invalid pagination'; end if;
  with filtered as (
    select j.*,(select count(*)::integer from public.learning_journey_steps s where s.journey_id=j.id) step_count
    from public.learning_journeys j
    where j.network_id=target_network and j.status='published'
      and (filters->>'skill_id' is null or j.skill_id=(filters->>'skill_id')::uuid)
      and (filters->>'subject_id' is null or j.subject_id=(filters->>'subject_id')::uuid)
      and (filters->>'school_year_id' is null or j.curriculum_school_year_id=(filters->>'school_year_id')::uuid)
      and (filters->>'knowledge_object_id' is null or j.knowledge_object_id=(filters->>'knowledge_object_id')::uuid)
      and (filters->>'difficulty' is null or j.difficulty=filters->>'difficulty')
      and (filters->>'max_minutes' is null or j.estimated_minutes<=(filters->>'max_minutes')::integer)
      and (filters->>'query' is null or j.title ilike '%'||replace(filters->>'query','%','')||'%')
  ), paged as (
    select * from filtered order by title,id offset (page-1)*page_size limit page_size
  )
  select jsonb_build_object(
    'page',page,'page_size',page_size,'total',(select count(*) from filtered),
    'journeys',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'description',description,'skill_id',skill_id,
      'subject_id',subject_id,'school_year_id',curriculum_school_year_id,
      'knowledge_object_id',knowledge_object_id,'difficulty',difficulty,
      'estimated_minutes',estimated_minutes,'mastery_threshold',mastery_threshold,
      'step_count',step_count
    ) order by title,id) from paged),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.get_student_pedagogical_portfolio(target_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare student uuid:=coalesce(target_student,auth.uid()); result jsonb;
begin
  if student is null or not (
    student=auth.uid() or exists(
      select 1 from public.student_enrollments e
      where e.student_id=student and e.status='enrolled'
        and private.can_access_pedagogy_scope(e.network_id,e.school_id,e.classroom_id,e.student_id)
    )
  ) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'student_id',student,
    'journeys',coalesce((select jsonb_agg(jsonb_build_object(
      'assignment_id',a.id,'journey',j.title,'skill_id',j.skill_id,'status',r.status,
      'progress_percentage',r.progress_percentage,'pedagogical_score',r.pedagogical_score,
      'gamification_points',r.gamification_points,'started_at',r.started_at,'completed_at',r.completed_at
    ) order by a.created_at desc) from public.learning_journey_students r join public.learning_journey_assignments a on a.id=r.assignment_id join public.learning_journeys j on j.id=a.journey_id where r.student_id=student),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'assignment_id',e.assignment_id,'step_id',e.step_id,'type',e.evidence_type,'content',e.content,'created_at',e.created_at) order by e.created_at desc) from public.pedagogical_evidence e where e.student_id=student),'[]'::jsonb),
    'assessments',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',f.attempt_id,'assessment',f.assessment_title,'percentage',f.percentage,'status',f.status,'performed_at',f.submitted_at) order by f.submitted_at desc) from private.analytics_attempt_facts f where f.student_id=student and private.analytics_can_access_attempt(f.attempt_id)),'[]'::jsonb),
    'fluency',coalesce((select jsonb_agg(jsonb_build_object('activity',a.title,'correct_words_per_minute',s.correct_words_per_minute,'classification',s.classification,'recorded_at',s.recorded_at) order by s.recorded_at desc) from public.reading_fluency_sessions s join public.reading_fluency_activities a on a.id=s.activity_id where s.student_id=student),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.get_pedagogical_report_data(filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or jsonb_typeof(filters)<>'object' then raise exception 'Not authorized'; end if;
  with scoped as (
    select a.id assignment_id,a.network_id,a.school_id,a.classroom_id,a.source_assessment_id,a.created_at,
      r.student_id,r.status,r.progress_percentage,r.pedagogical_score,r.gamification_points,r.started_at,r.completed_at,
      j.id journey_id,j.title journey,j.skill_id,s.code skill_code,s.description skill_description
    from public.learning_journey_assignments a
    join public.learning_journey_students r on r.assignment_id=a.id
    join public.learning_journeys j on j.id=a.journey_id
    left join public.curriculum_skills s on s.id=j.skill_id
    where private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,r.student_id)
      and (filters->>'network_id' is null or a.network_id=(filters->>'network_id')::uuid)
      and (filters->>'school_id' is null or a.school_id=(filters->>'school_id')::uuid)
      and (filters->>'classroom_id' is null or a.classroom_id=(filters->>'classroom_id')::uuid)
      and (filters->>'student_id' is null or r.student_id=(filters->>'student_id')::uuid)
      and (filters->>'skill_id' is null or j.skill_id=(filters->>'skill_id')::uuid)
  ), skill_summary as (
    select skill_id,skill_code,skill_description,count(distinct student_id)::integer students,
      count(*)::integer assignments,round(avg(progress_percentage),2) average_progress,
      count(*) filter(where status='completed')::integer completed
    from scoped group by skill_id,skill_code,skill_description
  ), observed as (
    select recommendation.id recommendation_id,recommendation.student_id,recommendation.skill_id,
      recommendation.observed_percentage before_percentage,
      round(100*avg((item.is_correct)::integer) filter(where item.is_correct is not null and attempt.attempt_id is not null),2) after_percentage
    from public.pedagogical_recommendations recommendation
    join scoped on scoped.student_id=recommendation.student_id and scoped.skill_id=recommendation.skill_id
      and scoped.network_id=recommendation.network_id and scoped.classroom_id=recommendation.classroom_id
    left join private.analytics_item_facts item on item.student_id=recommendation.student_id
      and item.network_id=recommendation.network_id and item.skill_id=recommendation.skill_id::text
    left join private.analytics_attempt_facts attempt on attempt.attempt_id=item.attempt_id
      and attempt.network_id=recommendation.network_id and attempt.submitted_at>=recommendation.created_at
    group by recommendation.id,recommendation.student_id,recommendation.skill_id,recommendation.observed_percentage
  )
  select jsonb_build_object(
    'generated_at',now(),'methodology','Evolução observada antes/depois; não demonstra causalidade.',
    'filters',filters,
    'summary',jsonb_build_object(
      'students',count(distinct student_id),'assignments',count(*),
      'in_progress',count(*) filter(where status='in_progress'),
      'completed',count(*) filter(where status='completed'),
      'average_progress',case when count(*)=0 then null else round(avg(progress_percentage),2) end,
      'pedagogical_score',round(avg(pedagogical_score),2),
      'gamification_points',coalesce(sum(gamification_points),0)
    ),
    'assignments',coalesce(jsonb_agg(jsonb_build_object(
      'assignment_id',assignment_id,'student_id',student_id,'journey',journey,'skill_code',skill_code,
      'status',status,'progress_percentage',progress_percentage,'pedagogical_score',pedagogical_score,
      'gamification_points',gamification_points,'started_at',started_at,'completed_at',completed_at
    ) order by created_at desc),'[]'::jsonb),
    'skills',coalesce((select jsonb_agg(to_jsonb(skill_summary) order by skill_code) from skill_summary),'[]'::jsonb),
    'evolution',coalesce((select jsonb_agg(jsonb_build_object(
      'recommendation_id',recommendation_id,'student_id',student_id,'skill_id',skill_id,
      'before_percentage',before_percentage,'after_percentage',after_percentage,
      'absolute_difference',case when after_percentage is null or before_percentage is null then null else after_percentage-before_percentage end,
      'interpretation','Evolução observada; não demonstra causalidade.'
    )) from observed),'[]'::jsonb)
  ) into result from scoped;
  return result;
end; $$;

revoke all on function public.search_pedagogical_catalog(uuid,jsonb,integer,integer),public.get_student_pedagogical_portfolio(uuid),public.get_pedagogical_report_data(jsonb) from public,anon;
grant execute on function public.search_pedagogical_catalog(uuid,jsonb,integer,integer),public.get_student_pedagogical_portfolio(uuid),public.get_pedagogical_report_data(jsonb) to authenticated;
