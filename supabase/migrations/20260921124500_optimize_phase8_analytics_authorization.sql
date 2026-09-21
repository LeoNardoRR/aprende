-- Fase 8: keep tenant authorization in PostgreSQL while removing the nested
-- SECURITY DEFINER call that was executed once per analytics fact.
create index if not exists institutional_memberships_analytics_access_idx
  on public.institutional_memberships(user_id, network_id, status, role, school_id);

create or replace function private.analytics_can_access_attempt(target_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = target_attempt
      and auth.uid() is not null
      and (
        attempt.student_id = (select auth.uid())
        or exists (
          select 1
          from public.institutional_memberships membership
          where membership.user_id = (select auth.uid())
            and membership.network_id = attempt.network_id
            and membership.status = 'active'
            and (
              membership.role = 'network_admin'
              or (
                membership.role = 'manager'
                and membership.school_id = attempt.school_id
              )
            )
        )
        or exists (
          select 1
          from public.classrooms classroom
          where classroom.id = attempt.classroom_id
            and classroom.owner_id = (select auth.uid())
            and classroom.network_id = attempt.network_id
            and classroom.school_id = attempt.school_id
        )
      )
  );
$$;

revoke all on function private.analytics_can_access_attempt(uuid) from public, anon;
grant execute on function private.analytics_can_access_attempt(uuid) to authenticated;
