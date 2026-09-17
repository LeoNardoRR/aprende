import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root } from './poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const isLocal = (target) => { try { return ['localhost', '127.0.0.1'].includes(new URL(target).hostname); } catch { return false; } };
if (!isLocal(url) || !serviceKey) throw new Error('seed:poc exige SUPABASE_URL local e SUPABASE_SERVICE_ROLE_KEY da instancia descartavel.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const value = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const one = async (table, payload) => value(await db.from(table).insert(payload).select().single(), `insert ${table}`);
const emailFor = (key) => `${key}@poc.aprende.invalid`;
const roleSpecs = [
  ['admin', 'network_admin', 'Administrador DEMO'],
  ['manager1', 'manager', 'Gestora Escola 1 DEMO'], ['manager2', 'manager', 'Gestor Escola 2 DEMO'], ['manager3', 'manager', 'Gestora Escola 3 DEMO'],
  ['teacher1', 'teacher', 'Professora Escola 1 DEMO'], ['teacher2', 'teacher', 'Professor Escola 2 DEMO'], ['teacher3', 'teacher', 'Professora Escola 3 DEMO'],
  ['reviewer', 'reviewer', 'Revisora DEMO'], ['approver', 'approver', 'Aprovador DEMO'],
  ...Array.from({ length: 12 }, (_, index) => [`student${index + 1}`, 'student', `Estudante DEMO ${String(index + 1).padStart(2, '0')}`]),
];

console.log('Reconstruindo exclusivamente o conjunto POC local...');
const priorNetworks = value(await db.from('networks').select('id').eq('name', 'POC DEMO Monte Mor - dados sinteticos'), 'find POC network');
if (priorNetworks.length) {
  const networkIds = priorNetworks.map((row) => row.id);
  // Fase 7 referencia currículo e avaliações com FKs restritivas. A limpeza
  // começa pelo domínio de intervenção para manter o seed completo idempotente.
  for (const table of ['pedagogical_recommendations', 'learning_journey_assignments', 'reading_fluency_activities', 'equity_group_definitions', 'ai_pedagogical_suggestions', 'learning_journeys', 'pedagogical_resources', 'remediation_programs']) {
    value(await db.from(table).delete().in('network_id', networkIds), `delete POC ${table}`);
  }
  const assessments = value(await db.from('diagnostic_assessments').select('id').in('network_id', networkIds), 'find POC assessments');
  const assessmentIds = assessments.map((row) => row.id);
  const items = value(await db.from('assessment_items').select('id').in('network_id', networkIds), 'find POC items');
  const itemIds = items.map((row) => row.id);
  if (assessmentIds.length) value(await db.from('assessment_proficiency_scales').delete().in('assessment_id', assessmentIds), 'delete POC scale assignments');
  value(await db.from('proficiency_scales').delete().in('network_id', networkIds), 'delete POC proficiency scales');
  value(await db.from('analytics_report_jobs').delete().in('network_id', networkIds), 'delete POC report jobs');
  value(await db.from('assessment_attempts').delete().in('network_id', networkIds), 'delete POC attempts');
  if (assessmentIds.length) {
    value(await db.from('assessment_classrooms').delete().in('assessment_id', assessmentIds), 'delete POC assessment classrooms');
    value(await db.from('assessment_schedules').delete().in('assessment_id', assessmentIds), 'delete POC assessment schedules');
    value(await db.from('assessment_booklet_items').delete().in('assessment_id', assessmentIds), 'delete POC booklet items');
    value(await db.from('assessment_booklets').delete().in('assessment_id', assessmentIds), 'delete POC booklets');
  }
  value(await db.from('diagnostic_assessments').delete().in('network_id', networkIds), 'delete POC assessments');
  value(await db.from('assessment_cycles').delete().in('network_id', networkIds), 'delete POC assessment cycles');
  if (itemIds.length) value(await db.from('assessment_item_versions').delete().in('item_id', itemIds), 'delete POC item versions');
  value(await db.from('assessment_items').delete().in('network_id', networkIds), 'delete POC items');
  value(await db.from('audit_logs').delete().in('network_id', networkIds), 'delete POC audit logs');
  value(await db.from('student_enrollments').delete().in('network_id', networkIds), 'delete POC enrollments');
  value(await db.from('institutional_memberships').delete().in('network_id', networkIds), 'delete POC memberships');
  value(await db.from('classrooms').delete().in('network_id', networkIds), 'delete POC classrooms');
  value(await db.from('curricula').delete().in('network_id', networkIds), 'delete POC curricula');
  value(await db.from('networks').delete().in('id', networkIds), 'delete POC network');
}
const existingUsers = [];
for (let page = 1; page <= 10; page += 1) {
  const batch = value(await db.auth.admin.listUsers({ page, perPage: 1000 }), 'list local users').users;
  existingUsers.push(...batch);
  if (batch.length < 1000) break;
}
for (const user of existingUsers.filter((entry) => entry.email?.endsWith('@poc.aprende.invalid'))) value(await db.auth.admin.deleteUser(user.id), 'delete POC user');

const ids = {};
for (const [key, role, displayName] of roleSpecs) {
  const user = value(await db.auth.admin.createUser({ email: emailFor(key), password, email_confirm: true, user_metadata: { display_name: displayName, synthetic_poc: true } }), `create ${key}`).user;
  ids[key] = user.id;
  value(await db.from('profiles').update({ role }).eq('id', user.id), `role ${key}`);
}

const network = await one('networks', { name: 'POC DEMO Monte Mor - dados sinteticos', municipality: 'Monte Mor', state_code: 'SP', created_by: ids.admin });
const schools = [];
for (let index = 1; index <= 33; index += 1) schools.push(await one('schools', { network_id: network.id, name: `Escola Municipal DEMO ${String(index).padStart(2, '0')}`, code: `POC-E${String(index).padStart(2, '0')}` }));
const demonstrationSchools = schools.slice(0, 3);
const academicYear = await one('academic_years', { network_id: network.id, label: 'Ano letivo POC 2026', starts_on: '2026-02-02', ends_on: '2026-12-18', status: 'open' });
const schoolYears = [];
for (const [schoolIndex, school] of demonstrationSchools.entries()) {
  for (const [gradeIndex, grade] of ['6º ano', '7º ano', '8º ano'].entries()) schoolYears.push(await one('school_years', { school_id: school.id, name: grade, code: `POC-${6 + gradeIndex}EF`, sort_order: 6 + gradeIndex }));
  for (const [key, role] of [[`manager${schoolIndex + 1}`, 'manager'], [`teacher${schoolIndex + 1}`, 'teacher']]) await one('institutional_memberships', { user_id: ids[key], network_id: network.id, school_id: school.id, role, status: 'active', created_by: ids.admin });
}
// A trigger de criacao da rede provisiona o owner como network_admin.
for (const [key, role] of [['reviewer', 'reviewer'], ['approver', 'approver']]) await one('institutional_memberships', { user_id: ids[key], network_id: network.id, school_id: null, role, status: 'active', created_by: ids.admin });

const classrooms = [];
for (let index = 0; index < 6; index += 1) {
  const schoolIndex = Math.floor(index / 2); const gradeIndex = index % 3;
  classrooms.push(await one('classrooms', { owner_id: ids[`teacher${schoolIndex + 1}`], name: `${6 + gradeIndex}º ${index % 2 ? 'B' : 'A'} DEMO`, subject: 'Matemática', join_code: `POC${index + 1}MM`, network_id: network.id, school_id: demonstrationSchools[schoolIndex].id, academic_year_id: academicYear.id, school_year_id: schoolYears[schoolIndex * 3 + gradeIndex].id, classroom_status: 'active' }));
}
for (let index = 0; index < 12; index += 1) {
  const classroom = classrooms[Math.floor(index / 2)]; const schoolIndex = Math.floor(Math.floor(index / 2) / 2);
  await one('institutional_memberships', { user_id: ids[`student${index + 1}`], network_id: network.id, school_id: demonstrationSchools[schoolIndex].id, role: 'student', status: 'active', created_by: ids.admin });
  await one('student_enrollments', { student_id: ids[`student${index + 1}`], network_id: network.id, school_id: demonstrationSchools[schoolIndex].id, academic_year_id: academicYear.id, classroom_id: classroom.id, status: 'enrolled', source: 'manual', external_key: `POC-RA-${String(index + 1).padStart(4, '0')}`, created_by: ids.admin });
}

const curriculum = await one('curricula', { network_id: network.id, name: 'Curriculo municipal DEMO da PoC', curriculum_type: 'custom', version: 'POC-1', created_by: ids.admin });
const area = await one('curriculum_areas', { curriculum_id: curriculum.id, code: 'MAT', name: 'Matemática' });
const subject = await one('curriculum_subjects', { curriculum_id: curriculum.id, area_id: area.id, code: 'MAT', name: 'Matemática' });
const curriculumYears = [];
for (let index = 0; index < 3; index += 1) curriculumYears.push(await one('curriculum_school_years', { curriculum_id: curriculum.id, school_year_id: schoolYears[index].id, code: `POC-${6 + index}EF`, name: `${6 + index}º ano`, sort_order: 6 + index }));
const unit = await one('curriculum_thematic_units', { curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYears[0].id, name: 'Números - DEMO' });
const object = await one('curriculum_knowledge_objects', { curriculum_id: curriculum.id, thematic_unit_id: unit.id, name: 'Operações com números naturais - DEMO' });
const skills = [];
for (let index = 1; index <= 3; index += 1) skills.push(await one('curriculum_skills', { curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYears[0].id, thematic_unit_id: unit.id, knowledge_object_id: object.id, code: `POC-MAT-0${index}`, description: `Habilidade sintética ${index} criada exclusivamente para a demonstração local.` }));

const items = [];
for (let index = 0; index < 4; index += 1) {
  const item = await one('assessment_items', { network_id: network.id, curriculum_id: curriculum.id, curriculum_school_year_id: curriculumYears[0].id, subject_id: subject.id, skill_id: skills[index % skills.length].id, thematic_unit_id: unit.id, knowledge_object_id: object.id, internal_title: `DEMO POC item ${index + 1}`, statement: `Questão sintética ${index + 1}: qual alternativa está identificada como correta?`, correct_answer_justification: 'A alternativa A foi definida como correta apenas para o dataset determinístico.', difficulty: index < 2 ? 'easy' : 'medium', item_type: 'multiple_choice', status: 'approved', author_id: ids.teacher1, reviewer_id: ids.reviewer, approver_id: ids.approver });
  const optionA = await one('assessment_item_options', { item_id: item.id, label: 'A', content: 'Resposta correta DEMO', is_correct: true, feedback: 'Correta no cenário sintético.', sort_order: 1 });
  const optionB = await one('assessment_item_options', { item_id: item.id, label: 'B', content: 'Distrator DEMO', is_correct: false, distractor_analysis: 'Distrator sintético para análise.', sort_order: 2 });
  const snapshot = { id: item.id, statement: item.statement, item_type: item.item_type, skill_id: item.skill_id, thematic_unit_id: unit.id, knowledge_object_id: object.id, options: [optionA, optionB], image_paths: [] };
  const version = await one('assessment_item_versions', { item_id: item.id, version_number: 1, snapshot, change_summary: 'Versão aprovada do seed POC.', created_by: ids.approver });
  items.push({ item, version, optionA, optionB, snapshot });
}

const startsAt = new Date(Date.now() - 3_600_000).toISOString(); const endsAt = new Date(Date.now() + 86_400_000).toISOString();
const cycle = await one('assessment_cycles', { network_id: network.id, name: 'Ciclo Diagnóstico DEMO 2026', description: 'Ciclo sintético da PoC.', starts_at: startsAt, ends_at: endsAt, created_by: ids.admin });
const assessment = await one('diagnostic_assessments', { cycle_id: cycle.id, network_id: network.id, curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYears[0].id, title: 'Avaliação diagnóstica DEMO da PoC', instructions: 'Responda às questões sintéticas.', duration_minutes: 45, created_by: ids.teacher1, status: 'ready', total_points: 40 });
const booklet = await one('assessment_booklets', { assessment_id: assessment.id, network_id: network.id, code: 'A', title: 'Caderno A DEMO', created_by: ids.teacher1 });
const bookletItems = [];
for (const [index, fixture] of items.entries()) bookletItems.push(await one('assessment_booklet_items', { booklet_id: booklet.id, assessment_id: assessment.id, assessment_item_id: fixture.item.id, assessment_item_version_id: fixture.version.id, position: index + 1, points: 10 }));

const attempts = [];
const patterns = [[1,1,1,1],[1,1,1,0],[1,1,0,0],[1,0,0,0],[0,0,0,0],[1,0,1,0]];
for (const [classIndex, classroom] of classrooms.entries()) {
  const schoolIndex = Math.floor(classIndex / 2);
  const schedule = await one('assessment_schedules', { assessment_id: assessment.id, network_id: network.id, school_id: demonstrationSchools[schoolIndex].id, starts_at: startsAt, ends_at: endsAt, status: 'active', assigned_by: ids[`teacher${schoolIndex + 1}`] });
  await one('assessment_classrooms', { schedule_id: schedule.id, assessment_id: assessment.id, classroom_id: classroom.id });
  for (let studentOffset = 0; studentOffset < 2; studentOffset += 1) {
    const studentIndex = classIndex * 2 + studentOffset; const pattern = patterns[studentIndex % patterns.length];
    const attempt = await one('assessment_attempts', { assessment_id: assessment.id, schedule_id: schedule.id, classroom_id: classroom.id, student_id: ids[`student${studentIndex + 1}`], booklet_id: booklet.id, network_id: network.id, school_id: demonstrationSchools[schoolIndex].id, status: 'graded', submission_kind: 'submitted', access_origin: 'staff', allowed_minutes: 45, started_at: startsAt, deadline_at: endsAt, submitted_at: new Date().toISOString(), score: pattern.reduce((sum, current) => sum + current * 10, 0), max_score: 40 });
    for (const [itemIndex, fixture] of items.entries()) {
      const correct = Boolean(pattern[itemIndex]);
      const attemptItem = await one('assessment_attempt_items', { attempt_id: attempt.id, source_booklet_item_id: bookletItems[itemIndex].id, assessment_item_version_id: fixture.version.id, position: itemIndex + 1, snapshot: fixture.snapshot, option_order: [fixture.optionA.id, fixture.optionB.id], max_points: 10, time_spent_seconds: 18 + itemIndex + studentOffset });
      await one('assessment_responses', { attempt_id: attempt.id, attempt_item_id: attemptItem.id, answer: { option_id: correct ? fixture.optionA.id : fixture.optionB.id }, is_correct: correct, points_awarded: correct ? 10 : 0, review_status: 'not_required' });
    }
    attempts.push(attempt);
  }
}
const scale = await one('proficiency_scales', { network_id: network.id, assessment_id: assessment.id, name: 'Escala DEMO da PoC', version: 1, effective_from: '2026-01-01', created_by: ids.admin });
for (const [index, level] of [['below_basic','Abaixo do Básico',0,25],['basic','Básico',25,50],['adequate','Adequado',50,75],['advanced','Avançado',75,100]].entries()) await one('proficiency_levels', { scale_id: scale.id, code: level[0], label: level[1], lower_bound: level[2], upper_bound: level[3], sort_order: index + 1 });
await one('assessment_proficiency_scales', { assessment_id: assessment.id, scale_id: scale.id, assigned_by: ids.admin });

const manifest = { synthetic: true, network_id: network.id, school_ids: demonstrationSchools.map((row) => row.id), scale_school_ids: schools.map((row) => row.id), classroom_ids: classrooms.map((row) => row.id), assessment_id: assessment.id, attempt_id: attempts[0].id, users: Object.fromEntries(roleSpecs.map(([key]) => [key, emailFor(key)])), user_ids: ids, counts: { networks: 1, schools: schools.length, grades: 3, classrooms: classrooms.length, students: 12, items: items.length, attempts: attempts.length } };
await mkdir(path.join(root, 'artifacts/poc'), { recursive: true });
await writeFile(path.join(root, 'artifacts/poc/seed-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Seed POC concluido: ${schools.length} escolas, ${classrooms.length} turmas, 12 alunos, ${attempts.length} tentativas. Senha nao exibida.`);
