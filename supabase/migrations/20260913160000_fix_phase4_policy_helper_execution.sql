-- Policies execute as the querying role and therefore require EXECUTE on the
-- boolean helpers they invoke. These SECURITY DEFINER helpers return only an
-- authorization decision derived from auth.uid(); they expose no row data.
grant execute on function private.student_owns_active_attempt(uuid) to authenticated;
grant execute on function private.staff_can_access_attempt(uuid) to authenticated;
grant execute on function private.can_read_attempt_item_image(text) to authenticated;

comment on function private.student_owns_active_attempt(uuid) is
  'RLS helper exposed to authenticated callers; returns only whether auth.uid() owns the active attempt.';
comment on function private.staff_can_access_attempt(uuid) is
  'RLS helper exposed to authenticated callers; returns only a scoped assessment.apply authorization decision.';
comment on function private.can_read_attempt_item_image(text) is
  'Storage RLS helper exposed to authenticated callers; returns only whether an active owned attempt references the private image path.';
