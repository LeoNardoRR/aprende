-- Fluxo editorial da Fase 7: autor envia, revisor assina e aprovador publica.
insert into private.permissions(key,description)
values ('pedagogy.approve','Aprovar e publicar recursos e jornadas pedagógicas')
on conflict(key) do nothing;
insert into private.role_permissions(role,permission_key)
values ('network_admin','pedagogy.approve'),('approver','pedagogy.approve')
on conflict do nothing;

create or replace function public.transition_pedagogical_resource(target_resource uuid,target_status text,change_summary text default null)
returns public.pedagogical_resources language plpgsql security definer set search_path='' as $$
declare resource public.pedagogical_resources; next_version integer;
begin
  select * into resource from public.pedagogical_resources where id=target_resource for update;
  if resource.id is null then raise exception 'Resource not found'; end if;
  if target_status='review' and resource.status='draft' and resource.author_id=auth.uid() then null;
  elsif target_status='review' and resource.status='review' and resource.author_id<>auth.uid() and private.has_permission('pedagogy.review',resource.network_id) then null;
  elsif target_status='approved' and resource.status='review' and resource.reviewed_by is not null and resource.author_id<>auth.uid() and resource.reviewed_by<>auth.uid() and private.has_permission('pedagogy.approve',resource.network_id) then null;
  elsif target_status='published' and resource.status='approved' and private.has_permission('pedagogy.approve',resource.network_id) then null;
  elsif target_status='archived' and resource.status='published' and private.has_permission('pedagogy.approve',resource.network_id) then null;
  else raise exception 'Not authorized transition'; end if;
  next_version:=resource.current_version+1;
  if target_status='published' then
    insert into public.pedagogical_resource_versions(resource_id,version_number,snapshot,change_summary,created_by)
    values(resource.id,next_version,to_jsonb(resource)-'updated_at',change_summary,auth.uid());
  end if;
  update public.pedagogical_resources set status=target_status,reviewed_by=case when target_status='review' and resource.status='review' then auth.uid() else reviewed_by end,approved_by=case when target_status='approved' then auth.uid() else approved_by end,published_at=case when target_status='published' then now() else published_at end,current_version=case when target_status='published' then next_version else current_version end,updated_at=now() where id=resource.id returning * into resource;
  return resource;
end; $$;

create or replace function public.transition_learning_journey(target_journey uuid,target_status text)
returns public.learning_journeys language plpgsql security definer set search_path='' as $$
declare journey public.learning_journeys; next_version integer;
begin
  select * into journey from public.learning_journeys where id=target_journey for update;
  if journey.id is null then raise exception 'Journey not found'; end if;
  if target_status='review' and journey.status='draft' and journey.created_by=auth.uid() then null;
  elsif target_status='review' and journey.status='review' and journey.created_by<>auth.uid() and private.has_permission('pedagogy.review',journey.network_id) then null;
  elsif target_status='approved' and journey.status='review' and journey.reviewed_by is not null and journey.created_by<>auth.uid() and journey.reviewed_by<>auth.uid() and private.has_permission('pedagogy.approve',journey.network_id) then null;
  elsif target_status='published' and journey.status='approved' and private.has_permission('pedagogy.approve',journey.network_id) then null;
  elsif target_status='archived' and journey.status='published' and private.has_permission('pedagogy.approve',journey.network_id) then null;
  else raise exception 'Not authorized transition'; end if;
  if target_status='published' and not exists(select 1 from public.learning_journey_steps s where s.journey_id=journey.id) then raise exception 'Journey requires steps'; end if;
  next_version:=journey.current_version+1;
  if target_status='published' then
    insert into public.learning_journey_versions(journey_id,version_number,snapshot,created_by)
    select journey.id,next_version,jsonb_build_object('journey',to_jsonb(journey)-'updated_at','steps',coalesce(jsonb_agg(to_jsonb(s) order by s.position),'[]'::jsonb)),auth.uid()
    from public.learning_journey_steps s where s.journey_id=journey.id;
  end if;
  update public.learning_journeys set status=target_status,reviewed_by=case when target_status='review' and journey.status='review' then auth.uid() else reviewed_by end,approved_by=case when target_status='approved' then auth.uid() else approved_by end,published_at=case when target_status='published' then now() else published_at end,current_version=case when target_status='published' then current_version+1 else current_version end,updated_at=now() where id=journey.id returning * into journey;
  return journey;
end; $$;
