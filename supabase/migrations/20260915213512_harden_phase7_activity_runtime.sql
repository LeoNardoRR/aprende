-- Fase 7: congela a jornada atribuída e valida a execução no servidor.

alter table public.learning_journey_assignments
  add column journey_version_id uuid references public.learning_journey_versions(id) on delete restrict;

update public.learning_journey_assignments assignment
set journey_version_id = version.id
from public.learning_journeys journey
join public.learning_journey_versions version
  on version.journey_id = journey.id and version.version_number = journey.current_version
where assignment.journey_id = journey.id and assignment.journey_version_id is null;

alter table public.learning_journey_assignments alter column journey_version_id set not null;
create index journey_assignments_version_idx on public.learning_journey_assignments(journey_version_id);

create table private.journey_step_validation (
  step_id uuid primary key references public.learning_journey_steps(id) on delete cascade,
  response_type text not null check (response_type in ('acknowledgement','single_choice','short_text','teacher_review','assessment')),
  prompt text not null check (char_length(prompt) between 3 and 2000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options)='array'),
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key)='object'),
  max_score numeric(10,2) not null default 0 check (max_score >= 0),
  created_at timestamptz not null default now()
);

alter table private.journey_step_validation enable row level security;
revoke all on table private.journey_step_validation from public, anon, authenticated;

create or replace function public.configure_journey_step_validation(
  target_step uuid,
  response_type text,
  prompt text,
  options jsonb default '[]'::jsonb,
  answer_key jsonb default '{}'::jsonb,
  max_score numeric default 0
) returns void language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys;
begin
  select j.* into journey
  from public.learning_journey_steps step
  join public.learning_journeys j on j.id=step.journey_id
  where step.id=target_step for update of j;
  if journey.id is null or journey.status<>'draft'
    or (journey.created_by<>auth.uid() and not private.has_permission('pedagogy.manage',journey.network_id))
    or response_type not in ('acknowledgement','single_choice','short_text','teacher_review','assessment')
    or jsonb_typeof(options)<>'array' or jsonb_typeof(answer_key)<>'object'
  then raise exception 'Not authorized or invalid validation'; end if;
  if response_type='single_choice' and (
    jsonb_array_length(options)<2 or answer_key->>'choice' is null
    or not options ? (answer_key->>'choice')
  ) then raise exception 'Invalid choice validation'; end if;
  insert into private.journey_step_validation(step_id,response_type,prompt,options,answer_key,max_score)
  values(target_step,response_type,trim(prompt),options,answer_key,max_score)
  on conflict(step_id) do update set response_type=excluded.response_type,prompt=excluded.prompt,
    options=excluded.options,answer_key=excluded.answer_key,max_score=excluded.max_score;
end; $$;

create or replace function public.assign_learning_journey(target_journey uuid,target_classroom uuid,target_students uuid[] default null,assignment_reason text default 'Intervenção pedagógica',source_assessment uuid default null,request_key uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys; classroom public.classrooms; assignment_id uuid; journey_version uuid; requested_count integer; eligible_count integer;
begin
  select * into journey from public.learning_journeys where id=target_journey and status='published';
  select id into journey_version from public.learning_journey_versions where journey_id=target_journey and version_number=journey.current_version;
  select * into classroom from public.classrooms where id=target_classroom;
  if journey.id is null or journey_version is null or classroom.id is null or journey.network_id<>classroom.network_id
    or not private.can_access_pedagogy_scope(classroom.network_id,classroom.school_id,classroom.id,null)
    or not private.has_permission('pedagogy.assign',classroom.network_id,classroom.school_id)
  then raise exception 'Not authorized'; end if;
  select id into assignment_id from public.learning_journey_assignments where assigned_by=auth.uid() and idempotency_key=request_key;
  if assignment_id is not null then return assignment_id; end if;
  if target_students is not null then
    select cardinality(array(select distinct unnest(target_students))) into requested_count;
    select count(distinct e.student_id) into eligible_count from public.student_enrollments e
      where e.classroom_id=classroom.id and e.status='enrolled' and e.student_id=any(target_students);
    if requested_count=0 or eligible_count<>requested_count then raise exception 'Student outside classroom'; end if;
  end if;
  insert into public.learning_journey_assignments(journey_id,journey_version_id,network_id,school_id,classroom_id,target_type,target_student_id,source_assessment_id,source_skill_id,reason,idempotency_key,assigned_by)
  values(journey.id,journey_version,classroom.network_id,classroom.school_id,classroom.id,
    case when requested_count=1 then 'student' else 'classroom' end,
    case when requested_count=1 then target_students[1] end,source_assessment,journey.skill_id,trim(assignment_reason),request_key,auth.uid())
  returning id into assignment_id;
  insert into public.learning_journey_students(assignment_id,student_id)
  select assignment_id,e.student_id from public.student_enrollments e where e.classroom_id=classroom.id and e.status='enrolled'
    and (target_students is null or e.student_id=any(target_students));
  return assignment_id;
end; $$;

create or replace function public.get_my_learning_journeys()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',a.id,'journey_id',j.id,
    'title',coalesce(v.snapshot->'journey'->>'title',j.title),
    'description',coalesce(v.snapshot->'journey'->>'description',j.description),
    'skill_id',coalesce(v.snapshot->'journey'->>'skill_id',j.skill_id::text),
    'status',recipient.status,'progress_percentage',recipient.progress_percentage,
    'pedagogical_score',recipient.pedagogical_score,'gamification_points',recipient.gamification_points,
    'due_at',a.due_at,'journey_version',v.version_number,
    'steps',(select coalesce(jsonb_agg(snapshot_step || jsonb_build_object(
      'status',coalesce(progress.status,'not_started'),
      'response',coalesce(progress.response,'{}'::jsonb),
      'pedagogical_score',progress.pedagogical_score,
      'response_type',validation.response_type,
      'prompt',validation.prompt,
      'options',coalesce(validation.options,'[]'::jsonb)
    ) order by (snapshot_step->>'position')::integer),'[]'::jsonb)
      from jsonb_array_elements(v.snapshot->'steps') snapshot_step
      left join public.learning_journey_step_progress progress on progress.assignment_id=a.id and progress.student_id=recipient.student_id and progress.step_id=(snapshot_step->>'id')::uuid
      left join private.journey_step_validation validation on validation.step_id=(snapshot_step->>'id')::uuid)
  ) order by a.created_at desc),'[]'::jsonb)
  from public.learning_journey_students recipient
  join public.learning_journey_assignments a on a.id=recipient.assignment_id
  join public.learning_journeys j on j.id=a.journey_id
  join public.learning_journey_versions v on v.id=a.journey_version_id
  where recipient.student_id=auth.uid() and a.status in ('scheduled','active') and a.starts_at<=now() and (a.due_at is null or a.due_at>=now());
$$;

create or replace function public.save_journey_step_progress(target_assignment uuid,target_step uuid,target_status text,response_payload jsonb default '{}'::jsonb,request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  student uuid:=auth.uid(); assignment public.learning_journey_assignments; recipient public.learning_journey_students;
  validation private.journey_step_validation; step_snapshot jsonb; previous_pending boolean; score numeric(10,2):=null;
  required_steps integer; completed_steps integer; total_points integer; total_score numeric(10,2); result jsonb;
  reassessment_percentage numeric;
begin
  if student is null or target_status not in ('in_progress','completed') or jsonb_typeof(response_payload)<>'object'
    or pg_column_size(response_payload)>32768 then raise exception 'Invalid progress'; end if;
  select * into assignment from public.learning_journey_assignments where id=target_assignment for update;
  select * into recipient from public.learning_journey_students where assignment_id=target_assignment and student_id=student for update;
  if assignment.id is null or recipient.student_id is null or recipient.status in ('cancelled','completed')
    or assignment.status not in ('scheduled','active') or assignment.starts_at>now() or (assignment.due_at is not null and assignment.due_at<now())
  then raise exception 'Not authorized or assignment unavailable'; end if;
  if exists(select 1 from private.journey_progress_operations o where o.assignment_id=target_assignment and o.student_id=student and o.request_key=$5)
  then return jsonb_build_object('assignment_id',target_assignment,'idempotent',true); end if;
  select item into step_snapshot from public.learning_journey_versions version,
    lateral jsonb_array_elements(version.snapshot->'steps') item
    where version.id=assignment.journey_version_id and item->>'id'=target_step::text;
  if step_snapshot is null then raise exception 'Step outside assigned version'; end if;
  select exists(select 1 from jsonb_array_elements(version.snapshot->'steps') prior
    left join public.learning_journey_step_progress progress on progress.assignment_id=target_assignment and progress.student_id=student and progress.step_id=(prior->>'id')::uuid
    where version.id=assignment.journey_version_id and coalesce((prior->>'required')::boolean,true)
      and (prior->>'position')::integer<(step_snapshot->>'position')::integer and coalesce(progress.status,'not_started')<>'completed')
  into previous_pending from public.learning_journey_versions version where version.id=assignment.journey_version_id;
  if previous_pending then raise exception 'Complete previous required steps first'; end if;
  select * into validation from private.journey_step_validation where step_id=target_step;
  if target_status='completed' then
    if validation.response_type='acknowledgement' and coalesce((response_payload->>'acknowledged')::boolean,false) is not true then raise exception 'Acknowledgement required';
    elsif validation.response_type='single_choice' then
      if response_payload->>'choice' is null or not validation.options ? (response_payload->>'choice') then raise exception 'Invalid answer'; end if;
      score:=case when response_payload->>'choice'=validation.answer_key->>'choice' then validation.max_score else 0 end;
    elsif validation.response_type='short_text' then
      if char_length(trim(coalesce(response_payload->>'text',''))) not between 1 and 5000 then raise exception 'Answer required'; end if;
      score:=null;
    elsif validation.response_type='assessment' then
      select fact.percentage into reassessment_percentage
      from private.analytics_attempt_facts fact
      where fact.student_id=student and fact.classroom_id=assignment.classroom_id
        and fact.assessment_id=(step_snapshot->>'assessment_id')::uuid
        and fact.submitted_at>=assignment.created_at
        and fact.status in ('submitted','auto_submitted','graded') and fact.percentage is not null
      order by fact.submitted_at desc limit 1;
      if reassessment_percentage is null then raise exception 'Complete the linked reassessment before validating this step'; end if;
      score:=round(validation.max_score*reassessment_percentage/100,2);
    elsif validation.response_type='teacher_review' then raise exception 'This step requires teacher validation';
    elsif validation.response_type is null and step_snapshot->>'step_type' not in ('content','review') then raise exception 'Step validation is not configured';
    end if;
  end if;
  insert into public.learning_journey_step_progress(assignment_id,student_id,step_id,status,response,pedagogical_score,started_at,completed_at)
  values(target_assignment,student,target_step,target_status,response_payload,score,now(),case when target_status='completed' then now() end)
  on conflict(assignment_id,student_id,step_id) do update set
    status=case when public.learning_journey_step_progress.status='completed' then 'completed' else excluded.status end,
    response=case when public.learning_journey_step_progress.status='completed' then public.learning_journey_step_progress.response else excluded.response end,
    pedagogical_score=coalesce(public.learning_journey_step_progress.pedagogical_score,excluded.pedagogical_score),
    started_at=coalesce(public.learning_journey_step_progress.started_at,now()),
    completed_at=case when excluded.status='completed' then coalesce(public.learning_journey_step_progress.completed_at,now()) else public.learning_journey_step_progress.completed_at end,
    updated_at=now();
  insert into private.journey_progress_operations values(target_assignment,student,$5,now());
  select count(*) filter(where coalesce((item->>'required')::boolean,true)),
    count(*) filter(where coalesce((item->>'required')::boolean,true) and progress.status='completed'),
    coalesce(sum((item->>'gamification_points')::integer) filter(where progress.status='completed'),0),
    sum(progress.pedagogical_score) filter(where progress.status='completed')
  into required_steps,completed_steps,total_points,total_score
  from public.learning_journey_versions version, lateral jsonb_array_elements(version.snapshot->'steps') item
  left join public.learning_journey_step_progress progress on progress.assignment_id=target_assignment and progress.student_id=student and progress.step_id=(item->>'id')::uuid
  where version.id=assignment.journey_version_id;
  update public.learning_journey_students set
    status=case when required_steps>0 and completed_steps=required_steps then 'completed' else 'in_progress' end,
    progress_percentage=case when required_steps=0 then 0 else round(100.0*completed_steps/required_steps,2) end,
    pedagogical_score=total_score,gamification_points=total_points,started_at=coalesce(started_at,now()),
    completed_at=case when required_steps>0 and completed_steps=required_steps then coalesce(completed_at,now()) end,updated_at=now()
  where assignment_id=target_assignment and student_id=student
  returning jsonb_build_object('assignment_id',assignment_id,'status',status,'progress_percentage',progress_percentage,
    'pedagogical_score',pedagogical_score,'gamification_points',gamification_points,'idempotent',false) into result;
  return result;
end; $$;

revoke all on function public.configure_journey_step_validation(uuid,text,text,jsonb,jsonb,numeric) from public,anon;
grant execute on function public.configure_journey_step_validation(uuid,text,text,jsonb,jsonb,numeric) to authenticated;
