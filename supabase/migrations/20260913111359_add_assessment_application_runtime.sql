-- Aprendê - Fase 4: runtime seguro de aplicação das avaliações diagnósticas.
-- Esta migration é aditiva e sucede a migration histórica vazia reservada.

alter table public.diagnostic_assessments
  add column allow_back_navigation boolean not null default true;

grant update (allow_back_navigation) on public.diagnostic_assessments to authenticated;

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null,
  schedule_id uuid not null,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  booklet_id uuid not null,
  network_id uuid not null,
  school_id uuid not null,
  status text not null default 'scheduled' check (
    status in ('scheduled','available','in_progress','paused','submitted','auto_submitted','pending_review','graded','cancelled','invalidated')
  ),
  submission_kind text check (submission_kind is null or submission_kind in ('submitted','auto_submitted')),
  access_origin text not null default 'web' check (access_origin in ('web','token','staff')),
  access_token_hash text,
  token_expires_at timestamptz,
  token_generation integer not null default 0 check (token_generation >= 0),
  token_failed_attempts integer not null default 0 check (token_failed_attempts between 0 and 5),
  token_locked_until timestamptz,
  allowed_minutes integer not null check (allowed_minutes between 1 and 600),
  current_position integer not null default 1 check (current_position > 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  deadline_at timestamptz,
  last_activity_at timestamptz,
  submitted_at timestamptz,
  closed_at timestamptz,
  score numeric(10,2) check (score is null or score >= 0),
  max_score numeric(10,2) not null default 0 check (max_score >= 0),
  updated_at timestamptz not null default now(),
  foreign key (assessment_id, network_id) references public.diagnostic_assessments(id, network_id) on delete restrict,
  foreign key (schedule_id, assessment_id) references public.assessment_schedules(id, assessment_id) on delete restrict,
  foreign key (booklet_id, assessment_id) references public.assessment_booklets(id, assessment_id) on delete restrict,
  foreign key (school_id, network_id) references public.schools(id, network_id) on delete restrict,
  unique (schedule_id, student_id),
  unique (id, student_id),
  check ((started_at is null and deadline_at is null) or (started_at is not null and deadline_at is not null)),
  check (deadline_at is null or deadline_at > started_at),
  check (submitted_at is null or started_at is not null)
);

create table public.assessment_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  source_booklet_item_id uuid not null references public.assessment_booklet_items(id) on delete restrict,
  assessment_item_version_id uuid not null references public.assessment_item_versions(id) on delete restrict,
  position integer not null check (position > 0),
  snapshot jsonb not null,
  option_order jsonb not null default '[]'::jsonb check (jsonb_typeof(option_order) = 'array'),
  max_points numeric(10,2) not null check (max_points > 0),
  created_at timestamptz not null default now(),
  unique (attempt_id, source_booklet_item_id),
  unique (attempt_id, position),
  unique (id, attempt_id)
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  attempt_item_id uuid not null,
  answer jsonb not null default '{}'::jsonb check (jsonb_typeof(answer) = 'object'),
  marked_for_review boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  is_correct boolean,
  points_awarded numeric(10,2),
  review_status text not null default 'not_required' check (review_status in ('not_required','pending','reviewed')),
  reviewer_comment text check (reviewer_comment is null or char_length(reviewer_comment) <= 10000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  saved_at timestamptz not null default now(),
  foreign key (attempt_item_id, attempt_id) references public.assessment_attempt_items(id, attempt_id) on delete cascade,
  unique (attempt_item_id),
  check (points_awarded is null or points_awarded >= 0)
);

create table public.assessment_attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  event_type text not null check (event_type in (
    'attempt_created','token_rotated','token_revoked','started','resumed','answer_saved','submitted',
    'auto_submitted','pending_review','graded','cancelled','invalidated','reopened'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table private.assessment_response_operations (
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  idempotency_key uuid not null,
  attempt_item_id uuid not null,
  response_id uuid not null references public.assessment_responses(id) on delete cascade,
  response_revision integer not null,
  created_at timestamptz not null default now(),
  primary key (attempt_id, idempotency_key),
  foreign key (attempt_item_id, attempt_id) references public.assessment_attempt_items(id, attempt_id) on delete cascade
);

create index assessment_attempts_student_status_idx
  on public.assessment_attempts(student_id, status, created_at desc);
create index assessment_attempts_monitor_idx
  on public.assessment_attempts(assessment_id, school_id, classroom_id, status, last_activity_at desc);
create index assessment_attempts_deadline_idx
  on public.assessment_attempts(deadline_at)
  where status in ('in_progress','paused');
create index assessment_attempts_assessment_network_idx on public.assessment_attempts(assessment_id, network_id);
create index assessment_attempts_schedule_assessment_idx on public.assessment_attempts(schedule_id, assessment_id);
create index assessment_attempts_booklet_assessment_idx on public.assessment_attempts(booklet_id, assessment_id);
create index assessment_attempts_classroom_idx on public.assessment_attempts(classroom_id);
create index assessment_attempts_school_network_idx on public.assessment_attempts(school_id, network_id);
create index assessment_attempt_items_version_idx on public.assessment_attempt_items(assessment_item_version_id);
create index assessment_attempt_items_source_idx on public.assessment_attempt_items(source_booklet_item_id);
create index assessment_responses_attempt_idx on public.assessment_responses(attempt_id, saved_at desc);
create index assessment_responses_review_idx
  on public.assessment_responses(review_status, attempt_id)
  where review_status = 'pending';
create index assessment_responses_reviewer_idx on public.assessment_responses(reviewed_by) where reviewed_by is not null;
create index assessment_attempt_events_attempt_idx on public.assessment_attempt_events(attempt_id, created_at desc);
create index assessment_attempt_events_actor_idx on public.assessment_attempt_events(actor_id) where actor_id is not null;
create index assessment_response_operations_item_idx
  on private.assessment_response_operations(attempt_item_id, created_at desc);
create index assessment_response_operations_response_idx
  on private.assessment_response_operations(response_id);

create or replace function private.student_owns_active_attempt(target_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessment_attempts as attempt
    where attempt.id = target_attempt
      and attempt.student_id = (select auth.uid())
      and exists (
        select 1
        from public.student_enrollments as enrollment
        where enrollment.student_id = attempt.student_id
          and enrollment.network_id = attempt.network_id
          and enrollment.school_id = attempt.school_id
          and enrollment.classroom_id = attempt.classroom_id
          and enrollment.status = 'enrolled'
      )
  );
$$;

create or replace function private.staff_can_access_attempt(target_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessment_attempts as attempt
    where attempt.id = target_attempt
      and private.has_permission('assessment.apply', attempt.network_id, attempt.school_id)
  );
$$;

create or replace function private.record_attempt_event(
  target_attempt uuid,
  target_event text,
  event_reason text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.assessment_attempt_events(attempt_id, event_type, actor_id, reason, metadata)
  values (target_attempt, target_event, auth.uid(), nullif(trim(event_reason), ''), coalesce(event_metadata, '{}'::jsonb));
end;
$$;

create or replace function private.prepare_assessment_attempt_items(target_attempt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
begin
  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.id is null then
    raise exception 'Attempt not found';
  end if;

  if exists (select 1 from public.assessment_attempt_items where attempt_id = attempt.id) then
    return;
  end if;

  insert into public.assessment_attempt_items(
    attempt_id,
    source_booklet_item_id,
    assessment_item_version_id,
    position,
    snapshot,
    option_order,
    max_points
  )
  select
    attempt.id,
    ordered.source_booklet_item_id,
    ordered.assessment_item_version_id,
    row_number() over (
      order by
        case
          when ordered.randomize_questions then md5(attempt.id::text || ordered.source_booklet_item_id::text)
          else lpad(ordered.source_position::text, 12, '0')
        end,
        ordered.source_booklet_item_id
    )::integer,
    ordered.snapshot,
    coalesce((
      select jsonb_agg(option_row.value ->> 'id' order by
        case
          when ordered.randomize_options then md5(attempt.id::text || ordered.source_booklet_item_id::text || (option_row.value ->> 'id'))
          else lpad(coalesce((option_row.value ->> 'sort_order')::integer, option_row.ordinality::integer)::text, 12, '0')
        end,
        option_row.value ->> 'id'
      )
      from jsonb_array_elements(coalesce(ordered.snapshot -> 'options', '[]'::jsonb))
        with ordinality as option_row(value, ordinality)
    ), '[]'::jsonb),
    ordered.points
  from (
    select
      link.id as source_booklet_item_id,
      link.assessment_item_version_id,
      link.position as source_position,
      link.points,
      version.snapshot,
      assessment.randomize_questions,
      assessment.randomize_options
    from public.assessment_booklet_items as link
    join public.assessment_item_versions as version on version.id = link.assessment_item_version_id
    join public.diagnostic_assessments as assessment on assessment.id = link.assessment_id
    where link.booklet_id = attempt.booklet_id
  ) as ordered;

  if not exists (select 1 from public.assessment_attempt_items where attempt_id = attempt.id) then
    raise exception 'Assigned booklet has no immutable items';
  end if;

  update public.assessment_attempts
  set max_score = (
    select sum(item.max_points)
    from public.assessment_attempt_items as item
    where item.attempt_id = attempt.id
  ),
  updated_at = now()
  where id = attempt.id;
end;
$$;

create or replace function private.ensure_assessment_attempt(
  target_schedule uuid,
  target_student uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.assessment_schedules%rowtype;
  assessment public.diagnostic_assessments%rowtype;
  target_classroom uuid;
  selected_booklet uuid;
  booklet_count integer;
  booklet_offset integer;
  attempt_id uuid;
begin
  select * into schedule
  from public.assessment_schedules
  where id = target_schedule
  for update;

  if schedule.id is null
    or schedule.status not in ('scheduled','active')
    or not private.has_permission('assessment.apply', schedule.network_id, schedule.school_id)
  then
    raise exception 'Not authorized';
  end if;

  select * into assessment
  from public.diagnostic_assessments
  where id = schedule.assessment_id;

  if assessment.id is null or assessment.status not in ('scheduled','active') then
    raise exception 'Assessment is not available for application';
  end if;

  select enrollment.classroom_id into target_classroom
  from public.student_enrollments as enrollment
  join public.assessment_classrooms as scheduled_classroom
    on scheduled_classroom.schedule_id = schedule.id
    and scheduled_classroom.classroom_id = enrollment.classroom_id
  where enrollment.student_id = target_student
    and enrollment.network_id = schedule.network_id
    and enrollment.school_id = schedule.school_id
    and enrollment.status = 'enrolled'
  order by enrollment.created_at desc, enrollment.id
  limit 1;

  if target_classroom is null then
    raise exception 'Student is not enrolled in this schedule';
  end if;

  select count(*) into booklet_count
  from public.assessment_booklets
  where assessment_id = assessment.id;

  if booklet_count < 1 or booklet_count > 5 then
    raise exception 'Assessment has no valid booklet distribution';
  end if;

  booklet_offset := mod(
    hashtextextended(schedule.id::text || ':' || target_student::text, 0) & 9223372036854775807,
    booklet_count
  )::integer;

  select booklet.id into selected_booklet
  from public.assessment_booklets as booklet
  where booklet.assessment_id = assessment.id
  order by booklet.code, booklet.id
  offset booklet_offset
  limit 1;

  insert into public.assessment_attempts(
    assessment_id,
    schedule_id,
    classroom_id,
    student_id,
    booklet_id,
    network_id,
    school_id,
    status,
    allowed_minutes,
    access_origin
  )
  values (
    assessment.id,
    schedule.id,
    target_classroom,
    target_student,
    selected_booklet,
    schedule.network_id,
    schedule.school_id,
    case when now() between schedule.starts_at and schedule.ends_at then 'available' else 'scheduled' end,
    assessment.duration_minutes,
    'staff'
  )
  on conflict (schedule_id, student_id) do nothing
  returning id into attempt_id;

  if attempt_id is null then
    select id into attempt_id
    from public.assessment_attempts
    where schedule_id = schedule.id and student_id = target_student
    for update;
  else
    perform private.record_attempt_event(attempt_id, 'attempt_created');
  end if;

  perform private.prepare_assessment_attempt_items(attempt_id);
  return attempt_id;
end;
$$;

create or replace function public.issue_assessment_access_token(
  target_schedule uuid,
  target_student uuid,
  valid_minutes integer default 120
)
returns table(attempt_id uuid, access_token text, expires_at timestamptz, booklet_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  ensured_attempt uuid;
begin
  if valid_minutes not between 5 and 1440 then
    raise exception 'Token validity must be between 5 and 1440 minutes';
  end if;

  ensured_attempt := private.ensure_assessment_attempt(target_schedule, target_student);

  if exists (
    select 1 from public.assessment_attempts
    where id = ensured_attempt
      and status in ('submitted','auto_submitted','pending_review','graded','cancelled','invalidated')
  ) then
    raise exception 'Final attempts cannot receive a new token';
  end if;

  generated_token := upper(encode(extensions.gen_random_bytes(16), 'hex'));

  update public.assessment_attempts
  set access_token_hash = encode(extensions.digest(generated_token, 'sha256'), 'hex'),
      token_expires_at = now() + make_interval(mins => valid_minutes),
      token_generation = token_generation + 1,
      token_failed_attempts = 0,
      token_locked_until = null,
      status = case when now() between (
        select schedule.starts_at from public.assessment_schedules as schedule where schedule.id = target_schedule
      ) and (
        select schedule.ends_at from public.assessment_schedules as schedule where schedule.id = target_schedule
      ) then 'available' else 'scheduled' end,
      updated_at = now()
  where id = ensured_attempt;

  perform private.record_attempt_event(
    ensured_attempt,
    'token_rotated',
    null,
    jsonb_build_object('generation', (select token_generation from public.assessment_attempts where id = ensured_attempt))
  );

  return query
  select attempt.id, generated_token, attempt.token_expires_at, booklet.code
  from public.assessment_attempts as attempt
  join public.assessment_booklets as booklet on booklet.id = attempt.booklet_id
  where attempt.id = ensured_attempt;
end;
$$;

create or replace function public.revoke_assessment_access_token(
  target_attempt uuid,
  action_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.staff_can_access_attempt(target_attempt)
    or char_length(trim(coalesce(action_reason, ''))) < 5
  then
    raise exception 'Not authorized';
  end if;

  update public.assessment_attempts
  set access_token_hash = null,
      token_expires_at = null,
      token_failed_attempts = 0,
      token_locked_until = null,
      updated_at = now()
  where id = target_attempt
    and status in ('scheduled','available');

  if not found then
    raise exception 'Token cannot be revoked for this attempt';
  end if;

  perform private.record_attempt_event(target_attempt, 'token_revoked', action_reason);
end;
$$;

create or replace function private.student_item_snapshot(target_attempt_item uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select
    (attempt_item.snapshot
      - 'options'
      - 'correct_answer_justification'
      - 'pedagogical_comment'
      - 'reviewer_id'
      - 'approver_id')
    || jsonb_build_object(
      'options', coalesce((
        select jsonb_agg(
          option_value.value
            - 'is_correct'
            - 'feedback'
            - 'distractor_analysis'
          order by option_order.ordinality
        )
        from jsonb_array_elements_text(attempt_item.option_order)
          with ordinality as option_order(option_id, ordinality)
        join lateral (
          select candidate.value
          from jsonb_array_elements(coalesce(attempt_item.snapshot -> 'options', '[]'::jsonb)) as candidate(value)
          where candidate.value ->> 'id' = option_order.option_id
          limit 1
        ) as option_value on true
      ), '[]'::jsonb)
    )
  from public.assessment_attempt_items as attempt_item
  where attempt_item.id = target_attempt_item;
$$;

create or replace function public.list_available_assessments()
returns table(
  attempt_id uuid,
  schedule_id uuid,
  assessment_id uuid,
  assessment_title text,
  subject_name text,
  classroom_name text,
  booklet_code text,
  attempt_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  question_count bigint,
  token_required boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    attempt.id,
    schedule.id,
    assessment.id,
    assessment.title,
    subject.name,
    classroom.name,
    booklet.code,
    case
      when attempt.status = 'scheduled' and now() between schedule.starts_at and schedule.ends_at then 'available'
      else attempt.status
    end,
    schedule.starts_at,
    schedule.ends_at,
    attempt.allowed_minutes,
    count(attempt_item.id),
    schedule.token_required
  from public.assessment_attempts as attempt
  join public.assessment_schedules as schedule on schedule.id = attempt.schedule_id
  join public.diagnostic_assessments as assessment on assessment.id = attempt.assessment_id
  join public.curriculum_subjects as subject on subject.id = assessment.subject_id
  join public.classrooms as classroom on classroom.id = attempt.classroom_id
  join public.assessment_booklets as booklet on booklet.id = attempt.booklet_id
  left join public.assessment_attempt_items as attempt_item on attempt_item.attempt_id = attempt.id
  where attempt.student_id = (select auth.uid())
    and schedule.status in ('scheduled','active')
    and private.student_owns_active_attempt(attempt.id)
  group by attempt.id, schedule.id, assessment.id, subject.id, classroom.id, booklet.id
  order by schedule.starts_at, assessment.title, attempt.id;
$$;

create or replace function public.start_assessment_attempt(
  target_schedule uuid,
  access_token text,
  origin text default 'token'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  schedule public.assessment_schedules%rowtype;
  supplied_hash text;
  new_deadline timestamptz;
begin
  select candidate.* into attempt
  from public.assessment_attempts as candidate
  where candidate.schedule_id = target_schedule
    and candidate.student_id = auth.uid()
  for update;

  if attempt.id is null or not private.student_owns_active_attempt(attempt.id) then
    return jsonb_build_object('ok', false, 'error', 'Acesso indisponível ou inválido.');
  end if;

  select * into schedule
  from public.assessment_schedules
  where id = attempt.schedule_id;

  if schedule.status not in ('scheduled','active')
    or now() < schedule.starts_at
    or now() > schedule.ends_at
  then
    return jsonb_build_object('ok', false, 'error', 'Acesso indisponível ou inválido.');
  end if;

  if attempt.status in ('submitted','auto_submitted','pending_review','graded','cancelled','invalidated') then
    return jsonb_build_object('ok', false, 'error', 'Acesso indisponível ou inválido.');
  end if;

  if attempt.token_locked_until is not null and attempt.token_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Acesso indisponível ou inválido.');
  end if;

  supplied_hash := encode(extensions.digest(coalesce(trim(access_token), ''), 'sha256'), 'hex');

  if attempt.access_token_hash is null
    or attempt.token_expires_at is null
    or attempt.token_expires_at <= now()
    or supplied_hash <> attempt.access_token_hash
  then
    update public.assessment_attempts
    set token_failed_attempts = least(token_failed_attempts + 1, 5),
        token_locked_until = case when token_failed_attempts + 1 >= 5 then now() + interval '5 minutes' else token_locked_until end,
        updated_at = now()
    where id = attempt.id;
    return jsonb_build_object('ok', false, 'error', 'Acesso indisponível ou inválido.');
  end if;

  new_deadline := least(
    schedule.ends_at,
    now() + make_interval(mins => attempt.allowed_minutes)
  );

  update public.assessment_attempts
  set status = 'in_progress',
      access_origin = case when origin in ('web','token') then origin else 'token' end,
      started_at = coalesce(started_at, now()),
      deadline_at = coalesce(deadline_at, new_deadline),
      last_activity_at = now(),
      access_token_hash = null,
      token_expires_at = null,
      token_failed_attempts = 0,
      token_locked_until = null,
      updated_at = now()
  where id = attempt.id;

  perform private.record_attempt_event(attempt.id, 'started');
  return jsonb_build_object('ok', true, 'attempt_id', attempt.id);
end;
$$;

create or replace function private.grade_and_close_assessment_attempt(
  target_attempt uuid,
  submission_event text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  has_essay boolean;
  awarded numeric(10,2);
  possible numeric(10,2);
  final_status text;
begin
  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.id is null then
    raise exception 'Attempt not found';
  end if;

  if attempt.status in ('submitted','auto_submitted','pending_review','graded') then
    return jsonb_build_object(
      'attempt_id', attempt.id,
      'status', attempt.status,
      'submission_kind', attempt.submission_kind,
      'score', attempt.score,
      'max_score', attempt.max_score
    );
  end if;

  if attempt.status not in ('in_progress','paused') then
    raise exception 'Attempt cannot be submitted';
  end if;

  if submission_event not in ('submitted','auto_submitted') then
    raise exception 'Invalid submission event';
  end if;

  insert into public.assessment_responses(attempt_id, attempt_item_id, answer, review_status)
  select
    item.attempt_id,
    item.id,
    '{}'::jsonb,
    case when item.snapshot ->> 'item_type' = 'essay' then 'pending' else 'not_required' end
  from public.assessment_attempt_items as item
  where item.attempt_id = attempt.id
  on conflict (attempt_item_id) do nothing;

  update public.assessment_responses as response
  set is_correct = case
        when item.snapshot ->> 'item_type' in ('multiple_choice','true_false') then
          coalesce(response.answer ->> 'option_id', '') = coalesce((
            select option_row.value ->> 'id'
            from jsonb_array_elements(coalesce(item.snapshot -> 'options', '[]'::jsonb)) as option_row(value)
            where coalesce((option_row.value ->> 'is_correct')::boolean, false)
            limit 1
          ), '')
        else null
      end,
      points_awarded = case
        when item.snapshot ->> 'item_type' in ('multiple_choice','true_false')
          and coalesce(response.answer ->> 'option_id', '') = coalesce((
            select option_row.value ->> 'id'
            from jsonb_array_elements(coalesce(item.snapshot -> 'options', '[]'::jsonb)) as option_row(value)
            where coalesce((option_row.value ->> 'is_correct')::boolean, false)
            limit 1
          ), '')
          then item.max_points
        when item.snapshot ->> 'item_type' in ('multiple_choice','true_false') then 0
        else null
      end,
      review_status = case when item.snapshot ->> 'item_type' = 'essay' then 'pending' else 'not_required' end,
      saved_at = now()
  from public.assessment_attempt_items as item
  where response.attempt_item_id = item.id
    and response.attempt_id = attempt.id;

  select
    exists (
      select 1
      from public.assessment_attempt_items as item
      where item.attempt_id = attempt.id and item.snapshot ->> 'item_type' = 'essay'
    ),
    coalesce(sum(response.points_awarded), 0),
    coalesce(sum(item.max_points), 0)
  into has_essay, awarded, possible
  from public.assessment_attempt_items as item
  left join public.assessment_responses as response on response.attempt_item_id = item.id
  where item.attempt_id = attempt.id;

  final_status := case when has_essay then 'pending_review' else 'graded' end;

  update public.assessment_attempts
  set status = final_status,
      submission_kind = submission_event,
      submitted_at = coalesce(submitted_at, now()),
      closed_at = now(),
      last_activity_at = now(),
      score = awarded,
      max_score = possible,
      access_token_hash = null,
      token_expires_at = null,
      updated_at = now()
  where id = attempt.id;

  perform private.record_attempt_event(attempt.id, submission_event);
  perform private.record_attempt_event(attempt.id, final_status);

  return jsonb_build_object(
    'attempt_id', attempt.id,
    'status', final_status,
    'submission_kind', submission_event,
    'score', awarded,
    'max_score', possible
  );
end;
$$;

create or replace function private.expire_assessment_attempt(target_attempt uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
begin
  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.status in ('in_progress','paused')
    and attempt.deadline_at is not null
    and attempt.deadline_at <= now()
  then
    perform private.grade_and_close_assessment_attempt(attempt.id, 'auto_submitted');
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.get_assessment_attempt(target_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  result jsonb;
begin
  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform private.expire_assessment_attempt(target_attempt);

  select * into attempt
  from public.assessment_attempts
  where id = target_attempt;

  select jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', attempt.id,
      'assessment_id', attempt.assessment_id,
      'schedule_id', attempt.schedule_id,
      'classroom_id', attempt.classroom_id,
      'booklet_id', attempt.booklet_id,
      'booklet_code', booklet.code,
      'assessment_title', assessment.title,
      'instructions', assessment.instructions,
      'allow_back_navigation', assessment.allow_back_navigation,
      'status', attempt.status,
      'submission_kind', attempt.submission_kind,
      'current_position', attempt.current_position,
      'started_at', attempt.started_at,
      'deadline_at', attempt.deadline_at,
      'last_activity_at', attempt.last_activity_at,
      'submitted_at', attempt.submitted_at,
      'score', case when attempt.status = 'graded' then attempt.score else null end,
      'max_score', attempt.max_score,
      'server_now', now()
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'position', item.position,
        'max_points', item.max_points,
        'content', private.student_item_snapshot(item.id)
      ) order by item.position)
      from public.assessment_attempt_items as item
      where item.attempt_id = attempt.id
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_object_agg(response.attempt_item_id::text, jsonb_build_object(
        'answer', response.answer,
        'marked_for_review', response.marked_for_review,
        'revision', response.revision,
        'saved_at', response.saved_at,
        'points_awarded', case when attempt.status = 'graded' then response.points_awarded else null end,
        'reviewer_comment', case when attempt.status = 'graded' then response.reviewer_comment else null end
      ))
      from public.assessment_responses as response
      where response.attempt_id = attempt.id
    ), '{}'::jsonb)
  ) into result
  from public.assessment_booklets as booklet
  join public.diagnostic_assessments as assessment on assessment.id = attempt.assessment_id
  where booklet.id = attempt.booklet_id;

  return result;
end;
$$;

create or replace function public.save_assessment_response(
  target_attempt uuid,
  target_attempt_item uuid,
  response_payload jsonb,
  mark_for_review boolean,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  item public.assessment_attempt_items%rowtype;
  existing_operation private.assessment_response_operations%rowtype;
  saved_response public.assessment_responses%rowtype;
  item_type text;
  option_id text;
  essay_text text;
begin
  if idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform private.expire_assessment_attempt(target_attempt);

  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.status <> 'in_progress' then
    raise exception 'Attempt is not editable';
  end if;

  select * into existing_operation
  from private.assessment_response_operations as operation
  where operation.attempt_id = attempt.id
    and operation.idempotency_key = save_assessment_response.idempotency_key;

  if existing_operation.attempt_id is not null then
    select * into saved_response
    from public.assessment_responses
    where id = existing_operation.response_id;
    return jsonb_build_object(
      'response_id', saved_response.id,
      'revision', existing_operation.response_revision,
      'saved_at', saved_response.saved_at,
      'idempotent_replay', true
    );
  end if;

  select * into item
  from public.assessment_attempt_items
  where id = target_attempt_item and attempt_id = attempt.id;

  if item.id is null then
    raise exception 'Attempt item is outside attempt scope';
  end if;

  item_type := item.snapshot ->> 'item_type';

  if jsonb_typeof(coalesce(response_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid response payload';
  end if;

  if item_type in ('multiple_choice','true_false') then
    option_id := nullif(trim(response_payload ->> 'option_id'), '');
    if option_id is not null and not (item.option_order ? option_id) then
      raise exception 'Option is outside attempt item';
    end if;
    response_payload := case when option_id is null then '{}'::jsonb else jsonb_build_object('option_id', option_id) end;
  elsif item_type = 'essay' then
    essay_text := coalesce(response_payload ->> 'text', '');
    if char_length(essay_text) > 20000 then
      raise exception 'Essay response is too long';
    end if;
    response_payload := jsonb_build_object('text', essay_text);
  else
    raise exception 'Unsupported item type';
  end if;

  insert into public.assessment_responses(
    attempt_id,
    attempt_item_id,
    answer,
    marked_for_review,
    review_status
  )
  values (
    attempt.id,
    item.id,
    response_payload,
    coalesce(mark_for_review, false),
    case when item_type = 'essay' then 'pending' else 'not_required' end
  )
  on conflict (attempt_item_id) do update
  set answer = excluded.answer,
      marked_for_review = excluded.marked_for_review,
      revision = public.assessment_responses.revision + 1,
      is_correct = null,
      points_awarded = null,
      review_status = case when item_type = 'essay' then 'pending' else 'not_required' end,
      reviewer_comment = null,
      reviewed_by = null,
      reviewed_at = null,
      saved_at = now()
  returning * into saved_response;

  insert into private.assessment_response_operations(
    attempt_id,
    idempotency_key,
    attempt_item_id,
    response_id,
    response_revision
  )
  values (attempt.id, idempotency_key, item.id, saved_response.id, saved_response.revision);

  update public.assessment_attempts
  set last_activity_at = now(),
      current_position = greatest(current_position, item.position),
      updated_at = now()
  where id = attempt.id;

  perform private.record_attempt_event(
    attempt.id,
    'answer_saved',
    null,
    jsonb_build_object('attempt_item_id', item.id, 'revision', saved_response.revision)
  );

  return jsonb_build_object(
    'response_id', saved_response.id,
    'revision', saved_response.revision,
    'saved_at', saved_response.saved_at,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.set_assessment_attempt_position(
  target_attempt uuid,
  target_position integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  allow_back boolean;
  question_count integer;
begin
  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform private.expire_assessment_attempt(target_attempt);

  select candidate.*
  into attempt
  from public.assessment_attempts as candidate
  where candidate.id = target_attempt
  for update;

  select assessment.allow_back_navigation into allow_back
  from public.diagnostic_assessments as assessment
  where assessment.id = attempt.assessment_id;

  if attempt.status <> 'in_progress' then
    raise exception 'Attempt is not active';
  end if;

  select count(*) into question_count
  from public.assessment_attempt_items
  where attempt_id = attempt.id;

  if target_position not between 1 and question_count then
    raise exception 'Invalid question position';
  end if;

  if not allow_back and target_position < attempt.current_position then
    raise exception 'Back navigation is disabled';
  end if;

  update public.assessment_attempts
  set current_position = target_position,
      last_activity_at = now(),
      updated_at = now()
  where id = attempt.id;

  return target_position;
end;
$$;

create or replace function public.resume_assessment_attempt(target_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
begin
  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform private.expire_assessment_attempt(target_attempt);

  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.status = 'paused' then
    update public.assessment_attempts
    set status = 'in_progress', last_activity_at = now(), updated_at = now()
    where id = attempt.id;
    perform private.record_attempt_event(attempt.id, 'resumed');
  elsif attempt.status not in ('in_progress','pending_review','graded') then
    raise exception 'Attempt cannot be resumed';
  end if;

  return public.get_assessment_attempt(attempt.id);
end;
$$;

create or replace function public.submit_assessment_attempt(target_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform private.expire_assessment_attempt(target_attempt);

  if exists (
    select 1 from public.assessment_attempts
    where id = target_attempt and status in ('submitted','auto_submitted','pending_review','graded')
  ) then
    return private.grade_and_close_assessment_attempt(target_attempt, 'submitted');
  end if;

  return private.grade_and_close_assessment_attempt(target_attempt, 'submitted');
end;
$$;

create or replace function private.auto_submit_expired_assessment_attempts(
  target_assessment uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_id uuid;
  submitted_count integer := 0;
begin
  for candidate_id in
    select attempt.id
    from public.assessment_attempts as attempt
    where attempt.status in ('in_progress','paused')
      and attempt.deadline_at <= now()
      and (target_assessment is null or attempt.assessment_id = target_assessment)
    order by attempt.deadline_at
    for update skip locked
  loop
    perform private.grade_and_close_assessment_attempt(candidate_id, 'auto_submitted');
    submitted_count := submitted_count + 1;
  end loop;

  return submitted_count;
end;
$$;

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
    attempt.schedule_id,
    attempt.student_id,
    profile.display_name,
    attempt.classroom_id,
    classroom.name,
    booklet.code,
    attempt.status,
    attempt.submission_kind,
    count(response.id) filter (where response.answer <> '{}'::jsonb),
    count(item.id),
    round(
      count(response.id) filter (where response.answer <> '{}'::jsonb) * 100.0
      / nullif(count(item.id), 0),
      2
    ),
    attempt.started_at,
    attempt.last_activity_at,
    attempt.deadline_at,
    case
      when attempt.deadline_at is null then null
      else greatest(0, floor(extract(epoch from (attempt.deadline_at - now())))::integer)
    end,
    count(*) over ()
  from public.assessment_attempts as attempt
  join public.profiles as profile on profile.id = attempt.student_id
  join public.classrooms as classroom on classroom.id = attempt.classroom_id
  join public.assessment_booklets as booklet on booklet.id = attempt.booklet_id
  join public.assessment_attempt_items as item on item.attempt_id = attempt.id
  left join public.assessment_responses as response on response.attempt_item_id = item.id
  where attempt.assessment_id = assessment.id
    and private.has_permission('assessment.apply', attempt.network_id, attempt.school_id)
  group by attempt.id, profile.id, classroom.id, booklet.id
  order by classroom.name, profile.display_name, attempt.id
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

create or replace function public.list_pending_essay_responses(
  target_assessment uuid,
  page_size integer default 50,
  page_offset integer default 0
)
returns table(
  response_id uuid,
  attempt_id uuid,
  student_id uuid,
  student_name text,
  classroom_name text,
  question_position integer,
  statement text,
  response_text text,
  max_points numeric,
  points_awarded numeric,
  reviewer_comment text,
  review_status text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assessment public.diagnostic_assessments%rowtype;
begin
  select * into assessment from public.diagnostic_assessments where id = target_assessment;
  if assessment.id is null or not private.has_permission('assessment.apply', assessment.network_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    response.id,
    attempt.id,
    attempt.student_id,
    profile.display_name,
    classroom.name,
    item.position,
    item.snapshot ->> 'statement',
    response.answer ->> 'text',
    item.max_points,
    response.points_awarded,
    response.reviewer_comment,
    response.review_status,
    count(*) over ()
  from public.assessment_responses as response
  join public.assessment_attempt_items as item on item.id = response.attempt_item_id
  join public.assessment_attempts as attempt on attempt.id = response.attempt_id
  join public.profiles as profile on profile.id = attempt.student_id
  join public.classrooms as classroom on classroom.id = attempt.classroom_id
  where attempt.assessment_id = assessment.id
    and item.snapshot ->> 'item_type' = 'essay'
    and private.has_permission('assessment.apply', attempt.network_id, attempt.school_id)
  order by response.review_status = 'pending' desc, classroom.name, profile.display_name, item.position
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

create or replace function public.review_essay_response(
  target_response uuid,
  awarded_points numeric,
  review_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response public.assessment_responses%rowtype;
  item public.assessment_attempt_items%rowtype;
  attempt public.assessment_attempts%rowtype;
  remaining integer;
  total_awarded numeric(10,2);
begin
  select * into response
  from public.assessment_responses
  where id = target_response
  for update;

  select * into item from public.assessment_attempt_items where id = response.attempt_item_id;
  select * into attempt from public.assessment_attempts where id = response.attempt_id for update;

  if response.id is null
    or item.snapshot ->> 'item_type' <> 'essay'
    or attempt.status not in ('pending_review','graded')
    or not private.has_permission('assessment.apply', attempt.network_id, attempt.school_id)
  then
    raise exception 'Not authorized';
  end if;

  if awarded_points < 0 or awarded_points > item.max_points then
    raise exception 'Essay score is outside allowed range';
  end if;

  update public.assessment_responses
  set points_awarded = awarded_points,
      review_status = 'reviewed',
      reviewer_comment = nullif(trim(review_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      saved_at = now()
  where id = response.id;

  select
    count(*) filter (where candidate.review_status = 'pending'),
    coalesce(sum(candidate.points_awarded), 0)
  into remaining, total_awarded
  from public.assessment_responses as candidate
  where candidate.attempt_id = attempt.id;

  update public.assessment_attempts
  set status = case when remaining = 0 then 'graded' else 'pending_review' end,
      score = total_awarded,
      updated_at = now()
  where id = attempt.id;

  if remaining = 0 and attempt.status <> 'graded' then
    perform private.record_attempt_event(attempt.id, 'graded');
  end if;

  return jsonb_build_object(
    'attempt_id', attempt.id,
    'status', case when remaining = 0 then 'graded' else 'pending_review' end,
    'score', total_awarded,
    'max_score', attempt.max_score,
    'remaining_reviews', remaining
  );
end;
$$;

create or replace function public.manage_assessment_attempt(
  target_attempt uuid,
  target_action text,
  action_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.assessment_attempts%rowtype;
  next_status text;
begin
  select * into attempt
  from public.assessment_attempts
  where id = target_attempt
  for update;

  if attempt.id is null or not private.staff_can_access_attempt(attempt.id) then
    raise exception 'Not authorized';
  end if;

  if target_action in ('cancel','invalidate','reopen') and char_length(trim(coalesce(action_reason, ''))) < 5 then
    raise exception 'Administrative action requires a reason';
  end if;

  if target_action = 'cancel' and attempt.status in ('scheduled','available','in_progress','paused') then
    next_status := 'cancelled';
  elsif target_action = 'invalidate' and attempt.status in ('submitted','auto_submitted','pending_review','graded') then
    next_status := 'invalidated';
  elsif target_action = 'reopen' and attempt.status in ('cancelled','invalidated') then
    if not exists (
      select 1
      from public.assessment_schedules as schedule
      where schedule.id = attempt.schedule_id
        and schedule.status in ('scheduled','active')
        and now() between schedule.starts_at and schedule.ends_at
    ) then
      raise exception 'Attempt cannot be reopened outside its active schedule';
    end if;
    delete from private.assessment_response_operations where attempt_id = attempt.id;
    delete from public.assessment_responses where attempt_id = attempt.id;
    update public.assessment_attempts
    set status = 'available',
        submission_kind = null,
        access_origin = 'staff',
        started_at = null,
        deadline_at = null,
        last_activity_at = null,
        submitted_at = null,
        closed_at = null,
        score = null,
        current_position = 1,
        access_token_hash = null,
        token_expires_at = null,
        token_failed_attempts = 0,
        token_locked_until = null,
        updated_at = now()
    where id = attempt.id;
    perform private.record_attempt_event(attempt.id, 'reopened', action_reason);
    return jsonb_build_object('attempt_id', attempt.id, 'status', 'available');
  elsif target_action = 'close' and attempt.status in ('in_progress','paused') then
    return private.grade_and_close_assessment_attempt(attempt.id, 'submitted');
  else
    raise exception 'Invalid attempt transition';
  end if;

  update public.assessment_attempts
  set status = next_status,
      closed_at = now(),
      access_token_hash = null,
      token_expires_at = null,
      updated_at = now()
  where id = attempt.id;

  perform private.record_attempt_event(
    attempt.id,
    case when next_status = 'cancelled' then 'cancelled' else 'invalidated' end,
    action_reason
  );

  return jsonb_build_object('attempt_id', attempt.id, 'status', next_status);
end;
$$;

create or replace function public.list_assessment_attempt_events(target_attempt uuid)
returns table(
  event_id bigint,
  event_type text,
  actor_id uuid,
  actor_name text,
  reason text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.staff_can_access_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    event.id,
    event.event_type,
    event.actor_id,
    profile.display_name,
    event.reason,
    event.metadata,
    event.created_at
  from public.assessment_attempt_events as event
  left join public.profiles as profile on profile.id = event.actor_id
  where event.attempt_id = target_attempt
  order by event.created_at, event.id;
end;
$$;

alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_items enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_attempt_events enable row level security;

create or replace function private.can_read_attempt_item_image(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
begin
  v_parts := storage.foldername(object_name);
  if coalesce(array_length(v_parts, 1), 0) <> 2 then
    return false;
  end if;

  begin
    perform v_parts[1]::uuid;
    perform v_parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from public.assessment_attempt_items as attempt_item
    join public.assessment_attempts as attempt on attempt.id = attempt_item.attempt_id
    where attempt.student_id = (select auth.uid())
      and attempt.network_id = v_parts[1]::uuid
      and private.student_owns_active_attempt(attempt.id)
      and coalesce(attempt_item.snapshot -> 'image_paths', '[]'::jsonb) ? object_name
      and attempt.status not in ('cancelled','invalidated')
  );
end;
$$;

drop policy if exists assessment_item_images_read on storage.objects;
create policy assessment_item_images_read on storage.objects
for select to authenticated
using (
  storage.objects.bucket_id = 'assessment-item-images'
  and (
    private.can_use_item_image(storage.objects.name, false)
    or private.can_read_attempt_item_image(storage.objects.name)
  )
);

create policy assessment_attempts_read on public.assessment_attempts
for select to authenticated
using (
  private.student_owns_active_attempt(assessment_attempts.id)
  or private.staff_can_access_attempt(assessment_attempts.id)
);

create policy assessment_attempt_items_staff_read on public.assessment_attempt_items
for select to authenticated
using (private.staff_can_access_attempt(assessment_attempt_items.attempt_id));

create policy assessment_responses_read on public.assessment_responses
for select to authenticated
using (
  private.student_owns_active_attempt(assessment_responses.attempt_id)
  or private.staff_can_access_attempt(assessment_responses.attempt_id)
);

create policy assessment_attempt_events_read on public.assessment_attempt_events
for select to authenticated
using (
  private.student_owns_active_attempt(assessment_attempt_events.attempt_id)
  or private.staff_can_access_attempt(assessment_attempt_events.attempt_id)
);

revoke all on public.assessment_attempts from public, anon, authenticated;
revoke all on public.assessment_attempt_items from public, anon, authenticated;
revoke all on public.assessment_responses from public, anon, authenticated;
revoke all on public.assessment_attempt_events from public, anon, authenticated;
revoke all on private.assessment_response_operations from public, anon, authenticated;

grant select (
  id, assessment_id, schedule_id, classroom_id, student_id, booklet_id,
  network_id, school_id, status, submission_kind, access_origin,
  allowed_minutes, current_position, created_at, started_at, deadline_at,
  last_activity_at, submitted_at, closed_at, score, max_score, updated_at
) on public.assessment_attempts to authenticated;
grant select on public.assessment_responses, public.assessment_attempt_events to authenticated;

revoke all on function private.student_owns_active_attempt(uuid) from public, anon, authenticated;
revoke all on function private.staff_can_access_attempt(uuid) from public, anon, authenticated;
revoke all on function private.record_attempt_event(uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function private.prepare_assessment_attempt_items(uuid) from public, anon, authenticated;
revoke all on function private.ensure_assessment_attempt(uuid,uuid) from public, anon, authenticated;
revoke all on function private.student_item_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.grade_and_close_assessment_attempt(uuid,text) from public, anon, authenticated;
revoke all on function private.expire_assessment_attempt(uuid) from public, anon, authenticated;
revoke all on function private.auto_submit_expired_assessment_attempts(uuid) from public, anon, authenticated;
revoke all on function private.can_read_attempt_item_image(text) from public, anon, authenticated;

revoke all on function public.issue_assessment_access_token(uuid,uuid,integer) from public, anon;
revoke all on function public.revoke_assessment_access_token(uuid,text) from public, anon;
revoke all on function public.list_available_assessments() from public, anon;
revoke all on function public.start_assessment_attempt(uuid,text,text) from public, anon;
revoke all on function public.get_assessment_attempt(uuid) from public, anon;
revoke all on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid) from public, anon;
revoke all on function public.set_assessment_attempt_position(uuid,integer) from public, anon;
revoke all on function public.resume_assessment_attempt(uuid) from public, anon;
revoke all on function public.submit_assessment_attempt(uuid) from public, anon;
revoke all on function public.list_assessment_attempt_monitor(uuid,integer,integer) from public, anon;
revoke all on function public.list_pending_essay_responses(uuid,integer,integer) from public, anon;
revoke all on function public.review_essay_response(uuid,numeric,text) from public, anon;
revoke all on function public.manage_assessment_attempt(uuid,text,text) from public, anon;
revoke all on function public.list_assessment_attempt_events(uuid) from public, anon;

grant execute on function public.issue_assessment_access_token(uuid,uuid,integer) to authenticated;
grant execute on function public.revoke_assessment_access_token(uuid,text) to authenticated;
grant execute on function public.list_available_assessments() to authenticated;
grant execute on function public.start_assessment_attempt(uuid,text,text) to authenticated;
grant execute on function public.get_assessment_attempt(uuid) to authenticated;
grant execute on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid) to authenticated;
grant execute on function public.set_assessment_attempt_position(uuid,integer) to authenticated;
grant execute on function public.resume_assessment_attempt(uuid) to authenticated;
grant execute on function public.submit_assessment_attempt(uuid) to authenticated;
grant execute on function public.list_assessment_attempt_monitor(uuid,integer,integer) to authenticated;
grant execute on function public.list_pending_essay_responses(uuid,integer,integer) to authenticated;
grant execute on function public.review_essay_response(uuid,numeric,text) to authenticated;
grant execute on function public.manage_assessment_attempt(uuid,text,text) to authenticated;
grant execute on function public.list_assessment_attempt_events(uuid) to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'aprende-auto-submit-assessment-attempts',
  '* * * * *',
  'select private.auto_submit_expired_assessment_attempts()'
);
