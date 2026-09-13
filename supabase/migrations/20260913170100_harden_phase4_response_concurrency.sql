-- Require optimistic concurrency for browser saves. The original five-argument
-- function remains private to the database so existing migration history is not
-- rewritten; authenticated clients can call only this guarded overload.
create or replace function public.save_assessment_response(
  target_attempt uuid,
  target_attempt_item uuid,
  response_payload jsonb,
  mark_for_review boolean,
  idempotency_key uuid,
  expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_operation private.assessment_response_operations%rowtype;
  current_revision integer;
begin
  if idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if not private.student_owns_active_attempt(target_attempt) then
    raise exception 'Not authorized';
  end if;

  perform 1
  from public.assessment_attempts as attempt
  where attempt.id = target_attempt
  for update;

  select * into existing_operation
  from private.assessment_response_operations as operation
  where operation.attempt_id = target_attempt
    and operation.idempotency_key = save_assessment_response.idempotency_key;

  if existing_operation.attempt_id is not null then
    return public.save_assessment_response(
      target_attempt,
      target_attempt_item,
      response_payload,
      mark_for_review,
      idempotency_key
    );
  end if;

  if expected_revision is null or expected_revision < 0 then
    raise exception 'Expected revision is required';
  end if;

  select response.revision into current_revision
  from public.assessment_responses as response
  where response.attempt_id = target_attempt
    and response.attempt_item_id = target_attempt_item
  for update;

  if coalesce(current_revision, 0) <> expected_revision then
    raise exception 'Response revision conflict: expected %, current %',
      expected_revision,
      coalesce(current_revision, 0)
      using errcode = '40001';
  end if;

  return public.save_assessment_response(
    target_attempt,
    target_attempt_item,
    response_payload,
    mark_for_review,
    idempotency_key
  );
end;
$$;

revoke all on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid) from authenticated;
revoke all on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid,integer) from public, anon;
grant execute on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid,integer) to authenticated;

comment on function public.save_assessment_response(uuid,uuid,jsonb,boolean,uuid,integer) is
  'Idempotent autosave with optimistic revision control; stale tabs receive SQLSTATE 40001 instead of overwriting a newer answer.';
