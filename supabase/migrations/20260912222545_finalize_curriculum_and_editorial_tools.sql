-- Curriculum ingestion and editorial tools. Existing migrations remain unchanged.
alter table public.curriculum_imports add column request jsonb, add column summary jsonb not null default '{}';
revoke insert,update,delete on public.curriculum_imports from authenticated;
create function public.import_curriculum_rows(job_id uuid,target_network uuid,target_curriculum uuid,file_name text,import_rows jsonb,confirm_write boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.curricula%rowtype; r jsonb; result jsonb='[]'; errors jsonb; idx integer=0; seen text[]='{}'; aid uuid; sid uuid; yid uuid; uid uuid; oid uuid; existing public.curriculum_skills%rowtype; decision text; old_job public.curriculum_imports%rowtype; summary jsonb; created integer=0; updated integer=0; ignored integer=0;
begin
 select * into c from public.curricula where id=target_curriculum;
 if c.id is null or not ((c.network_id=target_network and private.can_manage_curriculum(c.id)) or (auth.role()='service_role' and c.network_id is null)) then raise exception 'Not authorized'; end if;
 if jsonb_typeof(import_rows)<>'array' or jsonb_array_length(import_rows) not between 1 and 200 then raise exception 'Use batches of 1 to 200 rows'; end if;
 if confirm_write then
 perform pg_advisory_xact_lock(hashtextextended(target_curriculum::text,0));
 select * into old_job from public.curriculum_imports where id=job_id;
 if old_job.id is not null then if old_job.curriculum_id<>target_curriculum or old_job.request<>import_rows or old_job.created_by is distinct from auth.uid() then raise exception 'Idempotency key conflict'; end if; return old_job.summary; end if;
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

create function public.curriculum_skill_directory(target_curriculum uuid,filters jsonb default '{}',page_size integer default 50,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_curriculum(target_curriculum) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select sk.id,sk.code,sk.description,a.name as area,s.name as componente,y.name as ano,u.name as unidade,o.name as objeto,sk.subject_id,sk.curriculum_school_year_id,count(*) over() as total_count
 from public.curriculum_skills sk join public.curriculum_subjects s on s.id=sk.subject_id join public.curriculum_areas a on a.id=s.area_id join public.curriculum_school_years y on y.id=sk.curriculum_school_year_id left join public.curriculum_thematic_units u on u.id=sk.thematic_unit_id left join public.curriculum_knowledge_objects o on o.id=sk.knowledge_object_id
 where sk.curriculum_id=target_curriculum and sk.active
 and (coalesce(filters->>'area','')='' or a.id::text=filters->>'area') and (coalesce(filters->>'subject','')='' or s.id::text=filters->>'subject') and (coalesce(filters->>'year','')='' or y.id::text=filters->>'year') and (coalesce(filters->>'unit','')='' or u.id::text=filters->>'unit') and (coalesce(filters->>'object','')='' or o.id::text=filters->>'object') and (coalesce(filters->>'search','')='' or sk.code ilike '%'||(filters->>'search')||'%' or sk.description ilike '%'||(filters->>'search')||'%')
 order by sk.code,sk.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q; return result;
end; $$;

-- Tighten the validation already called by every editorial transition.
create or replace function private.validate_item(target_item uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assessment_items%rowtype; options integer; correct integer;
begin
 select * into item from public.assessment_items where id=target_item;
 if item.id is null then raise exception 'Item not found'; end if;
 if not exists(select 1 from public.curricula c where c.id=item.curriculum_id and c.active and (c.network_id is null or c.network_id=item.network_id)) then raise exception 'Curriculum outside scope'; end if;
 if not exists(select 1 from public.curriculum_skills s where s.id=item.skill_id and s.active and s.curriculum_id=item.curriculum_id and s.subject_id=item.subject_id and s.curriculum_school_year_id=item.curriculum_school_year_id) then raise exception 'Skill, subject and year must agree'; end if;
 if length(trim(item.statement))<5 or length(trim(coalesce(item.pedagogical_comment,'')))<5 then raise exception 'Statement and pedagogical comment required'; end if;
 if item.item_type in('multiple_choice','true_false') then
 select count(*),count(*) filter(where is_correct) into options,correct from public.assessment_item_options where item_id=item.id;
 if options<>(case when item.item_type='multiple_choice' then 4 else 2 end) then raise exception 'Multiple choice requires exactly 4 options (true/false: 2)'; end if;
 if correct<>1 then raise exception 'Exactly one correct option required'; end if;
 if length(trim(coalesce(item.correct_answer_justification,'')))<5 then raise exception 'Correct answer justification required'; end if;
 if exists(select 1 from public.assessment_item_options where item_id=item.id and (length(trim(content))=0 or (not is_correct and length(trim(coalesce(distractor_analysis,'')))<5))) then raise exception 'Every option needs text and every distractor needs analysis'; end if;
 end if;
end; $$;
create function private.require_editorial_reason() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.action in('rejected','returned') and length(trim(coalesce(new.comment,'')))<5 then raise exception 'Rejection/return requires a reason of at least 5 characters'; end if; return new;
end; $$;
create trigger require_editorial_reason before insert on public.assessment_item_reviews for each row execute function private.require_editorial_reason();
revoke all on function private.require_editorial_reason() from public,anon,authenticated;
alter table public.assessment_items add column formula text check(formula is null or length(formula)<=4000), add column revision_of uuid references public.assessment_items;
create index assessment_items_revision_idx on public.assessment_items(revision_of);
create function public.save_assessment_item(target_network uuid,payload jsonb,item_options jsonb,target_item uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_item_id uuid; opt jsonb; idx integer=0;
begin
 if not private.has_permission('item.create',target_network) then raise exception 'Not authorized'; end if;
 if target_item is not null then
 perform 1 from public.assessment_items where id=target_item for update;
 if not private.can_edit_item(target_item) or not exists(select 1 from public.assessment_items where id=target_item and network_id=target_network) then raise exception 'Not authorized'; end if;
 v_item_id=target_item;
 update public.assessment_items set curriculum_id=(payload->>'curriculum_id')::uuid,subject_id=(payload->>'subject_id')::uuid,curriculum_school_year_id=(payload->>'curriculum_school_year_id')::uuid,skill_id=(payload->>'skill_id')::uuid,internal_title=trim(payload->>'internal_title'),statement=trim(payload->>'statement'),support_text=payload->>'support_text',pedagogical_comment=payload->>'pedagogical_comment',correct_answer_justification=payload->>'correct_answer_justification',difficulty=payload->>'difficulty',item_type=payload->>'item_type',formula=payload->>'formula',updated_at=now() where id=v_item_id;
 delete from public.assessment_item_options where assessment_item_options.item_id=v_item_id;
 else
 insert into public.assessment_items(network_id,curriculum_id,subject_id,curriculum_school_year_id,skill_id,internal_title,statement,support_text,pedagogical_comment,correct_answer_justification,difficulty,item_type,formula,author_id)
 values(target_network,(payload->>'curriculum_id')::uuid,(payload->>'subject_id')::uuid,(payload->>'curriculum_school_year_id')::uuid,(payload->>'skill_id')::uuid,trim(payload->>'internal_title'),trim(payload->>'statement'),payload->>'support_text',payload->>'pedagogical_comment',payload->>'correct_answer_justification',payload->>'difficulty',payload->>'item_type',payload->>'formula',auth.uid()) returning id into v_item_id;
 end if;
 if jsonb_typeof(item_options)<>'array' or jsonb_array_length(item_options)>4 then raise exception 'Invalid options'; end if;
 for opt in select value from jsonb_array_elements(item_options) loop
 insert into public.assessment_item_options(item_id,label,content,is_correct,feedback,distractor_analysis,sort_order) values(v_item_id,chr(65+idx),trim(opt->>'content'),coalesce((opt->>'is_correct')::boolean,false),opt->>'feedback',opt->>'distractor_analysis',idx); idx=idx+1;
 end loop;
 perform private.validate_item(v_item_id); return v_item_id;
end; $$;
create function public.revise_assessment_item(target_item uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.assessment_items%rowtype; new_id uuid;
begin
 select * into i from public.assessment_items where id=target_item for update;
 if i.id is null or i.status<>'approved' or not private.has_permission('item.create',i.network_id) or not (i.author_id=auth.uid() or private.has_permission('item.archive',i.network_id)) then raise exception 'Not authorized'; end if;
 insert into public.assessment_items(network_id,curriculum_id,subject_id,curriculum_school_year_id,skill_id,thematic_unit_id,knowledge_object_id,internal_title,statement,support_text,pedagogical_comment,correct_answer_justification,difficulty,item_type,formula,revision_of,author_id)
 values(i.network_id,i.curriculum_id,i.subject_id,i.curriculum_school_year_id,i.skill_id,i.thematic_unit_id,i.knowledge_object_id,i.internal_title,i.statement,i.support_text,i.pedagogical_comment,i.correct_answer_justification,i.difficulty,i.item_type,i.formula,i.id,auth.uid()) returning id into new_id;
 insert into public.assessment_item_options(item_id,label,content,is_correct,feedback,distractor_analysis,sort_order) select new_id,label,content,is_correct,feedback,distractor_analysis,sort_order from public.assessment_item_options where item_id=i.id;
 insert into public.audit_logs(network_id,actor_id,entity_type,entity_id,action,metadata) values(i.network_id,auth.uid(),'assessment_item',new_id,'revision_created',jsonb_build_object('revision_of',i.id)); return new_id;
end; $$;

create function public.item_bank_directory(target_network uuid,filters jsonb default '{}',page_size integer default 20,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('item.read',target_network) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from(select i.id as item_id,i.internal_title,i.statement,i.item_type,i.difficulty,i.status as item_status,c.name as curriculum_name,s.name as subject_name,y.name as school_year_name,sk.code as skill_code,p.display_name as author_name,r.display_name as reviewer_name,a.display_name as approver_name,i.current_version,i.updated_at,count(*) over() as total_count
 from public.assessment_items i join public.curricula c on c.id=i.curriculum_id join public.curriculum_subjects s on s.id=i.subject_id join public.curriculum_school_years y on y.id=i.curriculum_school_year_id join public.curriculum_skills sk on sk.id=i.skill_id join public.profiles p on p.id=i.author_id left join public.profiles r on r.id=i.reviewer_id left join public.profiles a on a.id=i.approver_id
 where i.network_id=target_network and (coalesce(filters->>'curriculum','')='' or i.curriculum_id::text=filters->>'curriculum') and (coalesce(filters->>'subject','')='' or i.subject_id::text=filters->>'subject') and (coalesce(filters->>'year','')='' or i.curriculum_school_year_id::text=filters->>'year') and (coalesce(filters->>'skill','')='' or i.skill_id::text=filters->>'skill') and (coalesce(filters->>'difficulty','')='' or i.difficulty=filters->>'difficulty') and (coalesce(filters->>'status','')='' or i.status=filters->>'status') and (coalesce(filters->>'type','')='' or i.item_type=filters->>'type') and (coalesce(filters->>'author','')='' or i.author_id::text=filters->>'author') and (coalesce(filters->>'reviewer','')='' or i.reviewer_id::text=filters->>'reviewer') and (coalesce(filters->>'approver','')='' or i.approver_id::text=filters->>'approver') and (coalesce(filters->>'search','')='' or to_tsvector('portuguese',i.internal_title||' '||i.statement)@@plainto_tsquery('portuguese',filters->>'search'))
 order by i.updated_at desc,i.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q; return result;
end; $$;
create index item_bank_type_status_idx on public.assessment_items(network_id,item_type,status,updated_at desc);
create index item_bank_search_idx on public.assessment_items using gin(to_tsvector('portuguese',internal_title||' '||statement));
create function public.item_bank_coverage(target_network uuid,target_curriculum uuid,minimum_items integer default 5,page_size integer default 50,page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare totals jsonb; groups jsonb; skills jsonb;
begin
 if not private.has_permission('item.read',target_network) or not private.can_read_curriculum(target_curriculum) then raise exception 'Not authorized'; end if;
 select jsonb_build_object('total',count(*),'draft',count(*) filter(where status='draft'),'in_review',count(*) filter(where status='in_review'),'reviewed',count(*) filter(where status='reviewed'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) into totals from public.assessment_items where network_id=target_network and curriculum_id=target_curriculum;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into groups from(select s.name as componente,y.name as serie,i.difficulty,count(*) as items,count(*) filter(where i.status='approved') as approved from public.assessment_items i join public.curriculum_subjects s on s.id=i.subject_id join public.curriculum_school_years y on y.id=i.curriculum_school_year_id where i.network_id=target_network and i.curriculum_id=target_curriculum group by s.name,y.name,i.difficulty order by s.name,y.name,i.difficulty) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into skills from(select sk.code,sk.description,count(i.id) as items,count(i.id) filter(where i.status='approved') as approved,count(*) over() as total_count from public.curriculum_skills sk left join public.assessment_items i on i.skill_id=sk.id and i.network_id=target_network where sk.curriculum_id=target_curriculum and sk.active group by sk.id order by count(i.id),sk.code limit least(greatest(page_size,1),100) offset greatest(page_offset,0)) q;
 totals=totals|| (select jsonb_build_object('uncovered',count(*) filter(where n=0),'low_coverage',count(*) filter(where n<greatest(minimum_items,1))) from(select count(i.id) n from public.curriculum_skills sk left join public.assessment_items i on i.skill_id=sk.id and i.network_id=target_network and i.status='approved' where sk.curriculum_id=target_curriculum and sk.active group by sk.id) counts);
 return jsonb_build_object('totals',totals,'groups',groups,'skills',skills,'minimum_items',greatest(minimum_items,1));
end; $$;

-- Private item images: immutable object names; approved snapshots keep their assets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('assessment-item-images','assessment-item-images',false,5242880,array['image/png','image/jpeg','image/webp']);
create function private.can_use_item_image(object_name text,write_access boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]; item_id uuid; network_id uuid;
begin
 parts=string_to_array(object_name,'/');
 if cardinality(parts)<>3 or parts[3]!~ '^[a-f0-9-]+\.(png|jpg|jpeg|webp)$' then return false; end if;
 begin network_id=parts[1]::uuid; item_id=parts[2]::uuid; exception when invalid_text_representation then return false; end;
 return exists(select 1 from public.assessment_items i where i.id=item_id and i.network_id=network_id) and case when write_access then private.can_edit_item(item_id) else private.can_read_item(item_id) end;
end; $$;
revoke all on function private.can_use_item_image(text,boolean) from public,anon,authenticated; grant execute on function private.can_use_item_image(text,boolean) to authenticated;
create policy item_images_read on storage.objects for select to authenticated using(bucket_id='assessment-item-images' and private.can_use_item_image(name,false));
create policy item_images_insert on storage.objects for insert to authenticated with check(bucket_id='assessment-item-images' and private.can_use_item_image(name,true));
-- No overwrite. Removal only for assets that were never included in a frozen version.
create policy item_images_delete on storage.objects for delete to authenticated using(bucket_id='assessment-item-images' and private.can_use_item_image(name,true) and not exists(select 1 from public.assessment_item_versions v where v.snapshot::text like '%'||name||'%'));
alter table public.assessment_items add column image_paths text[] not null default '{}';
create function public.set_item_images(target_item uuid,paths text[])
returns void language plpgsql security definer set search_path='' as $$
declare p text; i public.assessment_items%rowtype;
begin
 select * into i from public.assessment_items where id=target_item for update;
 if i.id is null or not private.can_edit_item(i.id) then raise exception 'Not authorized'; end if;
 if cardinality(paths)>10 then raise exception 'At most 10 images'; end if;
 foreach p in array coalesce(paths,'{}') loop
 if p not like i.network_id::text||'/'||i.id::text||'/%' or not exists(select 1 from storage.objects o where o.bucket_id='assessment-item-images' and o.name=p) then raise exception 'Image outside item scope'; end if;
 end loop;
 update public.assessment_items set image_paths=coalesce(paths,'{}'),updated_at=now() where id=i.id;
end; $$;

revoke all on function public.import_curriculum_rows(uuid,uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.import_curriculum_rows(uuid,uuid,uuid,text,jsonb,boolean) to authenticated;

revoke all on function public.curriculum_skill_directory(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.curriculum_skill_directory(uuid,jsonb,integer,integer) to authenticated;

revoke all on function public.save_assessment_item(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_assessment_item(uuid,jsonb,jsonb,uuid) to authenticated;

revoke all on function public.revise_assessment_item(uuid) from public,anon,authenticated;
grant execute on function public.revise_assessment_item(uuid) to authenticated;

revoke all on function public.item_bank_directory(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.item_bank_directory(uuid,jsonb,integer,integer) to authenticated;

revoke all on function public.item_bank_coverage(uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.item_bank_coverage(uuid,uuid,integer,integer,integer) to authenticated;

revoke all on function public.set_item_images(uuid,text[]) from public,anon,authenticated;
grant execute on function public.set_item_images(uuid,text[]) to authenticated;

grant execute on function public.import_curriculum_rows(uuid,uuid,uuid,text,jsonb,boolean) to service_role;
create function public.item_content_readiness(target_network uuid,target_subject uuid,target_year uuid,minimum_items integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare total integer; complete integer;
begin
 if not private.has_permission('item.read',target_network) then raise exception 'Not authorized'; end if;
 select count(*),count(*) filter(where length(trim(coalesce(i.pedagogical_comment,'')))>=5 and (i.item_type<>'multiple_choice' or (length(trim(coalesce(i.correct_answer_justification,'')))>=5 and (select count(*) from public.assessment_item_options o where o.item_id=i.id)=4 and (select count(*) from public.assessment_item_options o where o.item_id=i.id and o.is_correct)=1 and not exists(select 1 from public.assessment_item_options o where o.item_id=i.id and (length(trim(o.content))=0 or (not o.is_correct and length(trim(coalesce(o.distractor_analysis,'')))<5)))))) into total,complete from public.assessment_items i where i.network_id=target_network and i.subject_id=target_subject and i.curriculum_school_year_id=target_year and i.status='approved';
 return jsonb_build_object('approved',total,'complete',complete,'minimum',greatest(minimum_items,1),'ready',complete>=greatest(minimum_items,1));
end; $$;
revoke all on function public.item_content_readiness(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.item_content_readiness(uuid,uuid,uuid,integer) to authenticated;
