-- Complete the Phase 4 monitor with one paginated, scoped row per scheduled
-- student, including students whose access token has not been issued yet.
create or replace function public.list_assessment_attempt_monitor(
  target_assessment uuid,
  page_size integer default 50,
  page_offset integer default 0
)
returns table(
  attempt_id uuid,
  schedule_id uuid,
  student_id uuid,
  student_name text,
  classroom_id uuid,
  classroom_name text,
  booklet_code text,
  attempt_status text,
  submission_kind text,
  answered_count bigint,
  question_count bigint,
  progress_percent numeric,
  started_at timestamptz,
  last_activity_at timestamptz,
  deadline_at timestamptz,
  seconds_remaining integer,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment public.diagnostic_assessments%rowtype;
begin
  select * into assessment
  from public.diagnostic_assessments
  where id = target_assessment;

  if assessment.id is null or not private.has_permission('assessment.apply', assessment.network_id) then
    raise exception 'Not authorized';
  end if;

  perform private.auto_submit_expired_assessment_attempts(assessment.id);

  return query
  select
    attempt.id,
    schedule.id,
    enrollment.student_id,
    profile.display_name,
    classroom.id,
    classroom.name,
    booklet.code,
    coalesce(attempt.status, 'scheduled'),
    attempt.submission_kind,
    count(response.id) filter (where response.answer <> '{}'::jsonb),
    count(item.id),
    coalesce(
      round(
        count(response.id) filter (where response.answer <> '{}'::jsonb) * 100.0
        / nullif(count(item.id), 0),
        2
      ),
      0
    ),
    attempt.started_at,
    attempt.last_activity_at,
    attempt.deadline_at,
    case
      when attempt.deadline_at is null then null
      else greatest(0, floor(extract(epoch from (attempt.deadline_at - now())))::integer)
    end,
    count(*) over ()
  from public.assessment_schedules as schedule
  join public.assessment_classrooms as scheduled_classroom
    on scheduled_classroom.schedule_id = schedule.id
  join public.classrooms as classroom
    on classroom.id = scheduled_classroom.classroom_id
  join public.student_enrollments as enrollment
    on enrollment.classroom_id = classroom.id
    and enrollment.network_id = schedule.network_id
    and enrollment.school_id = schedule.school_id
    and enrollment.status = 'enrolled'
  join public.profiles as profile on profile.id = enrollment.student_id
  left join public.assessment_attempts as attempt
    on attempt.schedule_id = schedule.id
    and attempt.student_id = enrollment.student_id
  left join public.assessment_booklets as booklet on booklet.id = attempt.booklet_id
  left join public.assessment_attempt_items as item on item.attempt_id = attempt.id
  left join public.assessment_responses as response on response.attempt_item_id = item.id
  where schedule.assessment_id = assessment.id
    and private.has_permission('assessment.apply', schedule.network_id, schedule.school_id)
  group by
    schedule.id,
    enrollment.student_id,
    profile.id,
    classroom.id,
    attempt.id,
    booklet.id
  order by classroom.name, profile.display_name, schedule.id, enrollment.student_id
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

comment on function public.list_assessment_attempt_monitor(uuid,integer,integer) is
  'Returns a server-paginated, institution-scoped application monitor including scheduled students without an attempt.';
