-- Existing assignments remain tasks. Only classroom teachers can create or
-- update assignments under the existing RLS policies.
alter table public.assignments
add column if not exists kind text not null default 'task'
check (kind in ('task', 'exam'));
