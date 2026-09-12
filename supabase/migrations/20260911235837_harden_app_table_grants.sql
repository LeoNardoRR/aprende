-- Anonymous users do not need direct Data API access to application tables.
revoke all on table
  public.profiles,
  public.classrooms,
  public.memberships,
  public.assignments,
  public.submissions,
  public.announcements,
  public.attendance,
  public.lesson_records,
  public.lesson_materials
from anon;

-- Remove broad default privileges from signed-in users, then grant only what
-- each app flow actually needs. Security-definer RPCs keep their own grants.
revoke all on table
  public.profiles,
  public.classrooms,
  public.memberships,
  public.assignments,
  public.submissions,
  public.announcements,
  public.attendance,
  public.lesson_records,
  public.lesson_materials
from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.classrooms to authenticated;

grant select, delete on public.memberships to authenticated;

grant select, insert, update, delete on public.assignments to authenticated;

grant select on public.submissions to authenticated;
grant insert (assignment_id, student_id, answer, status, submitted_at)
  on public.submissions to authenticated;
grant update (answer, status, submitted_at, updated_at)
  on public.submissions to authenticated;

grant select, insert, delete on public.announcements to authenticated;

grant select, insert, update on public.attendance to authenticated;

grant select, insert, update, delete on public.lesson_records to authenticated;
grant select, insert, update, delete on public.lesson_materials to authenticated;
