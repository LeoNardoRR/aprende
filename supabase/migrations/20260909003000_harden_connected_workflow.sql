create or replace function public.join_class_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only student accounts can join a class';
  end if;

  select id into target_id
  from public.classrooms
  where join_code = upper(trim(code));

  if target_id is null then
    raise exception 'Invalid class code';
  end if;

  insert into public.memberships (classroom_id, user_id)
  values (target_id, auth.uid())
  on conflict do nothing;

  return target_id;
end;
$$;

revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;

drop policy if exists submissions_change on public.submissions;
create policy submissions_change on public.submissions
for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()) and score is null);
