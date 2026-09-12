create or replace function public.preview_student_import(target_network uuid,target_school uuid,import_rows jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; result jsonb='[]'; problems jsonb; idx integer=0; room public.classrooms%rowtype; student uuid; existing public.student_enrollments%rowtype; action text; seen_email text[]='{}'; seen_key text[]='{}'; v_email text; ext text; matches integer;
begin
 if target_school is null or not private.has_permission('enrollment.manage',target_network,target_school) or not exists(select 1 from public.schools where id=target_school and network_id=target_network) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(import_rows)<>'array' or jsonb_array_length(import_rows) not between 1 and 200 then raise exception 'Use batches of 1 to 200 rows'; end if;
 for r in select value from jsonb_array_elements(import_rows) loop
 idx=idx+1; problems='[]'; room=null; student=null; existing=null;
 v_email=lower(trim(coalesce(r->>'email',''))); ext=nullif(trim(r->>'identificador'),''); action=upper(coalesce(nullif(r->>'action',''),'CREATE'));
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(trim(coalesce(r->>'nome','')))<2 then problems=problems||jsonb_build_array('Nome/e-mail inválido'); end if;
 if action not in ('CREATE','UPDATE','SKIP') then problems=problems||jsonb_build_array('Decisão inválida'); end if;
 if v_email=any(seen_email) or (ext is not null and ext=any(seen_key)) then problems=problems||jsonb_build_array('Duplicado no arquivo'); end if;
 seen_email=array_append(seen_email,v_email); if ext is not null then seen_key=array_append(seen_key,ext); end if;
 if not exists(select 1 from public.networks where id=target_network and (r->>'rede' in (id::text,name))) or not exists(select 1 from public.schools where id=target_school and (r->>'escola' in (id::text,name,code))) then problems=problems||jsonb_build_array('Rede/escola incorreta'); end if;
 select count(*) into matches from public.classrooms c join public.academic_years y on y.id=c.academic_year_id join public.school_years g on g.id=c.school_year_id
 where c.network_id=target_network and c.school_id=target_school and c.classroom_status='active' and y.status<>'closed' and r->>'turma' in(c.id::text,c.name) and r->>'ano_letivo' in(y.id::text,y.label) and r->>'serie' in(g.id::text,g.code,g.name);
 if matches<>1 then problems=problems||jsonb_build_array('Turma/ano/série inexistente ou ambígua'); else
 select c.* into room from public.classrooms c join public.academic_years y on y.id=c.academic_year_id join public.school_years g on g.id=c.school_year_id where c.network_id=target_network and c.school_id=target_school and r->>'turma' in(c.id::text,c.name) and r->>'ano_letivo' in(y.id::text,y.label) and r->>'serie' in(g.id::text,g.code,g.name) and c.classroom_status='active' and y.status<>'closed'; end if;
 select u.id into student from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=v_email and p.role::text='student' and u.email_confirmed_at is not null
 and (exists(select 1 from public.institutional_memberships m where m.user_id=u.id and m.network_id=target_network and m.school_id=target_school and m.status='active') or (not exists(select 1 from public.institutional_memberships m where m.user_id=u.id) and not exists(select 1 from public.student_enrollments e where e.student_id=u.id)));
 if student is null then problems=problems||jsonb_build_array('Usuário não disponível no escopo; envie convite de acesso'); end if;
 if student is not null and ext is not null and exists(select 1 from public.student_enrollments e where e.network_id=target_network and e.external_key=ext and e.student_id<>student) then problems=problems||jsonb_build_array('Identificador institucional em conflito'); end if;
 select * into existing from public.student_enrollments e where e.student_id=student and e.academic_year_id=room.academic_year_id and e.status='enrolled';
 if existing.id is not null and (existing.school_id<>target_school or existing.network_id<>target_network) then problems=problems||jsonb_build_array('Matrícula fora do escopo'); end if;
 if existing.id is not null and action='CREATE' then problems=problems||jsonb_build_array('Registro já existente; escolha UPDATE ou SKIP'); end if;
 if existing.id is null and action='UPDATE' then problems=problems||jsonb_build_array('Matrícula não encontrada para UPDATE'); end if;
 result=result||jsonb_build_array(jsonb_build_object('line',idx,'email',v_email,'action',action,'valid',jsonb_array_length(problems)=0,'errors',problems,'student_id',student,'classroom_id',room.id,'academic_year_id',room.academic_year_id,'enrollment_id',existing.id,'identificador',ext));
 end loop;
 return jsonb_build_object('rows',result,'total',idx,'valid', (select count(*) from jsonb_array_elements(result) v where (v->>'valid')::boolean),'invalid',(select count(*) from jsonb_array_elements(result) v where not (v->>'valid')::boolean));
end; $$;


-- SELECT policy can evaluate the new row returned by INSERT without a nested lookup.
drop policy curricula_read on public.curricula;
create policy curricula_read on public.curricula for select to authenticated using(active and private.has_permission('curriculum.read',network_id));
create or replace function private.can_manage_classroom(target_classroom uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classrooms c where c.id=target_classroom and (
 (c.owner_id=auth.uid() and (c.network_id is null or exists(select 1 from public.institutional_memberships m where m.user_id=auth.uid() and m.network_id=c.network_id and (m.school_id is null or m.school_id=c.school_id) and m.status='active' and m.role in('teacher','manager','network_admin'))))
 or private.has_permission('classroom.manage',c.network_id,c.school_id)));
$$;
create or replace function public.set_institutional_membership(
  target_email text,
  target_network uuid,
  target_school uuid,
  target_role text,
  target_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  existing_membership uuid;
begin
  if target_status not in ('active', 'inactive') then raise exception 'Invalid status'; end if;
  if not private.can_assign_institutional_role(target_network, target_school, target_role) then
    raise exception 'Not authorized to assign this role';
  end if;
  if target_school is not null and not exists (
    select 1 from public.schools where id = target_school and network_id = target_network
  ) then raise exception 'School does not belong to network'; end if;
  if target_role in ('teacher', 'student') and target_school is null then
    raise exception 'School is required for teacher and student roles';
  end if;

  select account.id into target_user
  from auth.users account
  where lower(account.email) = lower(trim(target_email));
  if target_user is null or not exists(select 1 from auth.users u where u.id=target_user and u.email_confirmed_at is not null) or
 (exists(select 1 from public.institutional_memberships where user_id=target_user) and not exists(select 1 from public.institutional_memberships m where m.user_id=target_user and m.network_id=target_network and (target_school is null or m.school_id=target_school) and private.can_assign_institutional_role(m.network_id,m.school_id,target_role))) then raise exception 'User unavailable in scope; send an invitation'; end if;

  -- A pessoa possui um papel efetivo por escopo. O vínculo anterior permanece
  -- no histórico como inativo quando o papel é alterado.
  update public.institutional_memberships
  set status = 'inactive', updated_at = now()
  where user_id = target_user
    and network_id = target_network
    and school_id is not distinct from target_school
    and role <> target_role
    and status = 'active';

  select id into existing_membership
  from public.institutional_memberships
  where user_id = target_user
    and network_id = target_network
    and school_id is not distinct from target_school
    and role = target_role
  limit 1;

  if existing_membership is null then
    insert into public.institutional_memberships
      (user_id, network_id, school_id, role, status, created_by)
    values
      (target_user, target_network, target_school, target_role, target_status, auth.uid())
    returning id into existing_membership;
  else
    update public.institutional_memberships
    set status = target_status, updated_at = now(), created_by = auth.uid()
    where id = existing_membership;
  end if;

  perform private.refresh_institutional_profile_role(target_user);
  return existing_membership;
end;
$$;

create or replace function public.create_student_enrollment(
  target_email text,
  target_network uuid,
  target_school uuid,
  target_academic_year uuid,
  target_classroom uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_student uuid;
  enrollment_id uuid;
begin
  if not private.has_permission('enrollment.manage', target_network, target_school) then
    raise exception 'Not authorized';
  end if;
  select account.id into target_student
  from auth.users account join public.profiles profile on profile.id = account.id
  where lower(account.email) = lower(trim(target_email)) and profile.role = 'student';
  if target_student is null or not exists(select 1 from auth.users u where u.id=target_student and u.email_confirmed_at is not null) or
 (exists(select 1 from public.institutional_memberships where user_id=target_student) and not exists(select 1 from public.institutional_memberships m where m.user_id=target_student and m.network_id=target_network and m.school_id=target_school and m.status='active')) then raise exception 'Student unavailable in scope; send an invitation'; end if;
  if not exists (
    select 1 from public.classrooms
    where id = target_classroom and network_id = target_network and school_id = target_school
      and academic_year_id = target_academic_year and classroom_status = 'active'
  ) then raise exception 'Classroom scope is inconsistent'; end if;
  insert into public.student_enrollments
    (student_id, network_id, school_id, academic_year_id, classroom_id, source, created_by)
  values
    (target_student, target_network, target_school, target_academic_year, target_classroom, 'manual', auth.uid())
  returning id into enrollment_id;
  return enrollment_id;
end;
$$;

