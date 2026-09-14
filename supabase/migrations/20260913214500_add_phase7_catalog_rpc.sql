-- Fase 7: catálogo enxuto para as interfaces pedagógicas.

create or replace function public.list_pedagogical_catalog(
  target_network uuid,
  target_skill uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
    or not private.has_permission('pedagogy.read', target_network)
  then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'journeys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'description', j.description,
        'skill_id', j.skill_id,
        'difficulty', j.difficulty,
        'estimated_minutes', j.estimated_minutes,
        'mastery_threshold', j.mastery_threshold,
        'step_count', (select count(*) from public.learning_journey_steps s where s.journey_id = j.id)
      ) order by j.title)
      from public.learning_journeys j
      where j.network_id = target_network
        and j.status = 'published'
        and (target_skill is null or j.skill_id = target_skill)
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'resource_type', r.resource_type,
        'skill_id', r.skill_id,
        'estimated_minutes', r.estimated_minutes,
        'source_name', r.source_name
      ) order by r.title)
      from public.pedagogical_resources r
      where r.network_id = target_network
        and r.status = 'published'
        and (target_skill is null or r.skill_id = target_skill)
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.list_pedagogical_catalog(uuid, uuid) from public, anon;
grant execute on function public.list_pedagogical_catalog(uuid, uuid) to authenticated;

-- Equidade é uma leitura consolidada da rede; gestores escolares não recebem
-- esse grant até existir uma RPC explicitamente limitada à escola.
delete from private.role_permissions
where role = 'manager' and permission_key = 'equity.read';

create or replace function public.get_equity_summary(target_network uuid,target_assessment uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.has_permission('equity.read', target_network) then
    raise exception 'Not authorized';
  end if;
  select jsonb_build_object(
    'state',case when count(*)=0 then 'empty' else 'success' end,
    'methodology','Evolução observada por grupo configurável; não representa fórmula oficial VAAR.',
    'groups',coalesce(jsonb_agg(jsonb_build_object(
      'group_id',g.id,'name',g.name,'minimum_group_size',g.minimum_group_size,
      'students',stats.students,
      'percentage',case when stats.students>=g.minimum_group_size then stats.percentage end,
      'suppressed',stats.students<g.minimum_group_size
    )),'[]'::jsonb)
  ) into result
  from public.equity_group_definitions g
  left join lateral (
    select count(distinct f.student_id)::integer students,round(avg(f.percentage),2) percentage
    from private.analytics_attempt_facts f
    join public.equity_group_members m on m.student_id=f.student_id and m.group_id=g.id
    where f.network_id=target_network and f.percentage is not null
      and (target_assessment is null or f.assessment_id=target_assessment)
  ) stats on true
  where g.network_id=target_network and g.active;
  return coalesce(result,jsonb_build_object('state','empty','groups','[]'::jsonb));
end; $$;

create or replace function public.request_ai_pedagogical_suggestion(target_network uuid,suggestion_type text,structured_prompt jsonb,generated_content jsonb,provider text default null,model text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare suggestion_id uuid;
begin
  if not private.has_permission('pedagogy.manage',target_network)
    or jsonb_typeof(structured_prompt)<>'object'
    or jsonb_typeof(generated_content)<>'object'
    or structured_prompt::text ~* '"(student_name|student_email|cpf|rg|ra)"[[:space:]]*:'
  then raise exception 'Not authorized or sensitive prompt'; end if;
  insert into public.ai_pedagogical_suggestions(network_id,suggestion_type,structured_prompt,generated_content,provider,model,requested_by)
  values(target_network,suggestion_type,structured_prompt,generated_content,provider,model,auth.uid()) returning id into suggestion_id;
  return suggestion_id;
end; $$;

