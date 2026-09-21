-- Exportação do titular sem arquivo público ou URL persistente. O pacote é
-- produzido na mesma transação em que a solicitação autorizada é concluída.
create function public.export_my_privacy_request(target_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  request_row public.privacy_requests%rowtype;
  package jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into request_row from public.privacy_requests
    where id = target_request for update;
  if request_row.id is null or request_row.requester_id <> actor
     or request_row.request_type <> 'export' or request_row.status <> 'authorized' then
    raise exception 'Export request is not authorized for this user';
  end if;

  select jsonb_build_object(
    'schema_version', 1,
    'request_id', request_row.id,
    'generated_at', now(),
    'subject_id', actor,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = actor),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = actor),
    'classroom_memberships', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.memberships m where m.user_id = actor),
    'institutional_memberships', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.institutional_memberships m where m.user_id = actor),
    'student_enrollments', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      from public.student_enrollments e where e.student_id = actor),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.attendance a where a.student_id = actor),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      from public.submissions s where s.student_id = actor),
    'assessment_attempts', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.assessment_attempts a where a.student_id = actor),
    'assessment_responses', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.assessment_responses r
      join public.assessment_attempts a on a.id = r.attempt_id
      where a.student_id = actor),
    'legal_acceptances', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.legal_acceptances a where a.user_id = actor),
    'privacy_requests', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.privacy_requests r where r.requester_id = actor),
    'support_tickets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from public.support_tickets t where t.requester_id = actor),
    'support_messages', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.support_messages m
      join public.support_tickets t on t.id = m.ticket_id
      where t.requester_id = actor and m.visibility = 'public')
  ) into package;

  update public.privacy_requests
    set status = 'completed', completed_at = now(), updated_at = now(),
        resolution = 'Pacote estruturado entregue diretamente ao titular autenticado.'
    where id = request_row.id;
  insert into public.audit_logs(network_id, actor_id, entity_type, entity_id, action, metadata)
    values (request_row.network_id, actor, 'privacy_request', request_row.id,
      'subject_export_delivered', jsonb_build_object('schema_version', 1));
  return package;
end $$;

revoke all on function public.export_my_privacy_request(uuid) from public, anon;
grant execute on function public.export_my_privacy_request(uuid) to authenticated;

-- Estados fechados são imutáveis e os demais avançam somente pelo fluxo
-- REQUEST -> VALIDATION -> AUTHORIZATION -> EXECUTION -> AUDIT.
create or replace function private.phase8_guard_privacy_request()
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
  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status in ('validating','cancelled')) or
    (old.status = 'validating' and new.status in ('authorized','rejected','cancelled')) or
    (old.status = 'authorized' and new.status = 'executing') or
    (old.status = 'authorized' and new.status = 'completed'
      and old.request_type = 'export' and old.requester_id = (select auth.uid())) or
    (old.status = 'executing' and new.status in ('completed','rejected'))
  ) then raise exception 'Invalid privacy request transition'; end if;
  new.updated_at = now();
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at = now(); end if;
  return new;
end $$;
