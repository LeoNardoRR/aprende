-- A student may edit a draft, but a submitted answer must remain stable for grading.
-- Teachers still grade submitted work through grade_submission because auth.uid()
-- is the teacher, not the student who owns the row.
create or replace function private.prevent_student_submitted_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.student_id = auth.uid() and old.status = 'submitted' then
    raise exception 'Submitted assignments cannot be changed';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_student_submitted_change() from public, anon, authenticated;

drop trigger if exists submissions_lock_student_after_submit on public.submissions;
create trigger submissions_lock_student_after_submit
before update on public.submissions
for each row execute function private.prevent_student_submitted_change();
