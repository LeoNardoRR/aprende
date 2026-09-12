-- Restringe campos sensíveis e cria auditoria automática de currículos.

revoke update on public.curricula from authenticated;
grant update (name, version, active, updated_at) on public.curricula to authenticated;

revoke update on public.assessment_items from authenticated;
grant update (
  curriculum_id, curriculum_school_year_id, subject_id, skill_id,
  thematic_unit_id, knowledge_object_id, internal_title, statement,
  support_text, pedagogical_comment, correct_answer_justification,
  difficulty, item_type, updated_at
) on public.assessment_items to authenticated;

create or replace function private.audit_curriculum_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(network_id, actor_id, entity_type, entity_id, action, metadata)
  values (
    new.network_id,
    auth.uid(),
    'curriculum',
    new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case when tg_op = 'INSERT'
      then jsonb_build_object('name', new.name, 'type', new.curriculum_type, 'version', new.version)
      else jsonb_build_object(
        'name', new.name, 'version', new.version, 'active', new.active,
        'changed', jsonb_build_object(
          'name', old.name is distinct from new.name,
          'version', old.version is distinct from new.version,
          'active', old.active is distinct from new.active
        )
      )
    end
  );
  return new;
end;
$$;

create trigger curricula_audit_change
after insert or update on public.curricula
for each row execute function private.audit_curriculum_change();

revoke all on function private.audit_curriculum_change() from public, anon, authenticated;
