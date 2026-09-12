-- Fases 1/2: no remote execution. New tables expose reads only; mutations use guarded RPCs.
create or replace function private.has_permission(target_permission text, target_network uuid default null, target_school uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.institutional_memberships m join private.role_permissions p on p.role=m.role
 where m.user_id=auth.uid() and m.status='active' and p.permission_key=target_permission
 and (target_network is null or m.network_id=target_network)
 and (target_school is null or m.school_id is null or m.school_id=target_school));
$$;
-- Provision the creator's first network membership, including previously bootstrapped networks.
insert into public.institutional_memberships(user_id,network_id,role,status,created_by)
select n.created_by,n.id,'network_admin','active',n.created_by from public.networks n join public.profiles p on p.id=n.created_by
where p.role::text='network_admin' and not exists(select 1 from public.institutional_memberships m where m.user_id=n.created_by and m.network_id=n.id and m.role='network_admin' and m.school_id is null);
create function private.provision_network_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.profiles where id=new.created_by and role::text='network_admin') then
 insert into public.institutional_memberships(user_id,network_id,role,status,created_by) values(new.created_by,new.id,'network_admin','active',new.created_by);
 end if; return new;
end; $$;
create trigger provision_network_owner after insert on public.networks for each row execute function private.provision_network_owner();
revoke all on function private.provision_network_owner() from public,anon,authenticated;
drop policy networks_create_institutional on public.networks;
create policy networks_create_institutional on public.networks for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role::text='network_admin'));
drop policy networks_read_institutional on public.networks;
create policy networks_read_institutional on public.networks for select to authenticated using(private.can_view_institutional_scope(id));
create or replace function private.can_assign_institutional_role(target_network uuid,target_school uuid,target_role text)
returns boolean language sql stable security definer set search_path='' as $$
 select target_role in ('network_admin','manager','reviewer','approver','teacher','student') and (
 exists(select 1 from public.institutional_memberships m where m.user_id=auth.uid() and m.network_id=target_network and m.school_id is null and m.role='network_admin' and m.status='active')
 or (target_role in ('reviewer','approver','teacher','student') and target_school is not null and private.has_permission('enrollment.manage',target_network,target_school)));
$$;
create or replace function public.find_profile_for_institution(target_email text,target_network uuid,target_school uuid default null)
returns table(user_id uuid,email text,display_name text,profile_role public.app_role)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission('enrollment.manage',target_network,target_school) then raise exception 'Not authorized'; end if;
 return query select p.id,u.email::text,p.display_name,p.role from public.profiles p join auth.users u on u.id=p.id
 where lower(u.email)=lower(trim(target_email)) and exists(select 1 from public.institutional_memberships m where m.user_id=p.id and m.network_id=target_network and (target_school is null or m.school_id=target_school) and private.has_permission('enrollment.manage',m.network_id,m.school_id));
end; $$;

create table public.institutional_batch_jobs(
 id uuid primary key, network_id uuid not null references public.networks on delete cascade,
 school_id uuid not null references public.schools on delete cascade, created_by uuid not null references public.profiles,
 file_name text not null, kind text not null check(kind in ('enrollments','promotion')),
 status text not null check(status in ('processing','completed','completed_with_errors','failed')),
 row_count integer not null, valid_count integer not null default 0, invalid_count integer not null default 0,
 processed_count integer not null default 0,error_count integer not null default 0,
 request jsonb not null,summary jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
 foreign key(school_id,network_id) references public.schools(id,network_id));
alter table public.institutional_batch_jobs enable row level security;
create policy batch_jobs_read on public.institutional_batch_jobs for select to authenticated using(created_by=auth.uid() and private.has_permission('enrollment.manage',network_id,school_id));
revoke all on public.institutional_batch_jobs from anon,authenticated;
grant select on public.institutional_batch_jobs to authenticated;
create index batch_jobs_scope_idx on public.institutional_batch_jobs(network_id,school_id,created_at desc);
create index enrollments_external_key_idx on public.student_enrollments(network_id,external_key) where external_key is not null;

create function public.preview_student_import(target_network uuid,target_school uuid,import_rows jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; result jsonb='[]'; problems jsonb; idx integer=0; room public.classrooms%rowtype; student uuid; existing public.student_enrollments%rowtype; action text; seen_email text[]='{}'; seen_key text[]='{}'; email text; ext text; matches integer;
begin
 if target_school is null or not private.has_permission('enrollment.manage',target_network,target_school) or not exists(select 1 from public.schools where id=target_school and network_id=target_network) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(import_rows)<>'array' or jsonb_array_length(import_rows) not between 1 and 200 then raise exception 'Use batches of 1 to 200 rows'; end if;
 for r in select value from jsonb_array_elements(import_rows) loop
 idx=idx+1; problems='[]'; room=null; student=null; existing=null;
 email=lower(trim(coalesce(r->>'email',''))); ext=nullif(trim(r->>'identificador'),''); action=upper(coalesce(nullif(r->>'action',''),'CREATE'));
 if email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(trim(coalesce(r->>'nome','')))<2 then problems=problems||jsonb_build_array('Nome/e-mail inválido'); end if;
 if action not in ('CREATE','UPDATE','SKIP') then problems=problems||jsonb_build_array('Decisão inválida'); end if;
 if email=any(seen_email) or (ext is not null and ext=any(seen_key)) then problems=problems||jsonb_build_array('Duplicado no arquivo'); end if;
 seen_email=array_append(seen_email,email); if ext is not null then seen_key=array_append(seen_key,ext); end if;
 if not exists(select 1 from public.networks where id=target_network and (r->>'rede' in (id::text,name))) or not exists(select 1 from public.schools where id=target_school and (r->>'escola' in (id::text,name,code))) then problems=problems||jsonb_build_array('Rede/escola incorreta'); end if;
 select count(*) into matches from public.classrooms c join public.academic_years y on y.id=c.academic_year_id join public.school_years g on g.id=c.school_year_id
 where c.network_id=target_network and c.school_id=target_school and c.classroom_status='active' and y.status<>'closed' and r->>'turma' in(c.id::text,c.name) and r->>'ano_letivo' in(y.id::text,y.label) and r->>'serie' in(g.id::text,g.code,g.name);
 if matches<>1 then problems=problems||jsonb_build_array('Turma/ano/série inexistente ou ambígua'); else
 select c.* into room from public.classrooms c join public.academic_years y on y.id=c.academic_year_id join public.school_years g on g.id=c.school_year_id where c.network_id=target_network and c.school_id=target_school and r->>'turma' in(c.id::text,c.name) and r->>'ano_letivo' in(y.id::text,y.label) and r->>'serie' in(g.id::text,g.code,g.name) and c.classroom_status='active' and y.status<>'closed'; end if;
 select u.id into student from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=email and p.role::text='student' and u.email_confirmed_at is not null
 and (exists(select 1 from public.institutional_memberships m where m.user_id=u.id and m.network_id=target_network and m.school_id=target_school and m.status='active') or (not exists(select 1 from public.institutional_memberships m where m.user_id=u.id) and not exists(select 1 from public.student_enrollments e where e.student_id=u.id)));
 if student is null then problems=problems||jsonb_build_array('Usuário não disponível no escopo; envie convite de acesso'); end if;
 if student is not null and ext is not null and exists(select 1 from public.student_enrollments e where e.network_id=target_network and e.external_key=ext and e.student_id<>student) then problems=problems||jsonb_build_array('Identificador institucional em conflito'); end if;
 select * into existing from public.student_enrollments e where e.student_id=student and e.academic_year_id=room.academic_year_id and e.status='enrolled';
 if existing.id is not null and (existing.school_id<>target_school or existing.network_id<>target_network) then problems=problems||jsonb_build_array('Matrícula fora do escopo'); end if;
 if existing.id is not null and action='CREATE' then problems=problems||jsonb_build_array('Registro já existente; escolha UPDATE ou SKIP'); end if;
 if existing.id is null and action='UPDATE' then problems=problems||jsonb_build_array('Matrícula não encontrada para UPDATE'); end if;
 result=result||jsonb_build_array(jsonb_build_object('line',idx,'email',email,'action',action,'valid',jsonb_array_length(problems)=0,'errors',problems,'student_id',student,'classroom_id',room.id,'academic_year_id',room.academic_year_id,'enrollment_id',existing.id,'identificador',ext));
 end loop;
 return jsonb_build_object('rows',result,'total',idx,'valid', (select count(*) from jsonb_array_elements(result) v where (v->>'valid')::boolean),'invalid',(select count(*) from jsonb_array_elements(result) v where not (v->>'valid')::boolean));
end; $$;

create function public.commit_student_import(job_id uuid,target_network uuid,target_school uuid,file_name text,import_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview jsonb; old_job public.institutional_batch_jobs%rowtype; row_data jsonb; enroll_id uuid; before_row public.student_enrollments%rowtype; report jsonb='[]'; processed integer=0;
begin
 if not private.has_permission('enrollment.manage',target_network,target_school) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_network::text,0));
 select * into old_job from public.institutional_batch_jobs where id=job_id;
 if old_job.id is not null then
 if old_job.created_by<>auth.uid() or old_job.request<>import_rows or old_job.network_id<>target_network or old_job.school_id<>target_school or old_job.kind<>'enrollments' then raise exception 'Idempotency key conflict'; end if; return old_job.summary; end if;
 preview=public.preview_student_import(target_network,target_school,import_rows);
 insert into public.institutional_batch_jobs(id,network_id,school_id,created_by,file_name,kind,status,row_count,request) values(job_id,target_network,target_school,auth.uid(),left(file_name,255),'enrollments','processing',jsonb_array_length(import_rows),import_rows);
 for row_data in select value from jsonb_array_elements(preview->'rows') loop
 if (row_data->>'valid')::boolean and row_data->>'action'<>'SKIP' then
 if row_data->>'action'='CREATE' then
 insert into public.student_enrollments(student_id,network_id,school_id,academic_year_id,classroom_id,external_key,source,created_by)
 values((row_data->>'student_id')::uuid,target_network,target_school,(row_data->>'academic_year_id')::uuid,(row_data->>'classroom_id')::uuid,row_data->>'identificador','csv',auth.uid()) returning id into enroll_id;
 else
 select * into before_row from public.student_enrollments where id=(row_data->>'enrollment_id')::uuid for update;
 enroll_id=before_row.id;
 update public.student_enrollments set classroom_id=(row_data->>'classroom_id')::uuid,external_key=row_data->>'identificador',updated_at=now() where id=enroll_id;
 if before_row.classroom_id is distinct from (row_data->>'classroom_id')::uuid then insert into public.student_movements(enrollment_id,student_id,from_classroom_id,to_classroom_id,movement_type,reason,created_by) values(enroll_id,before_row.student_id,before_row.classroom_id,(row_data->>'classroom_id')::uuid,'transfer','Importação CSV confirmada',auth.uid()); end if;
 end if; processed=processed+1;
 row_data=row_data||jsonb_build_object('result','processed','enrollment_id',enroll_id);
 else row_data=row_data||jsonb_build_object('result',case when row_data->>'action'='SKIP' then 'skipped' else 'invalid' end); end if;
 report=report||jsonb_build_array(row_data);
 end loop;
 preview=preview||jsonb_build_object('rows',report,'processed',processed,'job_id',job_id);
 update public.institutional_batch_jobs set status=case when (preview->>'invalid')::integer>0 then 'completed_with_errors' else 'completed' end,valid_count=(preview->>'valid')::integer,invalid_count=(preview->>'invalid')::integer,processed_count=processed,error_count=(preview->>'invalid')::integer,summary=preview where id=job_id;
 return preview;
end; $$;

create function public.enrollment_directory(target_network uuid,filters jsonb default '{}',page_size integer default 50,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('enrollment.read',target_network) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
 select e.id,e.student_id,p.display_name as nome,u.email,e.external_key as identificador,s.name as escola,g.name as serie,c.name as turma,y.label as ano_letivo,e.status,e.starts_on,e.ends_on,e.classroom_id,e.school_id,e.academic_year_id,count(*) over() as total_count
 from public.student_enrollments e join public.profiles p on p.id=e.student_id join auth.users u on u.id=e.student_id join public.schools s on s.id=e.school_id join public.academic_years y on y.id=e.academic_year_id left join public.classrooms c on c.id=e.classroom_id left join public.school_years g on g.id=c.school_year_id
 where e.network_id=target_network and private.has_permission('enrollment.read',e.network_id,e.school_id)
 and (coalesce(filters->>'school','')='' or e.school_id::text=filters->>'school') and (coalesce(filters->>'year','')='' or e.academic_year_id::text=filters->>'year') and (coalesce(filters->>'grade','')='' or c.school_year_id::text=filters->>'grade') and (coalesce(filters->>'classroom','')='' or c.id::text=filters->>'classroom') and (coalesce(filters->>'status','')='' or e.status=filters->>'status') and (coalesce(filters->>'search','')='' or p.display_name ilike '%'||(filters->>'search')||'%' or u.email ilike '%'||(filters->>'search')||'%')
 order by p.display_name,e.id limit least(greatest(page_size,1),200) offset greatest(page_offset,0)) q; return result;
end; $$;

create function public.promote_students(job_id uuid,source_classroom uuid,target_classroom uuid,enrollment_ids uuid[],confirm_write boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare src public.classrooms%rowtype; dst public.classrooms%rowtype; e public.student_enrollments%rowtype; new_id uuid; rows jsonb='[]'; old_job public.institutional_batch_jobs%rowtype; request jsonb; ids uuid[];
begin
 select * into src from public.classrooms where id=source_classroom; select * into dst from public.classrooms where id=target_classroom;
 if src.id is null or dst.id is null or not private.has_permission('enrollment.manage',src.network_id,src.school_id) or not private.has_permission('enrollment.manage',dst.network_id,dst.school_id) then raise exception 'Not authorized'; end if;
 if src.network_id<>dst.network_id or src.school_id<>dst.school_id or src.academic_year_id=dst.academic_year_id or dst.classroom_status<>'active' or dst.school_year_id is null or not exists(select 1 from public.academic_years y join public.academic_years a on a.id=src.academic_year_id where y.id=dst.academic_year_id and y.starts_on>a.starts_on and y.status<>'closed') then raise exception 'Invalid promotion destination'; end if;
 select array_agg(x order by x) into ids from (select distinct unnest(enrollment_ids) x) t;
 if coalesce(cardinality(ids),0) not between 1 and 200 or cardinality(ids)<>cardinality(enrollment_ids) then raise exception 'Select 1 to 200 different enrollments'; end if;
 request=jsonb_build_object('source',source_classroom,'target',target_classroom,'ids',ids);
 if confirm_write then perform pg_advisory_xact_lock(hashtextextended(src.network_id::text,0)); select * into old_job from public.institutional_batch_jobs where id=job_id;
 if old_job.id is not null then if old_job.created_by<>auth.uid() or old_job.request<>request or old_job.kind<>'promotion' then raise exception 'Idempotency key conflict'; end if; return old_job.summary; end if; end if;
 foreach new_id in array ids loop
 select * into e from public.student_enrollments where id=new_id;
 if e.id is null or e.classroom_id<>src.id or e.status<>'enrolled' then raise exception 'Invalid source enrollment'; end if;
 if exists(select 1 from public.student_enrollments where student_id=e.student_id and academic_year_id=dst.academic_year_id and status='enrolled') then raise exception 'Student already enrolled in destination year'; end if;
 rows=rows||jsonb_build_array(jsonb_build_object('enrollment_id',e.id,'student_id',e.student_id,'source',src.name,'destination',dst.name));
 end loop;
 if confirm_write then
 insert into public.institutional_batch_jobs(id,network_id,school_id,created_by,file_name,kind,status,row_count,request) values(job_id,src.network_id,src.school_id,auth.uid(),'Promoção','promotion','processing',cardinality(ids),request);
 for e in select * from public.student_enrollments where id=any(ids) for update loop
 update public.student_enrollments set status='completed',ends_on=greatest(starts_on,current_date),updated_at=now() where id=e.id;
 insert into public.student_enrollments(student_id,network_id,school_id,academic_year_id,classroom_id,external_key,source,created_by) values(e.student_id,dst.network_id,dst.school_id,dst.academic_year_id,dst.id,e.external_key,'promotion',auth.uid()) returning id into new_id;
 insert into public.student_movements(enrollment_id,student_id,from_classroom_id,to_classroom_id,movement_type,reason,created_by) values(e.id,e.student_id,src.id,dst.id,'promotion','Matrícula de destino: '||new_id::text,auth.uid());
 end loop;
 update public.institutional_batch_jobs set status='completed',valid_count=cardinality(ids),processed_count=cardinality(ids),summary=jsonb_build_object('rows',rows,'processed',cardinality(ids)) where id=job_id;
 end if; return jsonb_build_object('rows',rows,'processed',case when confirm_write then cardinality(ids) else 0 end);
end; $$;

create table public.institutional_invitations(
 id uuid primary key default gen_random_uuid(),network_id uuid not null references public.networks on delete cascade,school_id uuid references public.schools on delete cascade,
 email text not null,role text not null check(role in('network_admin','manager','reviewer','approver','teacher','student')),
 status text not null default 'pending' check(status in('pending','accepted','expired','revoked')),
 expires_at timestamptz not null default now()+interval '7 days',created_by uuid not null references public.profiles,created_at timestamptz not null default now(),accepted_by uuid references public.profiles,accepted_at timestamptz,last_sent_at timestamptz,
 foreign key(school_id,network_id) references public.schools(id,network_id));
create index invitations_scope_idx on public.institutional_invitations(network_id,school_id,status,created_at desc);
alter table public.institutional_invitations enable row level security;
create policy invitations_read on public.institutional_invitations for select to authenticated using(private.can_assign_institutional_role(network_id,school_id,role));
revoke all on public.institutional_invitations from anon,authenticated; grant select on public.institutional_invitations to authenticated;
create function public.manage_institutional_invitation(target_network uuid,target_school uuid,target_email text,target_role text,target_action text default 'invite',invitation_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.institutional_invitations%rowtype;
begin
 if not private.can_assign_institutional_role(target_network,target_school,target_role) or target_network is null then raise exception 'Not authorized'; end if;
 if target_role in('teacher','student') and target_school is null then raise exception 'School required'; end if;
 if target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 if target_action='invite' then
 insert into public.institutional_invitations(network_id,school_id,email,role,created_by) values(target_network,target_school,lower(trim(target_email)),target_role,auth.uid()) returning * into invitation;
 elsif target_action in('resend','revoke') then
 select * into invitation from public.institutional_invitations where id=invitation_id and network_id=target_network and school_id is not distinct from target_school and email=lower(trim(target_email)) and role=target_role for update;
 if invitation.id is null or invitation.status='accepted' then raise exception 'Invitation unavailable'; end if;
 if target_action='resend' and invitation.status='revoked' then raise exception 'Invitation revoked'; end if;
 if target_action='resend' and invitation.last_sent_at>now()-interval '60 seconds' then raise exception 'Wait before resending'; end if;
 update public.institutional_invitations set status=case when target_action='revoke' then 'revoked' else 'pending' end,expires_at=case when target_action='revoke' then expires_at else now()+interval '7 days' end where id=invitation.id returning * into invitation;
 else raise exception 'Invalid action'; end if;
 if target_action<>'revoke' then update public.institutional_invitations set last_sent_at=now() where id=invitation.id; end if;
 insert into public.audit_logs(network_id,actor_id,entity_type,entity_id,action,metadata) values(target_network,auth.uid(),'institutional_invitation',invitation.id,target_action,jsonb_build_object('school_id',target_school,'role',target_role));
 return jsonb_build_object('id',invitation.id,'status',invitation.status);
end; $$;
create function public.accept_institutional_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare i public.institutional_invitations%rowtype; email text;
begin
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and length(coalesce(u.encrypted_password,''))>0;
 select * into i from public.institutional_invitations where id=invitation_id for update;
 if i.id is null or email is null or lower(email)<>i.email or i.status not in('pending','accepted') or i.expires_at<=now() then raise exception 'Invitation unavailable; authenticate and define a password'; end if;
 if i.status='accepted' and i.accepted_by=auth.uid() then return; end if;
 -- Creator must still be authorized; a revoked manager cannot leave usable grants behind.
 if not exists(select 1 from public.institutional_memberships m where m.user_id=i.created_by and m.network_id=i.network_id and m.status='active' and ((m.role='network_admin' and m.school_id is null) or (m.role='manager' and i.role in('reviewer','approver','teacher','student') and i.school_id is not null and (m.school_id is null or m.school_id=i.school_id)))) then raise exception 'Invitation issuer no longer authorized'; end if;
 update public.institutional_memberships set status='inactive',updated_at=now() where user_id=auth.uid() and network_id=i.network_id and school_id is not distinct from i.school_id and role<>i.role;
 if exists(select 1 from public.institutional_memberships where user_id=auth.uid() and network_id=i.network_id and school_id is not distinct from i.school_id and role=i.role) then
 update public.institutional_memberships set status='active',updated_at=now() where user_id=auth.uid() and network_id=i.network_id and school_id is not distinct from i.school_id and role=i.role;
 else insert into public.institutional_memberships(user_id,network_id,school_id,role,created_by) values(auth.uid(),i.network_id,i.school_id,i.role,i.created_by); end if;
 perform private.refresh_institutional_profile_role(auth.uid());
 update public.institutional_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
end; $$;

create function public.institutional_user_directory(target_network uuid,filters jsonb default '{}',page_size integer default 25,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('enrollment.read',target_network) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select m.id,m.user_id,p.display_name,u.email,m.role,m.status,m.school_id,m.created_at,count(*) over() as total_count from public.institutional_memberships m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id
 where m.network_id=target_network and private.has_permission('enrollment.read',m.network_id,m.school_id)
 and (coalesce(filters->>'role','')='' or m.role=filters->>'role') and (coalesce(filters->>'status','')='' or m.status=filters->>'status') and (coalesce(filters->>'school','')='' or m.school_id::text=filters->>'school') and (coalesce(filters->>'search','')='' or p.display_name ilike '%'||(filters->>'search')||'%' or u.email ilike '%'||(filters->>'search')||'%') order by p.display_name,m.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q; return result;
end; $$;

revoke all on function public.preview_student_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.preview_student_import(uuid,uuid,jsonb) to authenticated;

revoke all on function public.commit_student_import(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_student_import(uuid,uuid,uuid,text,jsonb) to authenticated;

revoke all on function public.enrollment_directory(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.enrollment_directory(uuid,jsonb,integer,integer) to authenticated;

revoke all on function public.promote_students(uuid,uuid,uuid,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.promote_students(uuid,uuid,uuid,uuid[],boolean) to authenticated;

revoke all on function public.manage_institutional_invitation(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.manage_institutional_invitation(uuid,uuid,text,text,text,uuid) to authenticated;

revoke all on function public.accept_institutional_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_institutional_invitation(uuid) to authenticated;

revoke all on function public.institutional_user_directory(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.institutional_user_directory(uuid,jsonb,integer,integer) to authenticated;

create function private.audit_institutional_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(network_id,actor_id,entity_type,entity_id,action,metadata) values(new.network_id,auth.uid(),'institutional_membership',new.id,case when tg_op='INSERT' then 'created' else 'updated' end,jsonb_build_object('school_id',new.school_id,'role',new.role,'status',new.status)); return new;
end; $$;
create trigger audit_institutional_membership after insert or update on public.institutional_memberships for each row execute function private.audit_institutional_membership();
revoke all on function private.audit_institutional_membership() from public,anon,authenticated;
create function public.institutional_access_history(target_network uuid,target_membership uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.institutional_memberships%rowtype; result jsonb;
begin
 select * into m from public.institutional_memberships where id=target_membership and network_id=target_network;
 if m.id is null or not private.has_permission('enrollment.read',m.network_id,m.school_id) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select a.action,a.metadata,a.created_at,p.display_name as actor from public.audit_logs a left join public.profiles p on p.id=a.actor_id where a.entity_id=m.id and a.entity_type='institutional_membership' order by a.created_at desc limit 100) q;return result;
end; $$;
create function public.institutional_invitation_directory(target_network uuid,page_size integer default 25,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('enrollment.read',target_network) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select i.id,i.email,i.role,i.school_id,case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end as status,i.created_at,i.expires_at,count(*) over() as total_count from public.institutional_invitations i where i.network_id=target_network and private.can_assign_institutional_role(i.network_id,i.school_id,i.role) order by i.created_at desc,i.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q;return result;
end; $$;
revoke all on function public.institutional_access_history(uuid,uuid) from public,anon,authenticated;
revoke all on function public.institutional_invitation_directory(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.institutional_access_history(uuid,uuid),public.institutional_invitation_directory(uuid,integer,integer) to authenticated;
