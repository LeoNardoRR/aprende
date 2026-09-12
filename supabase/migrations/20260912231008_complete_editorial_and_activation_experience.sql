-- Incremental corrections: official imports fail closed; revisions retain frozen assets.
create or replace function public.import_curriculum_rows(job_id uuid,target_network uuid,target_curriculum uuid,file_name text,import_rows jsonb,confirm_write boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.curricula%rowtype; r jsonb; result jsonb='[]'; errors jsonb; idx integer=0; seen text[]='{}'; aid uuid; sid uuid; yid uuid; uid uuid; oid uuid; existing public.curriculum_skills%rowtype; decision text; old_job public.curriculum_imports%rowtype; summary jsonb; created integer=0; updated integer=0; ignored integer=0;
begin
 select * into c from public.curricula where id=target_curriculum;
 if c.id is null or not coalesce(((c.network_id=target_network and private.can_manage_curriculum(c.id)) or (auth.role()='service_role' and c.network_id is null and c.created_by is not null)),false) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(import_rows)<>'array' or jsonb_array_length(import_rows) not between 1 and 200 then raise exception 'Use batches of 1 to 200 rows'; end if;
 if confirm_write then
 perform pg_advisory_xact_lock(hashtextextended(target_curriculum::text,0));
 select * into old_job from public.curriculum_imports where id=job_id;
 if old_job.id is not null then if old_job.curriculum_id<>target_curriculum or old_job.request<>import_rows or old_job.created_by is distinct from coalesce(auth.uid(),c.created_by) then raise exception 'Idempotency key conflict'; end if; return old_job.summary; end if;
 end if;
 for r in select value from jsonb_array_elements(import_rows) loop
 idx=idx+1; errors='[]'; decision=upper(coalesce(nullif(r->>'action',''),'CREATE')); existing=null;
 if decision not in('CREATE','UPDATE','SKIP') then errors=errors||jsonb_build_array('Decisão inválida'); end if;
 if length(trim(coalesce(r->>'area',''))) not between 2 and 160 or length(trim(coalesce(r->>'componente',''))) not between 2 and 160 or length(trim(coalesce(r->>'ano_codigo',''))) not between 1 and 40 or length(trim(coalesce(r->>'ano',''))) not between 1 and 80 or length(trim(coalesce(r->>'unidade',''))) not between 2 and 240 or length(trim(coalesce(r->>'objeto',''))) not between 2 and 500 or length(trim(coalesce(r->>'codigo',''))) not between 2 and 60 or length(trim(coalesce(r->>'descricao',''))) not between 5 and 4000 then errors=errors||jsonb_build_array('Estrutura/código/descrição inválida'); end if;
 if upper(trim(r->>'codigo'))=any(seen) then errors=errors||jsonb_build_array('Código duplicado no arquivo'); end if; seen=array_append(seen,upper(trim(r->>'codigo')));
 select * into existing from public.curriculum_skills where curriculum_id=c.id and code=upper(trim(r->>'codigo'));
 if existing.id is not null and decision='CREATE' then errors=errors||jsonb_build_array('Habilidade já existe; escolha UPDATE ou SKIP'); end if;
 if existing.id is null and decision='UPDATE' then errors=errors||jsonb_build_array('Habilidade inexistente para UPDATE'); end if;
 if exists(select 1 from public.curriculum_subjects s join public.curriculum_areas a on a.id=s.area_id where s.curriculum_id=c.id and s.name=trim(r->>'componente') and a.name<>trim(r->>'area')) then errors=errors||jsonb_build_array('Componente pertence a outra área'); end if;
 if existing.id is not null and decision='UPDATE' and (not exists(select 1 from public.curriculum_subjects where id=existing.subject_id and name=trim(r->>'componente')) or not exists(select 1 from public.curriculum_school_years where id=existing.curriculum_school_year_id and code=trim(r->>'ano_codigo'))) then errors=errors||jsonb_build_array('Mudança de identidade curricular não permitida'); end if;
 result=result||jsonb_build_array(jsonb_build_object('line',idx,'codigo',r->>'codigo','action',decision,'valid',jsonb_array_length(errors)=0,'errors',errors));
 end loop;
 summary=jsonb_build_object('rows',result,'total',idx,'invalid',(select count(*) from jsonb_array_elements(result) x where not (x->>'valid')::boolean));
 if not confirm_write then return summary; end if;
 if (summary->>'invalid')::integer>0 then raise exception 'Corrija todas as linhas antes de importar'; end if;
 idx=0;
 for r in select value from jsonb_array_elements(import_rows) loop
 idx=idx+1; decision=upper(coalesce(nullif(r->>'action',''),'CREATE'));
 if decision='SKIP' then ignored=ignored+1; continue; end if;
 insert into public.curriculum_areas(curriculum_id,name) values(c.id,trim(r->>'area')) on conflict(curriculum_id,name) do update set name=excluded.name returning id into aid;
 insert into public.curriculum_subjects(curriculum_id,area_id,name) values(c.id,aid,trim(r->>'componente')) on conflict(curriculum_id,name) do update set name=excluded.name returning id into sid;
 insert into public.curriculum_school_years(curriculum_id,code,name) values(c.id,trim(r->>'ano_codigo'),trim(r->>'ano')) on conflict(curriculum_id,code) do update set name=excluded.name returning id into yid;
 insert into public.curriculum_thematic_units(curriculum_id,subject_id,curriculum_school_year_id,name) values(c.id,sid,yid,trim(r->>'unidade')) on conflict(curriculum_id,subject_id,curriculum_school_year_id,name) do update set name=excluded.name returning id into uid;
 insert into public.curriculum_knowledge_objects(curriculum_id,thematic_unit_id,name) values(c.id,uid,trim(r->>'objeto')) on conflict(curriculum_id,thematic_unit_id,name) do update set name=excluded.name returning id into oid;
 if decision='CREATE' then
 insert into public.curriculum_skills(curriculum_id,subject_id,curriculum_school_year_id,thematic_unit_id,knowledge_object_id,code,description) values(c.id,sid,yid,uid,oid,upper(trim(r->>'codigo')),trim(r->>'descricao')); created=created+1;
 else update public.curriculum_skills set description=trim(r->>'descricao'),thematic_unit_id=uid,knowledge_object_id=oid,updated_at=now() where curriculum_id=c.id and code=upper(trim(r->>'codigo')); updated=updated+1; end if;
 end loop;
 summary=summary||jsonb_build_object('created',created,'updated',updated,'ignored',ignored,'job_id',job_id);
 insert into public.curriculum_imports(id,network_id,curriculum_id,file_name,format,status,row_count,valid_count,created_by,request,summary,imported_at)
 values(job_id,target_network,c.id,left(file_name,255),case when file_name ilike '%.json' then 'json' else 'csv' end,'imported',jsonb_array_length(import_rows),jsonb_array_length(import_rows),coalesce(auth.uid(),c.created_by),import_rows,summary,now());
 return summary;
end; $$;

create or replace function public.revise_assessment_item(target_item uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.assessment_items%rowtype; new_id uuid;
begin
 select * into i from public.assessment_items where id=target_item for update;
 if i.id is null or i.status<>'approved' or not private.has_permission('item.create',i.network_id) or not (i.author_id=auth.uid() or private.has_permission('item.archive',i.network_id)) then raise exception 'Not authorized'; end if;
 insert into public.assessment_items(network_id,curriculum_id,subject_id,curriculum_school_year_id,skill_id,thematic_unit_id,knowledge_object_id,internal_title,statement,support_text,pedagogical_comment,correct_answer_justification,difficulty,item_type,formula,revision_of,author_id,image_paths)
 values(i.network_id,i.curriculum_id,i.subject_id,i.curriculum_school_year_id,i.skill_id,i.thematic_unit_id,i.knowledge_object_id,i.internal_title,i.statement,i.support_text,i.pedagogical_comment,i.correct_answer_justification,i.difficulty,i.item_type,i.formula,i.id,auth.uid(),i.image_paths) returning id into new_id;
 insert into public.assessment_item_options(item_id,label,content,is_correct,feedback,distractor_analysis,sort_order) select new_id,label,content,is_correct,feedback,distractor_analysis,sort_order from public.assessment_item_options where item_id=i.id;
 insert into public.audit_logs(network_id,actor_id,entity_type,entity_id,action,metadata) values(i.network_id,auth.uid(),'assessment_item',new_id,'revision_created',jsonb_build_object('revision_of',i.id)); return new_id;
end; $$;

create or replace function public.set_item_images(target_item uuid,paths text[])
returns void language plpgsql security definer set search_path='' as $$
declare p text; i public.assessment_items%rowtype;
begin
 select * into i from public.assessment_items where id=target_item for update;
 if i.id is null or not private.can_edit_item(i.id) then raise exception 'Not authorized'; end if;
 if cardinality(paths)>10 then raise exception 'At most 10 images'; end if;
 foreach p in array coalesce(paths,'{}') loop
 if not (p like i.network_id::text||'/'||i.id::text||'/%' or p=any(i.image_paths)) or not exists(select 1 from storage.objects o where o.bucket_id='assessment-item-images' and o.name=p) then raise exception 'Image outside item scope'; end if;
 end loop;
 update public.assessment_items set image_paths=coalesce(paths,'{}'),updated_at=now() where id=i.id;
end; $$;

create or replace function public.item_bank_directory(target_network uuid,filters jsonb default '{}',page_size integer default 20,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('item.read',target_network) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select i.id as item_id,i.internal_title,i.statement,i.item_type,i.difficulty,i.status as item_status,c.name as curriculum_name,s.name as subject_name,y.name as school_year_name,sk.code as skill_code,p.display_name as author_name,r.display_name as reviewer_name,a.display_name as approver_name,i.current_version,i.updated_at,count(*) over() as total_count
 from public.assessment_items i join public.curricula c on c.id=i.curriculum_id join public.curriculum_subjects s on s.id=i.subject_id join public.curriculum_school_years y on y.id=i.curriculum_school_year_id join public.curriculum_skills sk on sk.id=i.skill_id join public.profiles p on p.id=i.author_id left join public.profiles r on r.id=i.reviewer_id left join public.profiles a on a.id=i.approver_id
 where i.network_id=target_network and (coalesce(filters->>'curriculum','')='' or i.curriculum_id::text=filters->>'curriculum') and (coalesce(filters->>'subject','')='' or i.subject_id::text=filters->>'subject') and (coalesce(filters->>'year','')='' or i.curriculum_school_year_id::text=filters->>'year') and (coalesce(filters->>'skill','')='' or i.skill_id::text=filters->>'skill') and (coalesce(filters->>'difficulty','')='' or i.difficulty=filters->>'difficulty') and (coalesce(filters->>'status','')='' or i.status=filters->>'status') and (coalesce(filters->>'type','')='' or i.item_type=filters->>'type') and (coalesce(filters->>'author','')='' or i.author_id::text=filters->>'author' or p.display_name ilike '%'||(filters->>'author')||'%') and (coalesce(filters->>'reviewer','')='' or i.reviewer_id::text=filters->>'reviewer' or r.display_name ilike '%'||(filters->>'reviewer')||'%') and (coalesce(filters->>'approver','')='' or i.approver_id::text=filters->>'approver' or a.display_name ilike '%'||(filters->>'approver')||'%') and (coalesce(filters->>'search','')='' or to_tsvector('portuguese',i.internal_title||' '||i.statement)@@plainto_tsquery('portuguese',filters->>'search'))
 order by i.updated_at desc,i.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q; return result;
end; $$;

create function public.institutional_invitation_context(invitation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.institutional_invitations%rowtype; result jsonb;
begin
 select inv.* into i from public.institutional_invitations inv join auth.users u on u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=inv.email
 where inv.id=invitation_id and inv.status='pending' and inv.expires_at>now();
 if i.id is null then raise exception 'Convite indisponível para esta conta.'; end if;
 if not exists(select 1 from public.institutional_memberships m where m.user_id=i.created_by and m.network_id=i.network_id and m.status='active' and ((m.role='network_admin' and m.school_id is null) or (m.role='manager' and i.role in('reviewer','approver','teacher','student') and i.school_id is not null and (m.school_id is null or m.school_id=i.school_id)))) then raise exception 'Convite indisponível para esta conta.'; end if;
 select jsonb_build_object('network',n.name,'school',s.name,'role',i.role,'email',i.email) into result from public.networks n left join public.schools s on s.id=i.school_id where n.id=i.network_id;
 return result;
end; $$;
revoke all on function public.institutional_invitation_context(uuid) from public,anon,authenticated;
grant execute on function public.institutional_invitation_context(uuid) to authenticated;

create function public.item_editorial_history(target_item uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_item(target_item) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select r.action,r.comment,r.actor_id,p.display_name as actor_name,r.created_at from public.assessment_item_reviews r left join public.profiles p on p.id=r.actor_id where r.item_id=target_item order by r.created_at desc,r.id limit 100) q;
 return result;
end; $$;
revoke all on function public.item_editorial_history(uuid) from public,anon,authenticated;
grant execute on function public.item_editorial_history(uuid) to authenticated;
