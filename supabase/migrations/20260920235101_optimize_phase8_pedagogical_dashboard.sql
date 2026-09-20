-- Evita executar a verificação institucional por estudante quando um
-- administrador de rede já foi autorizado uma única vez para a rede filtrada.
create or replace function public.get_pedagogical_dashboard(filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  result jsonb;
  requested_network uuid := nullif(filters->>'network_id','')::uuid;
  full_network_access boolean := false;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if requested_network is not null then
    full_network_access := private.has_permission('network.manage', requested_network);
  end if;

  if full_network_access then
    with scoped as (
      select a.id,a.network_id,a.school_id,a.classroom_id,r.student_id,
        r.status student_status,r.progress_percentage,r.gamification_points,
        j.title,j.skill_id
      from public.learning_journey_assignments a
      join public.learning_journey_students r on r.assignment_id=a.id
      join public.learning_journeys j on j.id=a.journey_id
      where a.network_id=requested_network
        and (filters->>'school_id' is null or a.school_id=(filters->>'school_id')::uuid)
        and (filters->>'classroom_id' is null or a.classroom_id=(filters->>'classroom_id')::uuid)
        and (filters->>'student_id' is null or r.student_id=(filters->>'student_id')::uuid)
        and (filters->>'skill_id' is null or j.skill_id=(filters->>'skill_id')::uuid)
    )
    select jsonb_build_object(
      'state',case when count(*)=0 then 'empty' else 'success' end,
      'summary',jsonb_build_object(
        'students',count(distinct student_id),'assignments',count(*),
        'in_progress',count(*) filter(where student_status='in_progress'),
        'completed',count(*) filter(where student_status='completed'),
        'average_progress',case when count(*)=0 then null else round(avg(progress_percentage),2) end,
        'gamification_points',coalesce(sum(gamification_points),0)),
      'students',coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id',id,'student_id',student_id,'journey',title,
        'skill_id',skill_id,'status',student_status,
        'progress_percentage',progress_percentage,
        'gamification_points',gamification_points)),'[]'::jsonb))
    into result from scoped;
  else
    with scoped as (
      select a.id,a.network_id,a.school_id,a.classroom_id,r.student_id,
        r.status student_status,r.progress_percentage,r.gamification_points,
        j.title,j.skill_id
      from public.learning_journey_assignments a
      join public.learning_journey_students r on r.assignment_id=a.id
      join public.learning_journeys j on j.id=a.journey_id
      where private.can_access_pedagogy_scope(a.network_id,a.school_id,a.classroom_id,r.student_id)
        and (requested_network is null or a.network_id=requested_network)
        and (filters->>'school_id' is null or a.school_id=(filters->>'school_id')::uuid)
        and (filters->>'classroom_id' is null or a.classroom_id=(filters->>'classroom_id')::uuid)
        and (filters->>'student_id' is null or r.student_id=(filters->>'student_id')::uuid)
        and (filters->>'skill_id' is null or j.skill_id=(filters->>'skill_id')::uuid)
    )
    select jsonb_build_object(
      'state',case when count(*)=0 then 'empty' else 'success' end,
      'summary',jsonb_build_object(
        'students',count(distinct student_id),'assignments',count(*),
        'in_progress',count(*) filter(where student_status='in_progress'),
        'completed',count(*) filter(where student_status='completed'),
        'average_progress',case when count(*)=0 then null else round(avg(progress_percentage),2) end,
        'gamification_points',coalesce(sum(gamification_points),0)),
      'students',coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id',id,'student_id',student_id,'journey',title,
        'skill_id',skill_id,'status',student_status,
        'progress_percentage',progress_percentage,
        'gamification_points',gamification_points)),'[]'::jsonb))
    into result from scoped;
  end if;
  return result;
end $$;

revoke all on function public.get_pedagogical_dashboard(jsonb) from public, anon;
grant execute on function public.get_pedagogical_dashboard(jsonb) to authenticated;
