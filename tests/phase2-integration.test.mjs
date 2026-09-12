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
  assert.ifError(error);
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

test('Phase 2 protects curricula and enforces the professional item workflow', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) {
    t.skip('Phase 2 integration runs only against local Supabase.'); return;
  }

  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-phase2-${suffix}!`;
  const roles = ['networkAdmin', 'manager', 'teacher', 'otherTeacher', 'reviewer', 'approver', 'student'];
  const emails = Object.fromEntries(roles.map((name) => [name, `${name.toLowerCase()}-${suffix}@example.test`]));
  const ids = {};
  const cleanup = { networks: [], curricula: [] };

  t.after(async () => {
    if (cleanup.networks.length) {
      await service.from('audit_logs').delete().in('network_id', cleanup.networks);
      await service.from('assessment_items').delete().in('network_id', cleanup.networks);
      await service.from('curricula').delete().in('network_id', cleanup.networks);
      await service.from('institutional_memberships').delete().in('network_id', cleanup.networks);
      await service.from('schools').delete().in('network_id', cleanup.networks);
      await service.from('networks').delete().in('id', cleanup.networks);
    }
    if (cleanup.curricula.length) await service.from('curricula').delete().in('id', cleanup.curricula);
    for (const id of Object.values(ids).reverse()) await service.auth.admin.deleteUser(id);
  });

  for (const name of roles) {
    const result = await service.auth.admin.createUser({
      email: emails[name], password, email_confirm: true, user_metadata: { display_name: name },
    });
    assert.ifError(result.error); ids[name] = result.data.user.id;
  }
  assert.ifError((await service.from('profiles').update({ role: 'network_admin' }).eq('id', ids.networkAdmin)).error);
  const admin = await signedIn(emails.networkAdmin, password);

  async function makeNetwork(label) {
    const network = await service.from('networks').insert({ name: `Rede ${label} ${suffix}`, created_by: ids.networkAdmin }).select('id').single();
    assert.ifError(network.error); cleanup.networks.push(network.data.id);
    const school = await service.from('schools').insert({ network_id: network.data.id, name: `Escola ${label}`, code: `${label}-${suffix}` }).select('id').single();
    assert.ifError(school.error);
    return { network: network.data.id, school: school.data.id };
  }
  const scopeA = await makeNetwork('A');
  const scopeB = await makeNetwork('B');

  async function assign(email, scope, role) {
    const result = await admin.rpc('set_institutional_membership', {
      target_email: email, target_network: scope.network, target_school: scope.school,
      target_role: role, target_status: 'active',
    });
    assert.ifError(result.error);
  }
  await assign(emails.manager, scopeA, 'manager');
  await assign(emails.teacher, scopeA, 'teacher');
  await assign(emails.otherTeacher, scopeA, 'teacher');
  await assign(emails.reviewer, scopeA, 'reviewer');
  await assign(emails.approver, scopeA, 'approver');
  await assign(emails.student, scopeA, 'student');

  const [manager, teacher, otherTeacher, reviewer, approver, student] = await Promise.all([
    signedIn(emails.manager, password), signedIn(emails.teacher, password),
    signedIn(emails.otherTeacher, password), signedIn(emails.reviewer, password),
    signedIn(emails.approver, password), signedIn(emails.student, password),
  ]);

  const official = await service.from('curricula').insert({
    name: `BNCC teste ${suffix}`, curriculum_type: 'bncc', version: 'teste', active: true,
  }).select('id').single();
  assert.ifError(official.error); cleanup.curricula.push(official.data.id);
  assert.equal((await teacher.from('curricula').select('id').eq('id', official.data.id)).data?.length, 1);
  assert.equal((await student.from('curricula').select('id').eq('id', official.data.id)).data?.length, 0);
  const officialUpdate = await teacher.from('curricula').update({ name: 'Não permitido' }).eq('id', official.data.id).select('id');
  assert.ifError(officialUpdate.error); assert.equal(officialUpdate.data.length, 0);
  const unchangedOfficial = await service.from('curricula').select('name').eq('id', official.data.id).single();
  assert.equal(unchangedOfficial.data.name, `BNCC teste ${suffix}`);

  const curriculum = await manager.from('curricula').insert({
    network_id: scopeA.network, name: `Currículo DEMO ${suffix}`, curriculum_type: 'custom',
    version: '1', created_by: ids.manager,
  }).select('id').single();
  assert.ifError(curriculum.error);
  const area = await manager.from('curriculum_areas').insert({ curriculum_id: curriculum.data.id, name: 'Matemática' }).select('id').single();
  assert.ifError(area.error);
  const subject = await manager.from('curriculum_subjects').insert({ curriculum_id: curriculum.data.id, area_id: area.data.id, name: 'Matemática' }).select('id').single();
  assert.ifError(subject.error);
  const year = await manager.from('curriculum_school_years').insert({ curriculum_id: curriculum.data.id, code: '6EF', name: '6º ano' }).select('id').single();
  assert.ifError(year.error);
  const unit = await manager.from('curriculum_thematic_units').insert({ curriculum_id: curriculum.data.id, subject_id: subject.data.id, curriculum_school_year_id: year.data.id, name: 'Números' }).select('id').single();
  assert.ifError(unit.error);
  const object = await manager.from('curriculum_knowledge_objects').insert({ curriculum_id: curriculum.data.id, thematic_unit_id: unit.data.id, name: 'Frações' }).select('id').single();
  assert.ifError(object.error);
  const skill = await manager.from('curriculum_skills').insert({
    curriculum_id: curriculum.data.id, subject_id: subject.data.id,
    curriculum_school_year_id: year.data.id, thematic_unit_id: unit.data.id,
    knowledge_object_id: object.data.id, code: `DEMO-${suffix.slice(-8)}`,
    description: 'Habilidade demonstrativa para validar o fluxo técnico.',
  }).select('id').single();
  assert.ifError(skill.error);

  const outsideCurriculum = await service.from('curricula').insert({
    network_id: scopeB.network, name: `Currículo B ${suffix}`, curriculum_type: 'custom',
    version: '1', created_by: ids.networkAdmin,
  }).select('id').single();
  assert.ifError(outsideCurriculum.error);
  assert.equal((await manager.from('curricula').select('id').eq('id', outsideCurriculum.data.id)).data?.length, 0);

  async function createItem(title, owner = teacher, ownerId = ids.teacher) {
    return owner.from('assessment_items').insert({
      network_id: scopeA.network, curriculum_id: curriculum.data.id,
      curriculum_school_year_id: year.data.id, subject_id: subject.data.id,
      skill_id: skill.data.id, thematic_unit_id: unit.data.id, knowledge_object_id: object.data.id,
      internal_title: title, statement: 'Qual alternativa representa a resposta demonstrativa correta?',
      difficulty: 'medium', item_type: 'multiple_choice', author_id: ownerId,
    }).select('id').single();
  }

  const incomplete = await createItem(`MCQ incompleto ${suffix}`);
  assert.ifError(incomplete.error);
  assert.ok((await teacher.rpc('transition_assessment_item', { target_item: incomplete.data.id, target_action: 'submit', action_comment: 'Validar mínimo' })).error);

  const item = await createItem(`Item DEMO ${suffix}`);
  assert.ifError(item.error);
  for (const [index, content] of ['Resposta correta', 'Distrator um', 'Distrator dois', 'Distrator três'].entries()) {
    const option = await teacher.from('assessment_item_options').insert({
      item_id: item.data.id, label: String.fromCharCode(65 + index), content,
      is_correct: index === 0, sort_order: index,
      distractor_analysis: index === 0 ? null : `Análise pedagógica do distrator ${index}`,
    });
    assert.ifError(option.error);
  }

  assert.ok((await otherTeacher.from('assessment_items').update({ statement: 'Tentativa indevida' }).eq('id', item.data.id)).error);
  assert.ifError((await teacher.rpc('transition_assessment_item', { target_item: item.data.id, target_action: 'submit', action_comment: 'Pronto para revisão' })).error);
  assert.ok((await otherTeacher.rpc('transition_assessment_item', { target_item: item.data.id, target_action: 'review' })).error);
  assert.ifError((await reviewer.rpc('transition_assessment_item', { target_item: item.data.id, target_action: 'review', action_comment: 'Revisado' })).error);
  assert.ifError((await approver.rpc('transition_assessment_item', { target_item: item.data.id, target_action: 'approve', action_comment: 'Aprovado' })).error);
  assert.ok((await approver.rpc('transition_assessment_item', { target_item: item.data.id, target_action: 'approve' })).error);

  const approved = await teacher.from('approved_assessment_items').select('id,status').eq('id', item.data.id).single();
  assert.ifError(approved.error); assert.equal(approved.data.status, 'approved');
  assert.equal((await student.from('assessment_items').select('id').eq('id', item.data.id)).data?.length, 0);
  assert.equal((await reviewer.from('assessment_items').select('id').eq('network_id', scopeB.network)).data?.length, 0);

  const versions = await service.from('assessment_item_versions').select('version_number,snapshot').eq('item_id', item.data.id).order('version_number');
  assert.ifError(versions.error); assert.equal(versions.data.length, 3);
  assert.equal(versions.data[0].snapshot.statement, 'Qual alternativa representa a resposta demonstrativa correta?');
  const reviews = await service.from('assessment_item_reviews').select('action').eq('item_id', item.data.id).order('created_at');
  assert.deepEqual(reviews.data.map((entry) => entry.action), ['submitted', 'reviewed', 'approved']);
});
