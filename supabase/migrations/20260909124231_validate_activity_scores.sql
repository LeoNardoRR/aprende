create or replace function public.grade_submission(target_submission uuid, new_score numeric, new_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare maximum_points integer;
begin
  select a.points into maximum_points
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.classrooms c on c.id = a.classroom_id
  where s.id = target_submission
    and s.status = 'submitted'
    and c.owner_id = auth.uid();

  if maximum_points is null then
    raise exception 'Submission not found or not authorized';
  end if;

  if new_score < 0 or new_score > maximum_points then
    raise exception 'Score must be between 0 and %', maximum_points;
  end if;

  update public.submissions
  set score = new_score,
      feedback = nullif(trim(new_feedback), ''),
      updated_at = now()
  where id = target_submission;
end;
$$;

revoke all on function public.grade_submission(uuid, numeric, text) from public, anon;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;
