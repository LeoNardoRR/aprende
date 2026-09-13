import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const isLocal = (target) => { try { return ['127.0.0.1','localhost'].includes(new URL(target).hostname); } catch { return false; } };
const value = (result) => { assert.ifError(result.error); return result.data; };

async function signedIn(email, password) {
  const client = createClient(url, anonKey, options);
  value(await client.auth.signInWithPassword({ email, password }));
  return client;
}

test('Phase 5 closes attempt, curriculum, proficiency and tenant analytics end to end', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) return t.skip('Phase 5 integration runs only against disposable local Supabase.');
  const service = createClient(url, serviceRoleKey, options);
  const anonymous = createClient(url, anonKey, options);
  const suffix = randomUUID().slice(0,8);
  const password = `Local-phase5-${suffix}-!Aa12345`;
  const roles = ['adminA','adminB','managerA','teacherA','teacherB','student1','student2','student3','student4','student5'];
  const ids = {}; const clients = {}; const networkIds = [];

  t.after(async () => {
    if (networkIds.length) {
      await service.from('assessment_attempts').delete().in('network_id', networkIds);
      await service.from('audit_logs').delete().in('network_id', networkIds);
      await service.from('networks').delete().in('id', networkIds);
    }
    for (const id of Object.values(ids).reverse()) await service.auth.admin.deleteUser(id);
  });

  for (const role of roles) {
    const email = `phase5-${role.toLowerCase()}-${suffix}@example.test`;
    ids[role] = value(await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Fase 5 ${role}` } })).user.id;
    clients[role] = await signedIn(email,password);
  }
  for (const role of ['adminA','adminB']) value(await service.from('profiles').update({ role: 'network_admin' }).eq('id',ids[role]));

  const networkA = value(await service.from('networks').insert({ name: `Rede F5 A ${suffix}`, created_by: ids.adminA }).select().single());
  const networkB = value(await service.from('networks').insert({ name: `Rede F5 B ${suffix}`, created_by: ids.adminB }).select().single());
  networkIds.push(networkA.id,networkB.id);
  const schoolA = value(await service.from('schools').insert({ network_id: networkA.id, name: 'Escola A F5', code: `F5A-${suffix}` }).select().single());
  const schoolB = value(await service.from('schools').insert({ network_id: networkA.id, name: 'Escola B F5', code: `F5B-${suffix}` }).select().single());
  const year = value(await service.from('academic_years').insert({ network_id: networkA.id, label: `2026 F5 ${suffix}`, starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'open' }).select().single());
  const gradeA = value(await service.from('school_years').insert({ school_id: schoolA.id, name: '7º ano', code: `7A-${suffix}` }).select().single());
  const gradeB = value(await service.from('school_years').insert({ school_id: schoolB.id, name: '7º ano', code: `7B-${suffix}` }).select().single());
  for (const [role,school,memberRole] of [['managerA',schoolA.id,'manager'],['teacherA',schoolA.id,'teacher'],['teacherB',schoolB.id,'teacher'],...['student1','student2','student3','student4','student5'].map((role) => [role,schoolA.id,'student'])]) {
    value(await service.from('institutional_memberships').insert({ user_id: ids[role], network_id: networkA.id, school_id: school, role: memberRole, status: 'active', created_by: ids.adminA }));
  }
  const classA = value(await service.from('classrooms').insert({ owner_id: ids.teacherA, name: `Turma F5 A ${suffix}`, subject: 'Matemática', join_code: `5A${suffix.toUpperCase()}`, network_id: networkA.id, school_id: schoolA.id, academic_year_id: year.id, school_year_id: gradeA.id, classroom_status: 'active' }).select().single());
  value(await service.from('classrooms').insert({ owner_id: ids.teacherB, name: `Turma F5 B ${suffix}`, subject: 'Matemática', join_code: `5B${suffix.toUpperCase()}`, network_id: networkA.id, school_id: schoolB.id, academic_year_id: year.id, school_year_id: gradeB.id, classroom_status: 'active' }));
  for (const role of ['student1','student2','student3','student4','student5']) value(await service.from('student_enrollments').insert({ student_id: ids[role], network_id: networkA.id, school_id: schoolA.id, academic_year_id: year.id, classroom_id: classA.id, status: 'enrolled', source: 'manual', created_by: ids.adminA }));

  const curriculum = value(await service.from('curricula').insert({ network_id: networkA.id, name: `Currículo F5 ${suffix}`, curriculum_type: 'custom', version: '1', created_by: ids.adminA }).select().single());
  const area = value(await service.from('curriculum_areas').insert({ curriculum_id: curriculum.id, name: 'Matemática' }).select().single());
  const subject = value(await service.from('curriculum_subjects').insert({ curriculum_id: curriculum.id, area_id: area.id, name: 'Matemática' }).select().single());
  const curriculumYear = value(await service.from('curriculum_school_years').insert({ curriculum_id: curriculum.id, school_year_id: gradeA.id, code: `7EF-${suffix}`, name: '7º ano' }).select().single());
  const unit = value(await service.from('curriculum_thematic_units').insert({ curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYear.id, name: 'Números' }).select().single());
  const object = value(await service.from('curriculum_knowledge_objects').insert({ curriculum_id: curriculum.id, thematic_unit_id: unit.id, name: 'Operações' }).select().single());
  const skill = value(await service.from('curriculum_skills').insert({ curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYear.id, thematic_unit_id: unit.id, knowledge_object_id: object.id, code: `F5-${suffix}`, description: 'Habilidade DEMO determinística para analytics.' }).select().single());

  const itemFixtures = [];
  for (let index=0; index<4; index+=1) {
    const item = value(await service.from('assessment_items').insert({ network_id: networkA.id, curriculum_id: curriculum.id, curriculum_school_year_id: curriculumYear.id, subject_id: subject.id, skill_id: skill.id, thematic_unit_id: unit.id, knowledge_object_id: object.id, internal_title: `DEMO F5 item ${index+1}`, statement: `Questão determinística ${index+1} da Fase 5.`, difficulty: 'medium', item_type: 'multiple_choice', status: 'approved', author_id: ids.teacherA }).select().single());
    const correct = randomUUID(); const wrong = randomUUID();
    const snapshot = { id: item.id, statement: item.statement, item_type: 'multiple_choice', skill_id: skill.id, thematic_unit_id: unit.id, knowledge_object_id: object.id, options: [{ id: correct,label:'A',content:'Correta',is_correct:true },{ id: wrong,label:'B',content:'Distrator',is_correct:false }] };
    const version = value(await service.from('assessment_item_versions').insert({ item_id: item.id, version_number: 1, snapshot, created_by: ids.teacherA }).select().single());
    itemFixtures.push({ item, version, snapshot, correct, wrong });
  }
  const startsAt = new Date(Date.now()-3600000).toISOString(); const endsAt = new Date(Date.now()+3600000).toISOString();
  const cycle = value(await service.from('assessment_cycles').insert({ network_id: networkA.id, name: `Ciclo F5 ${suffix}`, starts_at: startsAt, ends_at: endsAt, created_by: ids.adminA }).select().single());
  const assessment = value(await service.from('diagnostic_assessments').insert({ cycle_id: cycle.id, network_id: networkA.id, curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYear.id, title: `Avaliação F5 ${suffix}`, instructions: 'Avaliação determinística.', duration_minutes: 60, created_by: ids.teacherA, status: 'ready', total_points: 40 }).select().single());
  const booklet = value(await service.from('assessment_booklets').insert({ assessment_id: assessment.id, network_id: networkA.id, code: 'A', title: 'Caderno A', created_by: ids.teacherA }).select().single());
  const bookletItems = [];
  for (let index=0; index<4; index+=1) bookletItems.push(value(await service.from('assessment_booklet_items').insert({ booklet_id: booklet.id, assessment_id: assessment.id, assessment_item_id: itemFixtures[index].item.id, assessment_item_version_id: itemFixtures[index].version.id, position: index+1, points: 10 }).select().single()));
  const schedule = value(await service.from('assessment_schedules').insert({ assessment_id: assessment.id, network_id: networkA.id, school_id: schoolA.id, starts_at: startsAt, ends_at: endsAt, status: 'active', assigned_by: ids.teacherA }).select().single());
  value(await service.from('assessment_classrooms').insert({ schedule_id: schedule.id, assessment_id: assessment.id, classroom_id: classA.id }));

  const patterns = [[1,1,1,1],[1,1,1,0],[1,1,0,0],[1,0,0,0]];
  for (let studentIndex=0; studentIndex<4; studentIndex+=1) {
    const attempt = value(await service.from('assessment_attempts').insert({ assessment_id: assessment.id, schedule_id: schedule.id, classroom_id: classA.id, student_id: ids[`student${studentIndex+1}`], booklet_id: booklet.id, network_id: networkA.id, school_id: schoolA.id, status: 'graded', submission_kind: 'submitted', access_origin: 'staff', allowed_minutes: 60, started_at: startsAt, deadline_at: endsAt, submitted_at: new Date().toISOString(), score: patterns[studentIndex].reduce((sum,item) => sum+item*10,0), max_score: 40 }).select().single());
    for (let itemIndex=0; itemIndex<4; itemIndex+=1) {
      const fact = itemFixtures[itemIndex]; const correct = Boolean(patterns[studentIndex][itemIndex]);
      const attemptItem = value(await service.from('assessment_attempt_items').insert({ attempt_id: attempt.id, source_booklet_item_id: bookletItems[itemIndex].id, assessment_item_version_id: fact.version.id, position: itemIndex+1, snapshot: fact.snapshot, option_order: [fact.correct,fact.wrong], max_points: 10, time_spent_seconds: 20+itemIndex }).select().single());
      value(await service.from('assessment_responses').insert({ attempt_id: attempt.id, attempt_item_id: attemptItem.id, answer: { option_id: correct ? fact.correct : fact.wrong }, is_correct: correct, points_awarded: correct ? 10 : 0, review_status: 'not_required' }));
    }
  }

  await t.test('scope totals close mathematically and participation uses scheduled enrollment', async () => {
    const network = value(await clients.adminA.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id, assessment_id: assessment.id } }));
    assert.equal(Number(network.summary.eligible_students),5); assert.equal(Number(network.summary.completed),4); assert.equal(Number(network.summary.participation_percentage),80);
    assert.equal(Number(network.statistics.mean),62.5); assert.equal(Number(network.statistics.median),62.5); assert.equal(Number(network.statistics.minimum),25); assert.equal(Number(network.statistics.maximum),100);
    assert.equal(Number(network.statistics.variance),781.25); assert.ok(Math.abs(Number(network.statistics.standard_deviation)-27.9508)<0.0001);
    assert.equal(Number(network.summary.questions),16); assert.equal(Number(network.summary.correct),10); assert.equal(Number(network.summary.incorrect),6);
    assert.equal(network.skills.length,1); assert.equal(Number(network.skills[0].percentage),62.5);
    assert.equal(network.items.length,4); assert.ok(network.items.every((item) => Number(item.average_time_seconds)>=20));
  });

  await t.test('versioned proficiency and Cronbach alpha use deterministic results', async () => {
    const levels = [{ code:'below_basic',label:'Abaixo do Básico',lower_bound:0,upper_bound:25 },{ code:'basic',label:'Básico',lower_bound:25,upper_bound:50 },{ code:'adequate',label:'Adequado',lower_bound:50,upper_bound:75 },{ code:'advanced',label:'Avançado',lower_bound:75,upper_bound:100 }];
    const scale = value(await clients.managerA.rpc('create_proficiency_scale',{ target_network: networkA.id, scale_name: `Escala F5 ${suffix}`, scale_version: 1, effective_from: '2026-01-01', levels }));
    value(await clients.managerA.rpc('assign_assessment_proficiency_scale',{ target_assessment: assessment.id, target_scale: scale }));
    const dashboard = value(await clients.managerA.rpc('get_analytics_dashboard',{ filters: { assessment_id: assessment.id } }));
    assert.deepEqual(dashboard.proficiency.map((row) => [row.code,Number(row.count)]), [['below_basic',0],['basic',1],['adequate',1],['advanced',2]]);
    const reliability = value(await clients.managerA.rpc('get_assessment_reliability',{ target_assessment: assessment.id, filters: {} }));
    assert.equal(reliability.items,4); assert.equal(reliability.participants,4); assert.ok(Math.abs(Number(reliability.cronbach_alpha)-0.6667)<0.0001);
    assert.ok((await clients.managerA.rpc('assign_assessment_proficiency_scale',{ target_assessment: assessment.id, target_scale: scale })).error);
  });

  await t.test('student, teacher, manager, other network and anonymous calls are isolated server-side', async () => {
    const own = value(await clients.student1.rpc('get_analytics_dashboard',{ filters: { assessment_id: assessment.id } }));
    assert.equal(Number(own.summary.students),1); assert.equal(own.students[0].student_id,ids.student1); assert.equal(own.items.length,0);
    assert.equal(value(await clients.student1.rpc('get_item_option_distribution',{ target_assessment:assessment.id,filters:{} })).length,0);
    assert.equal(value(await clients.student1.rpc('get_assessment_reliability',{ target_assessment:assessment.id,filters:{} })).available,false);
    const manipulated = value(await clients.student1.rpc('get_analytics_dashboard',{ filters: { student_id: ids.student2 } }));
    assert.equal(manipulated.state,'empty'); assert.equal(Number(manipulated.summary.students),0);
    const teacher = value(await clients.teacherA.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id } })); assert.equal(Number(teacher.summary.students),4);
    const otherClass = value(await clients.teacherB.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id } })); assert.equal(otherClass.state,'empty');
    const manager = value(await clients.managerA.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id } })); assert.equal(Number(manager.summary.students),4);
    const otherNetwork = value(await clients.adminB.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id } })); assert.equal(otherNetwork.state,'empty');
    assert.ok((await anonymous.rpc('get_analytics_dashboard',{ filters: { network_id: networkA.id } })).error);
    assert.equal(value(await clients.student1.from('proficiency_scales').select('id')).length,0);
    assert.ok((await clients.student1.from('analytics_report_jobs').insert({ network_id: networkA.id, report_type: 'student_batch', format:'zip', idempotency_key: randomUUID(), requested_by: ids.student1 })).error);
  });

  await t.test('report jobs are idempotent and restricted to the requester', async () => {
    const key = randomUUID(); const filters = { network_id: networkA.id, school_id: schoolA.id, classroom_id: classA.id, assessment_id: assessment.id };
    const first = value(await clients.managerA.rpc('request_analytics_report',{ report_type:'student_batch', report_format:'zip', filters, request_key:key }));
    const replay = value(await clients.managerA.rpc('request_analytics_report',{ report_type:'student_batch', report_format:'zip', filters, request_key:key }));
    assert.equal(first,replay); assert.equal(value(await clients.managerA.rpc('list_analytics_report_jobs')).filter((job) => job.id===first).length,1);
    assert.ok((await clients.managerA.rpc('request_analytics_report',{ report_type:'student_batch', report_format:'zip', filters:{...filters,skill_id:skill.id}, request_key:key })).error);
    assert.equal(value(await clients.teacherA.rpc('list_analytics_report_jobs')).some((job) => job.id===first),false);
  });

  await t.test('server aggregation stays bounded with 12,849 attempts and paginates detail rows', { skip: process.env.PHASE5_LOAD_TEST !== '1' }, async () => {
    const target = 12_849; const additional = target-patterns.length;
    const chunkSize = 400;
    for (let offset=0; offset<additional; offset+=chunkSize) {
      const size = Math.min(chunkSize,additional-offset);
      const scheduleRows = Array.from({ length:size }, () => ({ assessment_id: assessment.id, network_id: networkA.id, school_id: schoolA.id, starts_at: startsAt, ends_at: endsAt, status: 'closed', assigned_by: ids.adminA }));
      const createdSchedules = value(await service.from('assessment_schedules').insert(scheduleRows).select('id'));
      value(await service.from('assessment_classrooms').insert(createdSchedules.map((row) => ({ schedule_id:row.id, assessment_id:assessment.id, classroom_id:classA.id }))));
      value(await service.from('assessment_attempts').insert(createdSchedules.map((row) => ({ assessment_id:assessment.id, schedule_id:row.id, classroom_id:classA.id, student_id:ids.student1, booklet_id:booklet.id, network_id:networkA.id, school_id:schoolA.id, status:'graded', submission_kind:'submitted', access_origin:'staff', allowed_minutes:60, started_at:startsAt, deadline_at:endsAt, submitted_at:new Date().toISOString(), score:0, max_score:0 }))));
    }
    const started = performance.now();
    const result = value(await clients.adminA.rpc('get_analytics_dashboard',{ filters:{ assessment_id:assessment.id, page:65, page_size:200 } }));
    const elapsed = performance.now()-started;
    assert.equal(Number(result.summary.attempts),target);
    assert.ok(result.students.length<=200);
    assert.ok(elapsed<12_000,`12,849-attempt aggregation took ${elapsed.toFixed(0)} ms`);
    t.diagnostic(`Phase 5 12,849-attempt aggregation: ${elapsed.toFixed(0)} ms`);
  });
});
