import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLocal = (target) => { try { return ['127.0.0.1', 'localhost'].includes(new URL(target).hostname); } catch { return false; } };

async function signedIn(email, password) {
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}

test('Phase 3 freezes approved versions, limits booklets and isolates schedules by school', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) { t.skip('Phase 3 integration runs only against local Supabase.'); return; }
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-phase3-${suffix}!`;
  const users = {};
  const emails = {};
  const networkIds = [];

  t.after(async () => {
    if (networkIds.length) {
      await service.from('audit_logs').delete().in('network_id', networkIds);
      await service.from('networks').delete().in('id', networkIds);
    }
    for (const id of Object.values(users).reverse()) await service.auth.admin.deleteUser(id);
  });

  for (const role of ['admin', 'managerA', 'managerB', 'teacher', 'student']) {
    const email = `${role.toLowerCase()}-${suffix}@example.test`; emails[role] = email;
    const result = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: role } });
    assert.ifError(result.error); users[role] = result.data.user.id;
  }
  assert.ifError((await service.from('profiles').update({ role: 'network_admin' }).eq('id', users.admin)).error);
  const network = await service.from('networks').insert({ name: `Rede F3 ${suffix}`, created_by: users.admin }).select('id').single();
  assert.ifError(network.error); networkIds.push(network.data.id);
  const schoolA = await service.from('schools').insert({ network_id: network.data.id, name: 'Escola A', code: `A-${suffix}` }).select('id').single();
  const schoolB = await service.from('schools').insert({ network_id: network.data.id, name: 'Escola B', code: `B-${suffix}` }).select('id').single();
  assert.ifError(schoolA.error); assert.ifError(schoolB.error);
  const academicYear = await service.from('academic_years').insert({ network_id: network.data.id, label: `Ano 2026 F3 ${suffix.slice(-8)}`, starts_on: '2026-02-01', ends_on: '2026-12-20', status: 'open' }).select('id').single();
  assert.ifError(academicYear.error);
  const gradeA = await service.from('school_years').insert({ school_id: schoolA.data.id, code: `6A-${suffix}`, name: '6º ano', sort_order: 6 }).select('id').single();
  const gradeB = await service.from('school_years').insert({ school_id: schoolB.data.id, code: `6B-${suffix}`, name: '6º ano', sort_order: 6 }).select('id').single();
  assert.ifError(gradeA.error); assert.ifError(gradeB.error);
  for (const [user, school, role] of [[users.managerA, schoolA.data.id, 'manager'], [users.managerB, schoolB.data.id, 'manager'], [users.teacher, schoolA.data.id, 'teacher'], [users.student, schoolA.data.id, 'student']]) {
    assert.ifError((await service.from('institutional_memberships').insert({ user_id: user, network_id: network.data.id, school_id: school, role, status: 'active', created_by: users.admin })).error);
  }
  const classroomA = await service.from('classrooms').insert({ owner_id: users.teacher, name: `6º A ${suffix}`, subject: 'Matemática', join_code: `F3A${suffix}`.replace(/[^A-Z0-9]/gi,'').slice(-12).toUpperCase(), network_id: network.data.id, school_id: schoolA.data.id, academic_year_id: academicYear.data.id, school_year_id: gradeA.data.id, classroom_status: 'active' }).select('id').single();
  const classroomB = await service.from('classrooms').insert({ owner_id: users.teacher, name: `6º B ${suffix}`, subject: 'Matemática', join_code: `F3B${suffix}`.replace(/[^A-Z0-9]/gi,'').slice(-12).toUpperCase(), network_id: network.data.id, school_id: schoolB.data.id, academic_year_id: academicYear.data.id, school_year_id: gradeB.data.id, classroom_status: 'active' }).select('id').single();
  assert.ifError(classroomA.error); assert.ifError(classroomB.error);

  const curriculum = await service.from('curricula').insert({ network_id: network.data.id, name: `Currículo F3 ${suffix}`, curriculum_type: 'custom', version: '1', created_by: users.managerA }).select('id').single();
  const area = await service.from('curriculum_areas').insert({ curriculum_id: curriculum.data.id, name: 'Matemática' }).select('id').single();
  const subject = await service.from('curriculum_subjects').insert({ curriculum_id: curriculum.data.id, area_id: area.data.id, name: 'Matemática' }).select('id').single();
  const year = await service.from('curriculum_school_years').insert({ curriculum_id: curriculum.data.id, school_year_id: gradeA.data.id, code: '6EF', name: '6º ano' }).select('id').single();
  const skill = await service.from('curriculum_skills').insert({ curriculum_id: curriculum.data.id, subject_id: subject.data.id, curriculum_school_year_id: year.data.id, code: `F3-${suffix.slice(-8)}`, description: 'Habilidade para teste integrado da construção de avaliações.' }).select('id').single();
  for (const result of [curriculum, area, subject, year, skill]) assert.ifError(result.error);

  async function itemWithStatus(status, label) {
    const item = await service.from('assessment_items').insert({ network_id: network.data.id, curriculum_id: curriculum.data.id, curriculum_school_year_id: year.data.id, subject_id: subject.data.id, skill_id: skill.data.id, internal_title: `${label} ${suffix}`, statement: 'Enunciado integrado para validar elegibilidade do item.', difficulty: 'medium', item_type: 'essay', status, author_id: users.teacher }).select('id').single();
    assert.ifError(item.error);
    if (status === 'approved') assert.ifError((await service.from('assessment_item_versions').insert({ item_id: item.data.id, version_number: 1, snapshot: { statement: 'Versão congelada' }, created_by: users.teacher })).error);
    return item.data.id;
  }
  const draftItem = await itemWithStatus('draft', 'Rascunho');
  const reviewedItem = await itemWithStatus('reviewed', 'Revisado');
  const approvedItem = await itemWithStatus('approved', 'Aprovado');

  const managerA = await signedIn(emails.managerA, password);
  const managerB = await signedIn(emails.managerB, password);
  const cycle = await managerA.from('assessment_cycles').insert({ network_id: network.data.id, name: `Diagnóstica ${suffix}`, starts_at: '2026-09-15T08:00:00Z', ends_at: '2026-09-30T18:00:00Z', created_by: users.managerA }).select('id').single();
  assert.ifError(cycle.error);
  const assessment = await managerA.from('diagnostic_assessments').insert({ cycle_id: cycle.data.id, network_id: network.data.id, curriculum_id: curriculum.data.id, subject_id: subject.data.id, curriculum_school_year_id: year.data.id, title: `Matemática F3 ${suffix}`, instructions: 'Leia com atenção e responda às questões.', duration_minutes: 60, created_by: users.managerA }).select('id').single();
  assert.ifError(assessment.error);

  const bookletIds = [];
  for (let index = 0; index < 5; index += 1) {
    const booklet = await managerA.rpc('create_assessment_booklet', { target_assessment: assessment.data.id, booklet_title: null, strategy: 'manual', deterministic_seed: null });
    assert.ifError(booklet.error); bookletIds.push(booklet.data);
  }
  assert.ok((await managerA.rpc('create_assessment_booklet', { target_assessment: assessment.data.id, booklet_title: null, strategy: 'manual', deterministic_seed: null })).error);
  assert.ok((await managerA.rpc('add_approved_item_to_booklet', { target_booklet: bookletIds[0], target_item: draftItem, target_position: 1, item_points: 10 })).error);
  assert.ok((await managerA.rpc('add_approved_item_to_booklet', { target_booklet: bookletIds[0], target_item: reviewedItem, target_position: 1, item_points: 10 })).error);
  for (const bookletId of bookletIds) assert.ifError((await managerA.rpc('add_approved_item_to_booklet', { target_booklet: bookletId, target_item: approvedItem, target_position: 1, item_points: 10 })).error);
  const frozen = await service.from('assessment_booklet_items').select('assessment_item_version_id').eq('booklet_id', bookletIds[0]).single();
  const version = await service.from('assessment_item_versions').select('id').eq('item_id', approvedItem).single();
  assert.equal(frozen.data.assessment_item_version_id, version.data.id);
  assert.ifError((await managerA.rpc('transition_diagnostic_assessment', { target_assessment: assessment.data.id, target_action: 'ready' })).error);

  const start = '2026-09-16T08:00:00Z'; const end = '2026-09-16T10:00:00Z';
  assert.ok((await managerB.rpc('schedule_diagnostic_assessment', { target_assessment: assessment.data.id, target_school: schoolA.data.id, target_classrooms: [classroomA.data.id], window_starts_at: start, window_ends_at: end })).error);
  assert.ok((await managerA.rpc('schedule_diagnostic_assessment', { target_assessment: assessment.data.id, target_school: schoolA.data.id, target_classrooms: [classroomB.data.id], window_starts_at: start, window_ends_at: end })).error);
  assert.ifError((await managerA.rpc('schedule_diagnostic_assessment', { target_assessment: assessment.data.id, target_school: schoolA.data.id, target_classrooms: [classroomA.data.id], window_starts_at: start, window_ends_at: end })).error);
});
