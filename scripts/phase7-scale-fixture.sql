-- Uso exclusivo com Supabase local descartável, após seed:poc e seed:phase7.
-- 12.849 identidades sintéticas reais no schema local, distribuídas em 33 escolas.
begin;

insert into public.school_years(school_id,name,code,sort_order)
select school.id,'6º ano escala DEMO','F7-SCALE-6',6
from public.schools school
join public.networks network on network.id=school.network_id
where network.name='POC DEMO Monte Mor - dados sinteticos'
on conflict(school_id,code) do nothing;

insert into public.classrooms(owner_id,name,subject,join_code,network_id,school_id,academic_year_id,school_year_id,classroom_status)
select network.created_by,'Turma escala Fase 7 DEMO','Matemática','F7-'||school.code,
  network.id,school.id,year.id,school_year.id,'active'
from public.schools school
join public.networks network on network.id=school.network_id
join public.academic_years year on year.network_id=network.id and year.label='Ano letivo POC 2026'
join public.school_years school_year on school_year.school_id=school.id and school_year.code='F7-SCALE-6'
where network.name='POC DEMO Monte Mor - dados sinteticos'
on conflict(school_id,academic_year_id,name) where school_id is not null and academic_year_id is not null do nothing;

create temp table phase7_scale_map on commit drop as
select school.id school_id,classroom.id classroom_id,network.id network_id,year.id academic_year_id,
  row_number() over(order by school.code)::integer school_number
from public.schools school
join public.networks network on network.id=school.network_id
join public.academic_years year on year.network_id=network.id and year.label='Ano letivo POC 2026'
join public.classrooms classroom on classroom.school_id=school.id and classroom.name='Turma escala Fase 7 DEMO'
where network.name='POC DEMO Monte Mor - dados sinteticos';

do $$ begin
  if (select count(*) from phase7_scale_map)<>33 then raise exception 'Expected 33 synthetic schools'; end if;
end $$;

insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select md5('phase7-scale-student-'||n)::uuid,'00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated','authenticated','phase7-scale-'||n||'@poc.aprende.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name','Estudante sintético escala '||n,'synthetic_poc',true),now(),now()
from generate_series(1,12849) n
on conflict(id) do nothing;

create temp table phase7_scale_students on commit drop as
select md5('phase7-scale-student-'||n)::uuid student_id,map.*
from generate_series(1,12849) n
join phase7_scale_map map on map.school_number=((n-1)%33)+1;

insert into public.learning_journeys(id,network_id,skill_id,title,description,status,current_version,created_by,approved_by,published_at)
select md5('phase7-scale-catalog-'||n)::uuid,network.id,source.skill_id,
  'Jornada catálogo escala DEMO '||lpad(n::text,4,'0'),
  'Jornada sintética de uma etapa criada exclusivamente para medir paginação e busca.',
  'published',1,network.created_by,network.created_by,now()
from generate_series(1,1500) n
join public.networks network on network.name='POC DEMO Monte Mor - dados sinteticos'
join public.learning_journeys source on source.network_id=network.id and source.title='Reconstruindo estratégias de cálculo - DEMO'
on conflict(id) do nothing;

insert into public.learning_journey_steps(id,journey_id,resource_id,title,instructions,step_type,position)
select md5('phase7-scale-step-'||journey.id)::uuid,journey.id,resource.id,
  'Leitura sintética','Leia o material DEMO.','content',1
from public.learning_journeys journey
join public.pedagogical_resources resource on resource.network_id=journey.network_id and resource.title='Estratégias de cálculo - DEMO'
where journey.title like 'Jornada catálogo escala DEMO %'
on conflict(id) do nothing;

insert into public.learning_journey_versions(id,journey_id,version_number,snapshot,created_by)
select md5('phase7-scale-version-'||journey.id)::uuid,journey.id,1,
  jsonb_build_object('journey',to_jsonb(journey),'steps',jsonb_build_array(to_jsonb(step))),journey.created_by
from public.learning_journeys journey
join public.learning_journey_steps step on step.journey_id=journey.id
where journey.title like 'Jornada catálogo escala DEMO %'
on conflict(id) do nothing;

insert into public.institutional_memberships(user_id,network_id,school_id,role,status)
select student_id,network_id,school_id,'student','active' from phase7_scale_students
on conflict do nothing;

insert into public.student_enrollments(student_id,network_id,school_id,academic_year_id,classroom_id,status,source,external_key)
select student_id,network_id,school_id,academic_year_id,classroom_id,'enrolled','manual','F7-SCALE-'||student_id
from phase7_scale_students
on conflict(student_id,academic_year_id) where status='enrolled' do nothing;

insert into public.learning_journey_assignments(journey_id,journey_version_id,network_id,school_id,classroom_id,target_type,reason,status,idempotency_key,assigned_by)
select journey.id,version.id,map.network_id,map.school_id,map.classroom_id,'classroom',
  'Atribuição sintética para medir escala Fase 7','active',md5('phase7-scale-assignment-'||map.classroom_id)::uuid,network.created_by
from phase7_scale_map map
join public.networks network on network.id=map.network_id
join public.learning_journeys journey on journey.network_id=map.network_id and journey.title='Reconstruindo estratégias de cálculo - DEMO'
join public.learning_journey_versions version on version.journey_id=journey.id and version.version_number=journey.current_version
on conflict(assigned_by,idempotency_key) do nothing;

insert into public.learning_journey_students(assignment_id,student_id,status,progress_percentage,gamification_points,started_at)
select assignment.id,student.student_id,'in_progress',33.33,10,now()
from phase7_scale_students student
join public.learning_journey_assignments assignment on assignment.classroom_id=student.classroom_id
  and assignment.idempotency_key=md5('phase7-scale-assignment-'||student.classroom_id)::uuid
on conflict(assignment_id,student_id) do nothing;

insert into public.learning_journey_step_progress(assignment_id,student_id,step_id,status,response,started_at,completed_at)
select recipient.assignment_id,recipient.student_id,step.id,'completed','{"acknowledged":true}'::jsonb,now(),now()
from public.learning_journey_students recipient
join public.learning_journey_assignments assignment on assignment.id=recipient.assignment_id
join public.learning_journey_steps step on step.journey_id=assignment.journey_id and step.position=1
where assignment.idempotency_key=md5('phase7-scale-assignment-'||assignment.classroom_id)::uuid
on conflict(assignment_id,student_id,step_id) do nothing;

insert into public.pedagogical_recommendations(network_id,school_id,classroom_id,student_id,skill_id,journey_id,observed_percentage,threshold_percentage,explanation,created_by)
select assignment.network_id,assignment.school_id,assignment.classroom_id,recipient.student_id,journey.skill_id,journey.id,
  50,60,'Observação sintética da escala Fase 7; não é diagnóstico real.',assignment.assigned_by
from public.learning_journey_students recipient
join public.learning_journey_assignments assignment on assignment.id=recipient.assignment_id
join public.learning_journeys journey on journey.id=assignment.journey_id
where assignment.idempotency_key=md5('phase7-scale-assignment-'||assignment.classroom_id)::uuid
  and not exists(select 1 from public.pedagogical_recommendations r where r.student_id=recipient.student_id and r.journey_id=journey.id);

analyze public.student_enrollments;
analyze public.learning_journey_assignments;
analyze public.learning_journeys;
analyze public.learning_journey_students;
analyze public.learning_journey_step_progress;
analyze public.pedagogical_recommendations;

do $$ begin
  if (select count(*) from phase7_scale_students)<>12849 then raise exception 'Expected 12849 synthetic students'; end if;
  if (select count(*) from public.learning_journey_students r join public.learning_journey_assignments a on a.id=r.assignment_id where a.reason='Atribuição sintética para medir escala Fase 7')<>12849 then raise exception 'Expected 12849 synthetic assignments'; end if;
end $$;
commit;

explain (analyze,buffers,format json)
select a.network_id,count(distinct r.student_id),count(*) filter(where r.status='in_progress')
from public.learning_journey_assignments a
join public.learning_journey_students r on r.assignment_id=a.id
where a.reason='Atribuição sintética para medir escala Fase 7'
group by a.network_id;

explain (analyze,buffers,format json)
select network_id,skill_id,count(*),avg(observed_percentage)
from public.pedagogical_recommendations
where explanation='Observação sintética da escala Fase 7; não é diagnóstico real.'
group by network_id,skill_id;
