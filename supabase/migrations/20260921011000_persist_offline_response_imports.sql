-- Persistência transacional da importação offline no runtime de avaliações.
alter table public.offline_response_imports
  add column created_count integer not null default 0 check (created_count >= 0),
  add column updated_count integer not null default 0 check (updated_count >= 0),
  add column skipped_count integer not null default 0 check (skipped_count >= 0),
  add column rejected_count integer not null default 0 check (rejected_count >= 0);

create function public.get_offline_import_catalog(target_assessment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (
    select 1 from public.diagnostic_assessments a
    where a.id = target_assessment
      and private.has_permission('offline_import.manage', a.network_id)
  ) then raise exception 'Not authorized'; end if;

  select jsonb_build_object(
    'assessmentId', target_assessment,
    'studentIds', coalesce((select jsonb_agg(distinct t.student_id)
      from public.assessment_attempts t where t.assessment_id = target_assessment
        and private.has_permission('offline_import.manage', t.network_id, t.school_id)), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(question order by question ->> 'id') from (
      select distinct jsonb_build_object(
        'id', bi.assessment_item_id,
        'type', ai.snapshot ->> 'item_type',
        'optionIds', coalesce((select jsonb_agg(o.value ->> 'id')
          from jsonb_array_elements(coalesce(ai.snapshot -> 'options', '[]'::jsonb)) o(value)), '[]'::jsonb),
        'optionLabels', coalesce((select jsonb_agg(coalesce(o.value ->> 'label', chr(64 + o.ordinality::integer)))
          from jsonb_array_elements(coalesce(ai.snapshot -> 'options', '[]'::jsonb)) with ordinality o(value, ordinality)), '[]'::jsonb)
      ) question
      from public.assessment_attempts t
      join public.assessment_attempt_items ai on ai.attempt_id = t.id
      join public.assessment_booklet_items bi on bi.id = ai.source_booklet_item_id
      where t.assessment_id = target_assessment
        and private.has_permission('offline_import.manage', t.network_id, t.school_id)
    ) q), '[]'::jsonb),
    'existingResponses', coalesce((select jsonb_agg(jsonb_build_object(
      'assessmentId', t.assessment_id, 'studentId', t.student_id,
      'questionId', bi.assessment_item_id,
      'answer', coalesce(r.answer ->> 'option_id', r.answer ->> 'text', '')
    ))
      from public.assessment_attempts t
      join public.assessment_attempt_items ai on ai.attempt_id = t.id
      join public.assessment_booklet_items bi on bi.id = ai.source_booklet_item_id
      join public.assessment_responses r on r.attempt_item_id = ai.id
      where t.assessment_id = target_assessment and r.answer <> '{}'::jsonb
        and private.has_permission('offline_import.manage', t.network_id, t.school_id)), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.commit_offline_response_import(
  target_network uuid,
  target_assessment uuid,
  source_filename text,
  source_fingerprint text,
  preview_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid()); batch public.offline_response_imports%rowtype;
  row_data jsonb; target_attempt uuid; target_item uuid; item_snapshot jsonb;
  normalized_answer jsonb; row_status text; issue text; line_number integer;
  decision text; student uuid; question uuid; raw_answer text;
  created_rows integer := 0; updated_rows integer := 0; skipped_rows integer := 0; rejected_rows integer := 0;
  conflicts integer := 0; existing_response uuid;
begin
  if actor is null or not private.has_permission('offline_import.manage', target_network) then
    raise exception 'Not authorized';
  end if;
  if source_fingerprint !~ '^[a-f0-9]{64}$' or char_length(source_filename) not between 1 and 255
     or jsonb_typeof(preview_rows) <> 'array' or jsonb_array_length(preview_rows) not between 1 and 5000 then
    raise exception 'Invalid import payload';
  end if;
  if not exists (select 1 from public.diagnostic_assessments a
    where a.id = target_assessment and a.network_id = target_network) then
    raise exception 'Assessment outside network scope';
  end if;

  insert into public.offline_response_imports(
    network_id, assessment_id, file_name, content_hash, status, row_count, created_by
  ) values (target_network, target_assessment, source_filename, source_fingerprint,
    'validated', jsonb_array_length(preview_rows), actor)
  on conflict (network_id, assessment_id, content_hash) do nothing returning * into batch;
  if batch.id is null then
    select * into batch from public.offline_response_imports
      where network_id = target_network and assessment_id = target_assessment
        and content_hash = source_fingerprint for update;
    if batch.status = 'committed' then
      return jsonb_build_object('status','already_imported','batchId',batch.id,
        'created',batch.created_count,'updated',batch.updated_count,
        'skipped',batch.skipped_count,'rejected',batch.rejected_count);
    end if;
    raise exception 'Import with this fingerprint is already being processed';
  end if;

  for row_data in select value from jsonb_array_elements(preview_rows) loop
    line_number := (row_data ->> 'line')::integer;
    decision := upper(coalesce(row_data ->> 'decision', 'SKIP'));
    raw_answer := coalesce(row_data ->> 'answer', '');
    issue := null;
    begin student := (row_data ->> 'studentId')::uuid; exception when others then student := null; end;
    begin question := (row_data ->> 'questionId')::uuid; exception when others then question := null; end;
    if coalesce((row_data ->> 'valid')::boolean, false) = false or student is null or question is null then
      issue := 'invalid_preview_row';
    elsif (row_data ->> 'assessmentId')::uuid is distinct from target_assessment then
      issue := 'assessment_not_found';
    elsif decision not in ('CREATE','UPDATE','SKIP') then issue := 'invalid_decision';
    end if;

    select t.id, ai.id, ai.snapshot into target_attempt, target_item, item_snapshot
    from public.assessment_attempts t
    join public.assessment_attempt_items ai on ai.attempt_id = t.id
    join public.assessment_booklet_items bi on bi.id = ai.source_booklet_item_id
    where t.assessment_id = target_assessment and t.student_id = student
      and t.network_id = target_network and bi.assessment_item_id = question
      and t.status not in ('cancelled','invalidated')
    order by t.created_at desc limit 1;
    if issue is null and target_attempt is null then issue := 'student_or_question_not_found'; end if;
    if target_attempt is not null and not exists (
      select 1 from public.assessment_attempts t where t.id = target_attempt
        and private.has_permission('offline_import.manage', t.network_id, t.school_id)
    ) then raise exception 'Attempt outside authorized school scope'; end if;
    if issue is null and item_snapshot ->> 'item_type' in ('multiple_choice','true_false') then
      select jsonb_build_object('option_id', o.value ->> 'id') into normalized_answer
      from jsonb_array_elements(coalesce(item_snapshot -> 'options','[]'::jsonb)) with ordinality o(value, ordinality)
      where o.value ->> 'id' = raw_answer
        or upper(coalesce(o.value ->> 'label', chr(64 + o.ordinality::integer))) = upper(raw_answer)
      limit 1;
      if normalized_answer is null then issue := 'invalid_answer'; end if;
    elsif issue is null and item_snapshot ->> 'item_type' = 'essay' then
      if char_length(raw_answer) > 20000 then issue := 'invalid_answer';
      else normalized_answer := jsonb_build_object('text', raw_answer); end if;
    end if;

    select r.id into existing_response from public.assessment_responses r where r.attempt_item_id = target_item;
    if issue is not null then row_status := 'invalid'; rejected_rows := rejected_rows + 1;
    elsif decision = 'SKIP' then row_status := 'duplicate'; skipped_rows := skipped_rows + 1;
    elsif decision = 'CREATE' and existing_response is not null then
      raise exception 'Line % conflicts with an existing response', line_number;
    else
      if existing_response is null then created_rows := created_rows + 1;
      else updated_rows := updated_rows + 1; conflicts := conflicts + 1; end if;
      insert into public.assessment_responses(attempt_id, attempt_item_id, answer, review_status)
      values (target_attempt, target_item, normalized_answer,
        case when item_snapshot ->> 'item_type' = 'essay' then 'pending' else 'not_required' end)
      on conflict (attempt_item_id) do update set answer = excluded.answer,
        revision = public.assessment_responses.revision + 1, is_correct = null,
        points_awarded = null, review_status = excluded.review_status,
        reviewer_comment = null, reviewed_by = null, reviewed_at = null, saved_at = now();
      row_status := case when existing_response is null then 'valid' else 'conflict' end;
    end if;
    insert into public.offline_response_import_rows(import_id,row_number,student_id,assessment_item_id,answer,row_status,error_code)
      values (batch.id,line_number,student,question,normalized_answer,row_status,issue);
    target_attempt := null; target_item := null; item_snapshot := null; normalized_answer := null; existing_response := null;
  end loop;

  update public.offline_response_imports set status='committed', committed_at=now(),
    valid_count=created_rows+updated_rows, conflict_count=conflicts, error_count=rejected_rows,
    created_count=created_rows, updated_count=updated_rows, skipped_count=skipped_rows,
    rejected_count=rejected_rows,
    validation_errors=jsonb_build_object('rejected',rejected_rows)
  where id=batch.id;
  insert into public.audit_logs(network_id,actor_id,entity_type,entity_id,action,metadata)
    values(target_network,actor,'offline_response_import',batch.id,'committed',
      jsonb_build_object('created',created_rows,'updated',updated_rows,'skipped',skipped_rows,'rejected',rejected_rows));
  return jsonb_build_object('status','imported','batchId',batch.id,'created',created_rows,
    'updated',updated_rows,'skipped',skipped_rows,'rejected',rejected_rows);
end $$;

revoke all on function public.get_offline_import_catalog(uuid) from public, anon;
revoke all on function public.commit_offline_response_import(uuid,uuid,text,text,jsonb) from public, anon;
grant execute on function public.get_offline_import_catalog(uuid) to authenticated;
grant execute on function public.commit_offline_response_import(uuid,uuid,text,text,jsonb) to authenticated;
