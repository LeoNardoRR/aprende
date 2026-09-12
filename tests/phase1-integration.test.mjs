import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isLocal(target) {
  if (!target) return false;
  try { return ['127.0.0.1', 'localhost'].includes(new URL(target).hostname); }
  catch { return false; }
}

async function signedIn(email, password) {
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(error); assert.ok(data.session?.access_token);
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}

test('Phase 1 operations preserve scope, history and role boundaries', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) {
    t.skip('Phase 1 integration runs only against local Supabase.'); return;
  }
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-phase1-${suffix}!`;
  const emails = Object.fromEntries(['networkAdmin', 'managerA', 'managerB', 'teacher', 'student', 'reviewer', 'approver'].map((name) => [name, `${name.toLowerCase()}-${suffix}@example.test`]));
  const ids = {};
  const networkIds = [];
  const classroomIds = [];

  t.after(async () => {
    if (networkIds.length) {
      await service.from('student_enrollments').delete().in('network_id', networkIds);
      await service.from('institutional_memberships').delete().in('network_id', networkIds);
      await service.from('classrooms').delete().in('network_id', networkIds);
      await service.from('classrooms').delete().in('id', classroomIds);
      await service.from('networks').delete().in('id', networkIds);
    }
    for (const id of Object.values(ids).reverse()) await service.auth.admin.deleteUser(id);
  });

  for (const [name, email] of Object.entries(emails)) {
    const result = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
    assert.ifError(result.error); ids[name] = result.data.user.id;
  }
  assert.ifError((await service.from('profiles').update({ role: 'network_admin' }).eq('id', ids.networkAdmin)).error);
  const networkAdmin = await signedIn(emails.networkAdmin, password);

  async function createScope(label) {
    const network = await service.from('networks').insert({ name: `Rede ${label} ${suffix}`, municipality: 'Monte Mor', state_code: 'SP', created_by: ids.networkAdmin }).select('id').single();
    assert.ifError(network.error); networkIds.push(network.data.id);
    const school = await service.from('schools').insert({ network_id: network.data.id, name: `Escola ${label}`, code: `${label}-${suffix}` }).select('id').single();
    assert.ifError(school.error);
    const year = await service.from('academic_years').insert({ network_id: network.data.id, label: `2026 ${label} ${suffix}`, starts_on: '2026-02-01', ends_on: '2026-12-20', status: 'open' }).select('id').single();
    assert.ifError(year.error);
    const grade = await service.from('school_years').insert({ school_id: school.data.id, name: '6º ano', code: `6-${label}-${suffix}` }).select('id').single();
    assert.ifError(grade.error);
    return { network: network.data.id, school: school.data.id, year: year.data.id, grade: grade.data.id };
  }
  const scopeA = await createScope('A');
  const scopeB = await createScope('B');

  async function assign(email, scope, role, school = scope.school) {
    return networkAdmin.rpc('set_institutional_membership', { target_email: email, target_network: scope.network, target_school: school, target_role: role, target_status: 'active' });
  }
  assert.ifError((await assign(emails.managerA, scopeA, 'manager')).error);
  assert.ifError((await assign(emails.managerB, scopeB, 'manager')).error);
  assert.ifError((await assign(emails.teacher, scopeA, 'teacher')).error);
  assert.ifError((await assign(emails.reviewer, scopeA, 'reviewer')).error);
  assert.ifError((await assign(emails.approver, scopeA, 'approver')).error);

  const [managerA, teacher, reviewer, approver] = await Promise.all([
    signedIn(emails.managerA, password), signedIn(emails.teacher, password),
    signedIn(emails.reviewer, password), signedIn(emails.approver, password),
  ]);
  const ownSchool = await managerA.from('schools').select('id').eq('id', scopeA.school);
  const foreignSchool = await managerA.from('schools').select('id').eq('id', scopeB.school);
  assert.ifError(ownSchool.error); assert.equal(ownSchool.data.length, 1);
  assert.ifError(foreignSchool.error); assert.equal(foreignSchool.data.length, 0);
  assert.ok((await managerA.rpc('set_institutional_membership', { target_email: emails.teacher, target_network: scopeA.network, target_school: scopeA.school, target_role: 'network_admin', target_status: 'active' })).error);
  assert.ok((await managerA.rpc('set_institutional_membership', { target_email: emails.teacher, target_network: scopeB.network, target_school: scopeB.school, target_role: 'teacher', target_status: 'active' })).error);
  assert.ok((await reviewer.rpc('list_institutional_users', { target_network: scopeA.network })).error);
  assert.ok((await approver.rpc('list_institutional_users', { target_network: scopeA.network })).error);

  const legacy = await service.from('classrooms').insert({ owner_id: ids.teacher, name: `Turma legada ${suffix}`, subject: 'Português' }).select('id').single();
  assert.ifError(legacy.error); classroomIds.push(legacy.data.id);
  assert.ifError((await networkAdmin.rpc('link_classroom_to_institution', { target_classroom: legacy.data.id, target_network: scopeA.network, target_school: scopeA.school, target_academic_year: scopeA.year, target_school_year: scopeA.grade })).error);
  const linked = await service.from('classrooms').select('network_id,school_id,academic_year_id,school_year_id').eq('id', legacy.data.id).single();
  assert.ifError(linked.error); assert.deepEqual(linked.data, { network_id: scopeA.network, school_id: scopeA.school, academic_year_id: scopeA.year, school_year_id: scopeA.grade });

  const classTwo = await service.from('classrooms').insert({ owner_id: ids.teacher, name: `Turma 6B ${suffix}`, subject: 'Português', network_id: scopeA.network, school_id: scopeA.school, academic_year_id: scopeA.year, school_year_id: scopeA.grade }).select('id').single();
  assert.ifError(classTwo.error); classroomIds.push(classTwo.data.id);
  const foreignClass = await service.from('classrooms').insert({ owner_id: ids.teacher, name: `Turma B ${suffix}`, subject: 'Matemática', network_id: scopeB.network, school_id: scopeB.school, academic_year_id: scopeB.year, school_year_id: scopeB.grade }).select('id').single();
  assert.ifError(foreignClass.error); classroomIds.push(foreignClass.data.id);
  const inconsistent = await service.from('classrooms').insert({ owner_id: ids.teacher, name: `Inválida ${suffix}`, subject: 'Teste', network_id: scopeA.network, school_id: scopeB.school, academic_year_id: scopeA.year, school_year_id: scopeA.grade });
  assert.ok(inconsistent.error, 'cross-network classroom scope must fail at the database');

  const enrollment = await managerA.rpc('create_student_enrollment', { target_email: emails.student, target_network: scopeA.network, target_school: scopeA.school, target_academic_year: scopeA.year, target_classroom: legacy.data.id });
  assert.ifError(enrollment.error);
  assert.ok((await managerA.rpc('transition_student_enrollment', { target_enrollment: enrollment.data, target_action: 'transfer', target_classroom: foreignClass.data.id, action_reason: 'escopo inválido' })).error);
  for (const [target_action, target_classroom] of [['transfer', classTwo.data.id], ['suspend', null], ['reactivate', null], ['remove', null]]) {
    const result = await managerA.rpc('transition_student_enrollment', { target_enrollment: enrollment.data, target_action, target_classroom, action_reason: `Teste ${target_action}` });
    assert.ifError(result.error);
  }
  const finalEnrollment = await service.from('student_enrollments').select('status,classroom_id,ends_on').eq('id', enrollment.data).single();
  assert.ifError(finalEnrollment.error); assert.equal(finalEnrollment.data.status, 'removed'); assert.equal(finalEnrollment.data.classroom_id, classTwo.data.id); assert.ok(finalEnrollment.data.ends_on);
  const history = await service.from('student_movements').select('movement_type').eq('enrollment_id', enrollment.data).order('created_at');
  assert.ifError(history.error); assert.deepEqual(history.data.map((row) => row.movement_type), ['transfer', 'suspension', 'reactivation', 'removal']);

  const teacherNetworkBefore = await teacher.from('networks').select('id').eq('id', scopeA.network);
  assert.ifError(teacherNetworkBefore.error); assert.equal(teacherNetworkBefore.data.length, 1);
  const teacherMembership = await service.from('institutional_memberships').select('id').eq('user_id', ids.teacher).eq('network_id', scopeA.network).eq('role', 'teacher').single();
  assert.ifError(teacherMembership.error);
  assert.ifError((await networkAdmin.rpc('set_institutional_membership_status', { target_membership: teacherMembership.data.id, target_status: 'inactive' })).error);
  const teacherNetworkAfter = await teacher.from('networks').select('id').eq('id', scopeA.network);
  assert.ifError(teacherNetworkAfter.error); assert.equal(teacherNetworkAfter.data.length, 0);
});
