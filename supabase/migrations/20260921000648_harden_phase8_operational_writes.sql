-- Fase 8: impedir alterações de identidade/escopo e manter termos imutáveis.
-- Segurança em trigger complementa RLS (WITH CHECK não compara OLD/NEW).

create function private.phase8_reject_immutable_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Immutable record';
end $$;

create trigger legal_documents_immutable
before update or delete on public.legal_documents
for each row execute function private.phase8_reject_immutable_write();

create trigger legal_acceptances_immutable
before update or delete on public.legal_acceptances
for each row execute function private.phase8_reject_immutable_write();

drop policy if exists legal_documents_manage on public.legal_documents;
create policy legal_documents_create on public.legal_documents
for insert to authenticated
with check (published_by = (select auth.uid()) and private.has_permission('privacy.manage'));
revoke update, delete on public.legal_documents from authenticated;

create function private.phase8_guard_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.network_id is distinct from old.network_id or
    new.school_id is distinct from old.school_id or
    new.requester_id is distinct from old.requester_id or
    new.correlation_id is distinct from old.correlation_id or
    new.created_at is distinct from old.created_at
  ) then raise exception 'Ticket identity and scope are immutable'; end if;

  if new.school_id is not null and not exists (
    select 1 from public.schools s
    where s.id = new.school_id and s.network_id = new.network_id
  ) then raise exception 'School outside ticket network'; end if;

  if new.department_id is not null and not exists (
    select 1 from public.support_departments d
    where d.id = new.department_id and d.network_id = new.network_id
  ) then raise exception 'Department outside ticket network'; end if;

  if new.assignee_id is not null and not exists (
    select 1 from public.institutional_memberships m
    where m.user_id = new.assignee_id and m.network_id = new.network_id
      and m.status = 'active' and m.role in ('network_admin', 'manager')
      and (new.school_id is null or m.school_id is null or m.school_id = new.school_id)
  ) then raise exception 'Assignee is not an active support agent in scope'; end if;

  if tg_op = 'INSERT' and new.assignee_id is not null then
    raise exception 'Assignment requires an authorized update';
  end if;
  return new;
end $$;

create trigger support_ticket_guard
before insert or update on public.support_tickets
for each row execute function private.phase8_guard_ticket();

create function private.phase8_guard_support_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ticket public.support_tickets;
begin
  select * into ticket from public.support_tickets where id = new.ticket_id;
  if ticket.id is null then raise exception 'Ticket not found'; end if;
  if new.visibility = 'internal' and not (
    private.has_permission('support.agent', ticket.network_id, ticket.school_id) or
    private.has_permission('support.manage', ticket.network_id, ticket.school_id)
  ) then raise exception 'Internal notes require support role'; end if;
  return new;
end $$;

create trigger support_message_guard
before insert on public.support_messages
for each row execute function private.phase8_guard_support_message();

create function private.phase8_guard_privacy_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.requester_id is distinct from old.requester_id or
     new.network_id is distinct from old.network_id or
     new.request_type is distinct from old.request_type or
     new.details is distinct from old.details or
     new.correlation_id is distinct from old.correlation_id or
     new.created_at is distinct from old.created_at then
    raise exception 'Privacy request identity and scope are immutable';
  end if;
  if old.status in ('completed', 'rejected', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Closed privacy request cannot be reopened';
  end if;
  new.updated_at = now();
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at = now(); end if;
  return new;
end $$;

create trigger privacy_request_guard
before update on public.privacy_requests
for each row execute function private.phase8_guard_privacy_request();

revoke execute on function private.phase8_reject_immutable_write() from public, anon, authenticated;
revoke execute on function private.phase8_guard_ticket() from public, anon, authenticated;
revoke execute on function private.phase8_guard_support_message() from public, anon, authenticated;
revoke execute on function private.phase8_guard_privacy_request() from public, anon, authenticated;

-- Evita políticas permissivas duplicadas introduzidas na primeira migration.
drop policy if exists support_departments_manage on public.support_departments;
create policy support_departments_create on public.support_departments
for insert to authenticated with check (private.has_permission('support.manage', network_id));
create policy support_departments_update on public.support_departments
for update to authenticated
using (private.has_permission('support.manage', network_id))
with check (private.has_permission('support.manage', network_id));
create policy support_departments_delete on public.support_departments
for delete to authenticated using (private.has_permission('support.manage', network_id));

-- A impressão recebe um pacote montado no servidor, depois de autorizar o
-- escopo da escola. O cliente nunca escolhe versões ou gabaritos avulsos.
create function public.get_assessment_print_payload(
  target_booklet uuid, target_classroom uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'assessmentId', assessment.id,
    'assessmentTitle', assessment.title,
    'component', subject.name,
    'instructions', assessment.instructions,
    'schoolId', school.id,
    'schoolName', school.name,
    'classroomId', classroom.id,
    'classroomName', classroom.name,
    'bookletCode', booklet.code,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', link.assessment_item_id,
        'position', link.position,
        'statement', version.snapshot ->> 'statement',
        'type', version.snapshot ->> 'item_type',
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option.value ->> 'id',
            'label', option.value ->> 'label',
            'text', option.value ->> 'content',
            'correct', (option.value ->> 'is_correct')::boolean
          ) order by (option.value ->> 'sort_order')::integer, option.value ->> 'label')
          from jsonb_array_elements(coalesce(version.snapshot -> 'options', '[]'::jsonb)) option(value)
        ), '[]'::jsonb),
        'correctAnswer', (
          select option.value ->> 'label'
          from jsonb_array_elements(coalesce(version.snapshot -> 'options', '[]'::jsonb)) option(value)
          where (option.value ->> 'is_correct')::boolean limit 1
        ),
        'skillCode', skill.code,
        'skillDescription', skill.description
      ) order by link.position)
      from public.assessment_booklet_items link
      join public.assessment_item_versions version on version.id = link.assessment_item_version_id
      left join public.curriculum_skills skill on skill.id = (version.snapshot ->> 'skill_id')::uuid
      where link.booklet_id = booklet.id
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', student.id,
        'name', student.display_name,
        'institutionalId', enrollment.external_key
      ) order by student.display_name)
      from public.student_enrollments enrollment
      join public.profiles student on student.id = enrollment.student_id
      where enrollment.classroom_id = classroom.id and enrollment.status = 'enrolled'
    ), '[]'::jsonb)
  ) into result
  from public.assessment_booklets booklet
  join public.diagnostic_assessments assessment on assessment.id = booklet.assessment_id
  join public.curriculum_subjects subject on subject.id = assessment.subject_id
  join public.classrooms classroom on classroom.id = target_classroom
  join public.schools school on school.id = classroom.school_id
  where booklet.id = target_booklet
    and classroom.network_id = assessment.network_id
    and private.has_permission('assessment.apply', assessment.network_id, school.id);
  if result is null then raise exception 'Assessment print scope unavailable'; end if;
  return result;
end $$;

revoke all on function public.get_assessment_print_payload(uuid, uuid) from public, anon;
grant execute on function public.get_assessment_print_payload(uuid, uuid) to authenticated;
