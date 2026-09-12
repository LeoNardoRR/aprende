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
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

test('Phase 3 finalization builds, reorders and maps booklets and lists scheduled students', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) {
    t.skip('Phase 3 finalization integration runs only against local Supabase.');
    return;
  }

  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-phase3-final-${suffix}!`;
  const adminEmail = `phase3-admin-${suffix}@example.test`;
  const studentEmail = `phase3-student-${suffix}@example.test`;
  const userIds = [];
  const networkIds = [];

  t.after(async () => {
    if (networkIds.length) {
      await service.from('audit_logs').delete().in('network_id', networkIds);
      await service.from('networks').delete().in('id', networkIds);
    }
    for (const id of userIds.reverse()) await service.auth.admin.deleteUser(id);
  });

  const adminUser = await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { display_name: 'Gestor Fase 3' } });
  const studentUser = await service.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { display_name: 'Aluno Fase 3' } });
  assert.ifError(adminUser.error); assert.ifError(studentUser.error);
  userIds.push(adminUser.data.user.id, studentUser.data.user.id);
  assert.ifError((await service.from('profiles').update({ role: 'network_admin' }).eq('id', adminUser.data.user.id)).error);

  const network = await service.from('networks').insert({ name: `Rede F3 Final ${suffix}`, created_by: adminUser.data.user.id }).select('id').single();
  assert.ifError(network.error); networkIds.push(network.data.id);
  const school = await service.from('schools').insert({ network_id: network.data.id, name: 'Escola Fase 3', code: `F3-${suffix}` }).select('id').single();
  const academicYear = await service.from('academic_years').insert({ network_id: network.data.id, label: `Ano 2026 ${suffix.slice(-6)}`, starts_on: '2026-02-01', ends_on: '2026-12-20', status: 'open' }).select('id').single();
  assert.ifError(school.error); assert.ifError(academicYear.error);
  const schoolYear = await service.from('school_years').insert({ school_id: school.data.id, code: `6-${suffix}`, name: '6º ano', sort_order: 6 }).select('id').single();
  assert.ifError(schoolYear.error);
  const joinCode = `F${suffix.replace(/[^A-Z0-9]/gi, '').slice(-11).toUpperCase()}`;
  const classroom = await service.from('classrooms').insert({ owner_id: adminUser.data.user.id, name: `6º A ${suffix}`, subject: 'Matemática', join_code: joinCode, network_id: network.data.id, school_id: school.data.id, academic_year_id: academicYear.data.id, school_year_id: schoolYear.data.id, classroom_status: 'active' }).select('id').single();
  assert.ifError(classroom.error);

  assert.ifError((await service.from('student_enrollments').insert({ student_id: studentUser.data.user.id, network_id: network.data.id, school_id: school.data.id, academic_year_id: academicYear.data.id, classroom_id: classroom.data.id, status: 'enrolled', source: 'manual', created_by: adminUser.data.user.id })).error);

  const curriculum = await service.from('curricula').insert({ network_id: network.data.id, name: `Currículo F3 Final ${suffix}`, curriculum_type: 'custom', version: '1', created_by: adminUser.data.user.id }).select('id').single();
  const area = await service.from('curriculum_areas').insert({ curriculum_id: curriculum.data.id, name: 'Matemática' }).select('id').single();
  const subject = await service.from('curriculum_subjects').insert({ curriculum_id: curriculum.data.id, area_id: area.data.id, name: 'Matemática' }).select('id').single();
  const year = await service.from('curriculum_school_years').insert({ curriculum_id: curriculum.data.id, school_year_id: schoolYear.data.id, code: `6EF-${suffix}`, name: '6º ano' }).select('id').single();
  const skill = await service.from('curriculum_skills').insert({ curriculum_id: curriculum.data.id, subject_id: subject.data.id, curriculum_school_year_id: year.data.id, code: `F3FINAL-${suffix.slice(-8)}`, description: 'Habilidade usada para validar o fechamento do construtor da Fase 3.' }).select('id').single();
  for (const result of [curriculum, area, subject, year, skill]) assert.ifError(result.error);

  async function approvedItem(label, points = 10) {
    const item = await service.from('assessment_items').insert({ network_id: network.data.id, curriculum_id: curriculum.data.id, curriculum_school_year_id: year.data.id, subject_id: subject.data.id, skill_id: skill.data.id, internal_title: `${label} ${suffix}`, statement: `Enunciado ${label} para validar a Fase 3.`, difficulty: 'medium', item_type: 'essay', status: 'approved', author_id: adminUser.data.user.id }).select('id').single();
    assert.ifError(item.error);
    const version = await service.from('assessment_item_versions').insert({ item_id: item.data.id, version_number: 1, snapshot: { internal_title: label, points }, created_by: adminUser.data.user.id }).select('id').single();
    assert.ifError(version.error);
    return item.data.id;
  }

  const itemA = await approvedItem('Item A');
  const itemB = await approvedItem('Item B');
  const admin = await signedIn(adminEmail, password);

  const cycle = await admin.from('assessment_cycles').insert({ network_id: network.data.id, name: `Diagnóstica F3 Final ${suffix}`, starts_at: '2026-09-15T08:00:00Z', ends_at: '2026-09-30T18:00:00Z', created_by: adminUser.data.user.id }).select('id').single();
  assert.ifError(cycle.error);
  const assessment = await admin.from('diagnostic_assessments').insert({ cycle_id: cycle.data.id, network_id: network.data.id, curriculum_id: curriculum.data.id, subject_id: subject.data.id, curriculum_school_year_id: year.data.id, title: `Matemática Final ${suffix}`, instructions: 'Leia com atenção e responda.', duration_minutes: 60, created_by: adminUser.data.user.id }).select('id').single();
  assert.ifError(assessment.error);

  const candidates = await admin.rpc('list_assessment_item_candidates', { target_assessment: assessment.data.id, search_query: '', page_size: 100 });
  assert.ifError(candidates.error);
  assert.deepEqual(new Set(candidates.data.map((row) => row.item_id)), new Set([itemA, itemB]));

  const bookletA = await admin.rpc('create_assessment_booklet', { target_assessment: assessment.data.id, booklet_title: 'Caderno A', strategy: 'manual', deterministic_seed: null });
  assert.ifError(bookletA.error);
  const linkA = await admin.rpc('add_approved_item_to_booklet', { target_booklet: bookletA.data, target_item: itemA, target_position: 1, item_points: 10 });
  const linkB = await admin.rpc('add_approved_item_to_booklet', { target_booklet: bookletA.data, target_item: itemB, target_position: 2, item_points: 10 });
  assert.ifError(linkA.error); assert.ifError(linkB.error);

  let listed = await admin.rpc('list_assessment_booklet_items', { target_booklet: bookletA.data });
  assert.ifError(listed.error);
  assert.deepEqual(listed.data.map((row) => row.item_id), [itemA, itemB]);

  assert.ifError((await admin.rpc('reorder_assessment_booklet_items', { target_booklet: bookletA.data, ordered_links: [linkB.data, linkA.data] })).error);
  listed = await admin.rpc('list_assessment_booklet_items', { target_booklet: bookletA.data });
  assert.ifError(listed.error);
  assert.deepEqual(listed.data.map((row) => [row.item_id, row.position]), [[itemB, 1], [itemA, 2]]);

  assert.ifError((await admin.rpc('remove_assessment_booklet_item', { target_link: linkB.data })).error);
  listed = await admin.rpc('list_assessment_booklet_items', { target_booklet: bookletA.data });
  assert.ifError(listed.error);
  assert.deepEqual(listed.data.map((row) => [row.item_id, row.position]), [[itemA, 1]]);

  const bookletB = await admin.rpc('create_assessment_booklet', { target_assessment: assessment.data.id, booklet_title: 'Caderno B', strategy: 'same_items_shuffled', deterministic_seed: 'phase3-final' });
  assert.ifError(bookletB.error);
  assert.ifError((await admin.rpc('add_approved_item_to_booklet', { target_booklet: bookletB.data, target_item: itemA, target_position: 1, item_points: 10 })).error);

  const map = await admin.rpc('assessment_curriculum_map', { target_assessment: assessment.data.id });
  assert.ifError(map.error);
  assert.equal(map.data.length, 1);
  assert.equal(Number(map.data[0].item_count), 1, 'same item in two booklets must count once in the blueprint');
  assert.equal(Number(map.data[0].points), 10);
  assert.equal(Number(map.data[0].percentage), 100);

  assert.ifError((await admin.rpc('transition_diagnostic_assessment', { target_assessment: assessment.data.id, target_action: 'ready' })).error);
  const schedule = await admin.rpc('schedule_diagnostic_assessment', { target_assessment: assessment.data.id, target_school: school.data.id, target_classrooms: [classroom.data.id], window_starts_at: '2026-09-16T08:00:00Z', window_ends_at: '2026-09-16T10:00:00Z' });
  assert.ifError(schedule.error);

  const scheduled = await admin.rpc('list_scheduled_assessment_students', { target_network: network.data.id, target_assessment: assessment.data.id });
  assert.ifError(scheduled.error);
  assert.equal(scheduled.data.length, 1);
  assert.equal(scheduled.data[0].student_id, studentUser.data.user.id);
  assert.equal(scheduled.data[0].classroom_id, classroom.data.id);
  assert.equal(scheduled.data[0].schedule_id, schedule.data);
});
