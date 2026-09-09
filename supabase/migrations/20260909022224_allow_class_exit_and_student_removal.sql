-- Allow students to leave a class and class owners to remove a student.
-- The row predicate keeps both actions scoped to the current user's class membership.
create policy memberships_delete on public.memberships
for delete to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_class_teacher(classroom_id))
);

grant delete on public.memberships to authenticated;
