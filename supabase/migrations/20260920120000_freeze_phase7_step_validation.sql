-- Fase 7: congelar a regra de cada etapa juntamente com a versão atribuída.
-- A migration é aditiva. Versões anteriores são preenchidas com o último estado
-- disponível; o histórico anterior à migração não pode ser reconstruído.

create table private.journey_version_step_validation (
  journey_version_id uuid not null references public.learning_journey_versions(id) on delete restrict,
  step_id uuid not null references public.learning_journey_steps(id) on delete restrict,
  response_type text not null check (response_type in ('acknowledgement','single_choice','short_text','teacher_review','assessment')),
  prompt text not null check (char_length(prompt) between 3 and 2000),
  options jsonb not null check (jsonb_typeof(options)='array'),
  answer_key jsonb not null check (jsonb_typeof(answer_key)='object'),
  max_score numeric(10,2) not null check (max_score >= 0),
  primary key(journey_version_id,step_id)
);

alter table private.journey_version_step_validation enable row level security;
revoke all on private.journey_version_step_validation from public,anon,authenticated;

insert into private.journey_version_step_validation(journey_version_id,step_id,response_type,prompt,options,answer_key,max_score)
select v.id,c.step_id,c.response_type,c.prompt,c.options,c.answer_key,c.max_score
from public.learning_journey_versions v
join lateral jsonb_array_elements(v.snapshot->'steps') item on true
join private.journey_step_validation c on c.step_id=(item->>'id')::uuid;

create or replace function private.freeze_journey_version_validation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (
    select 1 from jsonb_array_elements(new.snapshot->'steps') item
    where item->>'step_type' in ('interactive','exercise','quiz','reassessment')
      and not exists(select 1 from private.journey_step_validation c where c.step_id=(item->>'id')::uuid)
  ) then raise exception 'Journey step validation required before publication'; end if;
  insert into private.journey_version_step_validation(journey_version_id,step_id,response_type,prompt,options,answer_key,max_score)
  select new.id,c.step_id,c.response_type,c.prompt,c.options,c.answer_key,c.max_score
  from jsonb_array_elements(new.snapshot->'steps') item
  join private.journey_step_validation c on c.step_id=(item->>'id')::uuid;
  return new;
end; $$;

create trigger freeze_journey_version_validation
  after insert on public.learning_journey_versions
  for each row execute function private.freeze_journey_version_validation();

revoke all on function private.freeze_journey_version_validation() from public,anon,authenticated;

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
      left join private.journey_version_step_validation validation on validation.journey_version_id=v.id and validation.step_id=(snapshot_step->>'id')::uuid)
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
  validation private.journey_version_step_validation; step_snapshot jsonb; previous_pending boolean; score numeric(10,2):=null;
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
  select * into validation from private.journey_version_step_validation where journey_version_id=assignment.journey_version_id and step_id=target_step;
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
