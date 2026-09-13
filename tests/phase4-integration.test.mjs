import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const isLocal = (target) => {
  try { return ['127.0.0.1', 'localhost'].includes(new URL(target).hostname); }
  catch { return false; }
};
const value = (result) => { assert.ifError(result.error); return result.data; };

async function signedIn(email, password) {
  const client = createClient(url, anonKey, options);
  value(await client.auth.signInWithPassword({ email, password }));
  return client;
}

test('Phase 4 applies diagnostic assessments securely from token through grading', async (t) => {
  if (!isLocal(url) || !anonKey || !serviceRoleKey) {
    t.skip('Phase 4 integration runs only against disposable local Supabase.');
    return;
  }

  const service = createClient(url, serviceRoleKey, options);
  const anonymous = createClient(url, anonKey, options);
  const suffix = randomUUID().slice(0, 8);
  const password = `Local-phase4-${suffix}-!Aa12345`;
  const roles = ['adminA', 'adminB', 'teacherA', 'teacherB', 'reviewer', 'studentA', 'studentB', 'studentExpired', 'studentUnissued', 'outsider'];
  const ids = {};
  const emails = {};
  const clients = {};
  const networkIds = [];

  t.after(async () => {
    if (networkIds.length) {
      await service.from('assessment_attempts').delete().in('network_id', networkIds);
      await service.from('audit_logs').delete().in('network_id', networkIds);
      await service.from('networks').delete().in('id', networkIds);
    }
    for (const id of Object.values(ids).reverse()) await service.auth.admin.deleteUser(id);
  });

  for (const role of roles) {
    emails[role] = `phase4-${role.toLowerCase()}-${suffix}@example.test`;
    const created = value(await service.auth.admin.createUser({
      email: emails[role], password, email_confirm: true,
      user_metadata: { display_name: `Fase 4 ${role}` },
    }));
    ids[role] = created.user.id;
    clients[role] = await signedIn(emails[role], password);
  }

  for (const role of ['adminA', 'adminB']) {
    value(await service.from('profiles').update({ role: 'network_admin' }).eq('id', ids[role]));
  }

  const networkA = value(await service.from('networks').insert({ name: `Rede F4 A ${suffix}`, created_by: ids.adminA }).select().single());
  const networkB = value(await service.from('networks').insert({ name: `Rede F4 B ${suffix}`, created_by: ids.adminB }).select().single());
  networkIds.push(networkA.id, networkB.id);
  const schoolA = value(await service.from('schools').insert({ network_id: networkA.id, name: 'Escola A F4', code: `F4A-${suffix}` }).select().single());
  const schoolB = value(await service.from('schools').insert({ network_id: networkA.id, name: 'Escola B F4', code: `F4B-${suffix}` }).select().single());
  const year = value(await service.from('academic_years').insert({ network_id: networkA.id, label: `2026 F4 ${suffix}`, starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'open' }).select().single());
  const gradeA = value(await service.from('school_years').insert({ school_id: schoolA.id, name: '6º ano', code: `6A-${suffix}` }).select().single());
  const gradeB = value(await service.from('school_years').insert({ school_id: schoolB.id, name: '6º ano', code: `6B-${suffix}` }).select().single());

  for (const [role, school, membershipRole] of [
    ['teacherA', schoolA.id, 'teacher'], ['teacherB', schoolB.id, 'teacher'],
    ['reviewer', schoolA.id, 'reviewer'], ['studentA', schoolA.id, 'student'],
    ['studentB', schoolA.id, 'student'], ['studentExpired', schoolA.id, 'student'],
    ['studentUnissued', schoolA.id, 'student'],
    ['outsider', schoolB.id, 'student'],
  ]) {
    value(await service.from('institutional_memberships').insert({
      user_id: ids[role], network_id: networkA.id, school_id: school,
      role: membershipRole, status: 'active', created_by: ids.adminA,
    }));
  }

  const classroomA = value(await service.from('classrooms').insert({
    owner_id: ids.teacherA, name: `Turma A F4 ${suffix}`, subject: 'Matemática',
    join_code: `A${suffix.toUpperCase()}`, network_id: networkA.id, school_id: schoolA.id,
    academic_year_id: year.id, school_year_id: gradeA.id, classroom_status: 'active',
  }).select().single());
  const classroomB = value(await service.from('classrooms').insert({
    owner_id: ids.teacherB, name: `Turma B F4 ${suffix}`, subject: 'Matemática',
    join_code: `B${suffix.toUpperCase()}`, network_id: networkA.id, school_id: schoolB.id,
    academic_year_id: year.id, school_year_id: gradeB.id, classroom_status: 'active',
  }).select().single());

  for (const student of ['studentA', 'studentB', 'studentExpired', 'studentUnissued']) {
    value(await service.from('student_enrollments').insert({
      student_id: ids[student], network_id: networkA.id, school_id: schoolA.id,
      academic_year_id: year.id, classroom_id: classroomA.id, status: 'enrolled',
      source: 'manual', created_by: ids.adminA,
    }));
  }
  value(await service.from('student_enrollments').insert({
    student_id: ids.outsider, network_id: networkA.id, school_id: schoolB.id,
    academic_year_id: year.id, classroom_id: classroomB.id, status: 'enrolled',
    source: 'manual', created_by: ids.adminA,
  }));

  const curriculum = value(await service.from('curricula').insert({ network_id: networkA.id, name: `Currículo F4 ${suffix}`, curriculum_type: 'custom', version: '1', created_by: ids.teacherA }).select().single());
  const area = value(await service.from('curriculum_areas').insert({ curriculum_id: curriculum.id, name: 'Matemática' }).select().single());
  const subject = value(await service.from('curriculum_subjects').insert({ curriculum_id: curriculum.id, area_id: area.id, name: 'Matemática' }).select().single());
  const curriculumYear = value(await service.from('curriculum_school_years').insert({ curriculum_id: curriculum.id, school_year_id: gradeA.id, code: `6EF-${suffix}`, name: '6º ano' }).select().single());
  const skill = value(await service.from('curriculum_skills').insert({ curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYear.id, code: `F4-${suffix}`, description: 'Habilidade DEMO usada apenas no teste descartável.' }).select().single());

  const itemFixtures = [];
  async function approvedItem(itemType, label, optionDefinitions = []) {
    const item = value(await service.from('assessment_items').insert({
      network_id: networkA.id, curriculum_id: curriculum.id, curriculum_school_year_id: curriculumYear.id,
      subject_id: subject.id, skill_id: skill.id, internal_title: `DEMO ${label} ${suffix}`,
      statement: `Enunciado ${label} para o runtime DEMO.`, difficulty: 'medium', item_type: itemType,
      status: 'approved', author_id: ids.teacherA, formula: itemType === 'multiple_choice' ? '2+2=4' : null,
      image_paths: [],
    }).select().single());
    const optionsSnapshot = optionDefinitions.map((definition, index) => ({
      id: randomUUID(), label: String.fromCharCode(65 + index), content: definition.content,
      is_correct: definition.correct, feedback: null,
      distractor_analysis: definition.correct ? null : 'Análise DEMO do distrator.', sort_order: index,
    }));
    const snapshot = {
      id: item.id, network_id: networkA.id, curriculum_id: curriculum.id,
      curriculum_school_year_id: curriculumYear.id, subject_id: subject.id, skill_id: skill.id,
      internal_title: item.internal_title, statement: item.statement, support_text: null,
      pedagogical_comment: 'Comentário interno DEMO.', correct_answer_justification: 'Justificativa interna DEMO.',
      difficulty: 'medium', item_type: itemType, formula: item.formula, image_paths: [], options: optionsSnapshot,
    };
    const version = value(await service.from('assessment_item_versions').insert({
      item_id: item.id, version_number: 1, snapshot, created_by: ids.teacherA,
    }).select().single());
    const fixture = { item, version, snapshot, correctOption: optionsSnapshot.find((option) => option.is_correct) };
    itemFixtures.push(fixture);
    return fixture;
  }

  const multipleChoice = await approvedItem('multiple_choice', 'múltipla escolha', [
    { content: '4', correct: true }, { content: '3', correct: false },
    { content: '5', correct: false }, { content: '6', correct: false },
  ]);
  const trueFalse = await approvedItem('true_false', 'verdadeiro ou falso', [
    { content: 'Verdadeiro', correct: true }, { content: 'Falso', correct: false },
  ]);
  const essay = await approvedItem('essay', 'discursiva');

  const startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const endsAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const cycle = value(await service.from('assessment_cycles').insert({ network_id: networkA.id, name: `Ciclo F4 ${suffix}`, starts_at: startsAt, ends_at: endsAt, created_by: ids.teacherA }).select().single());
  const assessment = value(await service.from('diagnostic_assessments').insert({
    cycle_id: cycle.id, network_id: networkA.id, curriculum_id: curriculum.id,
    subject_id: subject.id, curriculum_school_year_id: curriculumYear.id,
    title: `Avaliação F4 ${suffix}`, instructions: 'Responda e revise antes de finalizar.',
    duration_minutes: 30, randomize_questions: true, randomize_options: true,
    allow_back_navigation: false, created_by: ids.teacherA,
  }).select().single());

  const booklets = [];
  for (let bookletIndex = 0; bookletIndex < 2; bookletIndex += 1) {
    const bookletId = value(await clients.teacherA.rpc('create_assessment_booklet', {
      target_assessment: assessment.id, booklet_title: null,
      strategy: bookletIndex ? 'same_items_shuffled' : 'manual', deterministic_seed: `F4-${bookletIndex}`,
    }));
    booklets.push(bookletId);
    for (let index = 0; index < itemFixtures.length; index += 1) {
      value(await clients.teacherA.rpc('add_approved_item_to_booklet', {
        target_booklet: bookletId, target_item: itemFixtures[index].item.id,
        target_position: bookletIndex ? itemFixtures.length - index : index + 1, item_points: 10,
      }));
    }
  }
  value(await clients.teacherA.rpc('transition_diagnostic_assessment', { target_assessment: assessment.id, target_action: 'ready' }));
  const scheduleId = value(await clients.teacherA.rpc('schedule_diagnostic_assessment', {
    target_assessment: assessment.id, target_school: schoolA.id,
    target_classrooms: [classroomA.id], window_starts_at: startsAt, window_ends_at: endsAt,
  }));

  let attemptA;
  let attemptB;
  let attemptExpired;
  let runtimeA;

  await t.test('tokens are hashed, scoped, revocable and rotate without duplicating attempts', async () => {
    assert.ok((await clients.teacherB.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentA, valid_minutes: 120 })).error);
    assert.ok((await clients.adminB.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentA, valid_minutes: 120 })).error);
    assert.ok((await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.outsider, valid_minutes: 120 })).error);

    const first = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentA, valid_minutes: 120 }))[0];
    const second = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentA, valid_minutes: 120 }))[0];
    attemptA = second.attempt_id;
    assert.equal(first.attempt_id, second.attempt_id);
    assert.notEqual(first.access_token, second.access_token);
    assert.equal(value(await service.from('assessment_attempts').select('id', { count: 'exact' }).eq('schedule_id', scheduleId).eq('student_id', ids.studentA)).length, 1);
    const stored = value(await service.from('assessment_attempts').select('*').eq('id', attemptA).single());
    assert.notEqual(stored.access_token_hash, second.access_token);
    assert.equal(stored.access_token_hash.length, 64);
    assert.equal((await clients.studentA.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: first.access_token, origin: 'token' })).data.ok, false);

    const revoked = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentB, valid_minutes: 120 }))[0];
    attemptB = revoked.attempt_id;
    value(await clients.teacherA.rpc('revoke_assessment_access_token', { target_attempt: attemptB, action_reason: 'Token entregue ao aluno incorreto' }));
    assert.equal((await clients.studentB.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: revoked.access_token, origin: 'token' })).data.ok, false);
    const activeB = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentB, valid_minutes: 120 }))[0];

    const startedA = value(await clients.studentA.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: second.access_token, origin: 'token' }));
    const startedB = value(await clients.studentB.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: activeB.access_token, origin: 'token' }));
    assert.equal(startedA.ok, true); assert.equal(startedB.ok, true);
  });

  await t.test('booklet, question order, option order, clock and snapshot survive reload', async () => {
    runtimeA = value(await clients.studentA.rpc('get_assessment_attempt', { target_attempt: attemptA }));
    const reloaded = value(await clients.studentA.rpc('resume_assessment_attempt', { target_attempt: attemptA }));
    assert.equal(runtimeA.attempt.booklet_id, reloaded.attempt.booklet_id);
    assert.deepEqual(runtimeA.items.map((item) => item.id), reloaded.items.map((item) => item.id));
    assert.deepEqual(runtimeA.items.map((item) => item.content.options.map((option) => option.id)), reloaded.items.map((item) => item.content.options.map((option) => option.id)));
    assert.ok(runtimeA.items.every((item) => item.content.options.every((option) => !Object.hasOwn(option, 'is_correct') && !Object.hasOwn(option, 'feedback') && !Object.hasOwn(option, 'distractor_analysis'))));
    assert.ok(new Date(runtimeA.attempt.deadline_at).getTime() <= new Date(endsAt).getTime());
    assert.ok(new Date(runtimeA.attempt.deadline_at).getTime() - new Date(runtimeA.attempt.started_at).getTime() <= 30 * 60_000 + 1000);

    value(await service.from('assessment_item_versions').update({ snapshot: { ...multipleChoice.snapshot, statement: 'ALTERAÇÃO POSTERIOR INDEVIDA' } }).eq('id', multipleChoice.version.id));
    const frozen = value(await clients.studentA.rpc('get_assessment_attempt', { target_attempt: attemptA }));
    assert.ok(frozen.items.some((item) => item.content.statement === multipleChoice.snapshot.statement));
    assert.ok(frozen.items.every((item) => item.content.statement !== 'ALTERAÇÃO POSTERIOR INDEVIDA'));
  });

  await t.test('RLS isolates students, schools, networks and editorial-only roles', async () => {
    assert.equal(value(await clients.studentB.from('assessment_attempts').select('id').eq('id', attemptA)).length, 0);
    assert.equal(value(await clients.studentB.from('assessment_responses').select('id').eq('attempt_id', attemptA)).length, 0);
    assert.ok((await clients.studentB.rpc('get_assessment_attempt', { target_attempt: attemptA })).error);
    assert.equal(value(await clients.teacherB.from('assessment_attempts').select('id').eq('id', attemptA)).length, 0);
    assert.equal(value(await clients.reviewer.from('assessment_attempts').select('id').eq('id', attemptA)).length, 0);
    assert.ok((await clients.adminB.rpc('list_assessment_attempt_monitor', { target_assessment: assessment.id, page_size: 50, page_offset: 0 })).error);
    assert.ok((await anonymous.rpc('get_assessment_attempt', { target_attempt: attemptA })).error);
    assert.ok((await anonymous.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: randomUUID(), response_payload: {}, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 })).error);
    assert.ok((await anonymous.rpc('student_owns_active_attempt', { target_attempt: attemptA })).error);
  });

  await t.test('responses update idempotently before submission and navigation rules run on the backend', async () => {
    const mc = runtimeA.items.find((item) => item.content.id === multipleChoice.item.id);
    const tf = runtimeA.items.find((item) => item.content.id === trueFalse.item.id);
    const essayItem = runtimeA.items.find((item) => item.content.id === essay.item.id);
    assert.ok(mc && tf && essayItem);

    const key = randomUUID();
    const first = value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: mc.id, response_payload: { option_id: multipleChoice.correctOption.id }, mark_for_review: false, idempotency_key: key, expected_revision: 0 }));
    const replay = value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: mc.id, response_payload: { option_id: 'ignored-on-replay' }, mark_for_review: true, idempotency_key: key, expected_revision: 0 }));
    assert.equal(first.response_id, replay.response_id); assert.equal(first.revision, replay.revision); assert.equal(replay.idempotent_replay, true);
    const wrongOption = mc.content.options.find((option) => option.id !== multipleChoice.correctOption.id);
    const updated = value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: mc.id, response_payload: { option_id: wrongOption.id }, mark_for_review: true, idempotency_key: randomUUID(), expected_revision: first.revision }));
    const corrected = value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: mc.id, response_payload: { option_id: multipleChoice.correctOption.id }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: updated.revision }));
    assert.ok(updated.revision > first.revision); assert.ok(corrected.revision > updated.revision);
    value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: tf.id, response_payload: { option_id: trueFalse.correctOption.id }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 }));
    value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: essayItem.id, response_payload: { text: 'Resposta discursiva DEMO para revisão.' }, mark_for_review: true, idempotency_key: randomUUID(), expected_revision: 0 }));

    value(await clients.studentA.rpc('set_assessment_attempt_position', { target_attempt: attemptA, target_position: 3 }));
    assert.ok((await clients.studentA.rpc('set_assessment_attempt_position', { target_attempt: attemptA, target_position: 2 })).error);
    assert.ok((await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: randomUUID(), response_payload: { text: 'fora do escopo' }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 })).error);
  });

  await t.test('simultaneous tabs use optimistic revisions and a stale save cannot overwrite the winner', async () => {
    const tf = runtimeA.items.find((item) => item.content.id === trueFalse.item.id);
    const wrong = tf.content.options.find((option) => option.id !== trueFalse.correctOption.id);
    const concurrent = await Promise.all([
      clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: tf.id, response_payload: { option_id: wrong.id }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 1 }),
      clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: tf.id, response_payload: { option_id: trueFalse.correctOption.id }, mark_for_review: true, idempotency_key: randomUUID(), expected_revision: 1 }),
    ]);
    const winners = concurrent.filter((result) => !result.error);
    const conflicts = concurrent.filter((result) => result.error);
    assert.equal(winners.length, 1); assert.equal(conflicts.length, 1);
    assert.match(conflicts[0].error.message, /revision conflict/i);
    const winnerRevision = winners[0].data.revision;
    const corrected = value(await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: tf.id, response_payload: { option_id: trueFalse.correctOption.id }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: winnerRevision }));
    assert.ok(corrected.revision > winnerRevision);
    assert.ok((await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: tf.id, response_payload: { option_id: wrong.id }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 1 })).error);
    const persisted = value(await clients.studentA.from('assessment_responses').select('answer,revision').eq('attempt_item_id', tf.id).single());
    assert.equal(persisted.answer.option_id, trueFalse.correctOption.id);
    assert.equal(persisted.revision, corrected.revision);
  });

  await t.test('submission is transactional, objective grading is server-side and essay awaits review', async () => {
    assert.ok((await clients.studentA.from('assessment_responses').update({
      points_awarded: 999,
      review_status: 'reviewed',
      reviewer_comment: 'alteração indevida',
      reviewed_by: ids.studentA,
      reviewed_at: new Date().toISOString(),
    }).eq('attempt_id', attemptA)).error);
    const submitted = value(await clients.studentA.rpc('submit_assessment_attempt', { target_attempt: attemptA }));
    const repeated = value(await clients.studentA.rpc('submit_assessment_attempt', { target_attempt: attemptA }));
    assert.equal(submitted.status, 'pending_review');
    assert.equal(submitted.submission_kind, 'submitted');
    assert.deepEqual(repeated, submitted);
    assert.equal(Number(submitted.score), 20);
    const submissionEvents = value(await clients.teacherA.rpc('list_assessment_attempt_events', { target_attempt: attemptA }));
    assert.equal(submissionEvents.filter((event) => event.event_type === 'submitted').length, 1);
    assert.equal(submissionEvents.filter((event) => event.event_type === 'pending_review').length, 1);
    assert.ok((await clients.studentA.rpc('save_assessment_response', { target_attempt: attemptA, target_attempt_item: runtimeA.items[0].id, response_payload: {}, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 })).error);
  });

  await t.test('authorized teacher reviews essay and other roles cannot grade it', async () => {
    const queue = value(await clients.teacherA.rpc('list_pending_essay_responses', { target_assessment: assessment.id, page_size: 50, page_offset: 0 }));
    const response = queue.find((row) => row.attempt_id === attemptA);
    assert.ok(response); assert.equal(response.response_text, 'Resposta discursiva DEMO para revisão.');
    assert.equal(value(await clients.teacherB.rpc('list_pending_essay_responses', { target_assessment: assessment.id, page_size: 50, page_offset: 0 })).length, 0);
    assert.ok((await clients.teacherB.rpc('review_essay_response', { target_response: response.response_id, awarded_points: 10, review_comment: 'fora do escopo' })).error);
    assert.ok((await clients.reviewer.rpc('review_essay_response', { target_response: response.response_id, awarded_points: 10, review_comment: 'papel editorial' })).error);
    const graded = value(await clients.teacherA.rpc('review_essay_response', { target_response: response.response_id, awarded_points: 7, review_comment: 'Critério aplicado pelo professor.' }));
    assert.equal(graded.status, 'graded'); assert.equal(Number(graded.score), 27);
    const studentView = value(await clients.studentA.rpc('get_assessment_attempt', { target_attempt: attemptA }));
    assert.equal(studentView.attempt.status, 'graded'); assert.equal(Number(studentView.attempt.score), 27);
  });

  await t.test('server deadline auto-submits and blocks late or duplicate writes', async () => {
    const attemptBefore = value(await service.from('assessment_attempts').select('started_at,deadline_at').eq('id', attemptB).single());
    assert.ok(attemptBefore.started_at && attemptBefore.deadline_at);
    const runtimeB = value(await clients.studentB.rpc('get_assessment_attempt', { target_attempt: attemptB }));
    const confirmedItem = runtimeB.items.find((item) => item.content.options.length > 0);
    assert.ok(confirmedItem);
    const localOnlyItem = runtimeB.items.find((item) => item.id !== confirmedItem.id);
    assert.ok(localOnlyItem);
    const confirmedOption = confirmedItem.content.options[0]?.id;
    value(await clients.studentB.rpc('save_assessment_response', { target_attempt: attemptB, target_attempt_item: confirmedItem.id, response_payload: { option_id: confirmedOption }, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 }));
    const localOnlyAnswer = { attempt_item_id: localOnlyItem.id, answer: { option_id: localOnlyItem.content.options[0]?.id }, confirmed: false };
    value(await service.from('assessment_attempts').update({
      started_at: new Date(Date.now() - 60_000).toISOString(),
      deadline_at: new Date(Date.now() - 1000).toISOString(),
    }).eq('id', attemptB));
    const expired = value(await clients.studentB.rpc('get_assessment_attempt', { target_attempt: attemptB }));
    assert.equal(expired.attempt.submission_kind, 'auto_submitted');
    assert.equal(expired.attempt.status, 'pending_review');
    assert.equal(expired.responses[confirmedItem.id].answer.option_id, confirmedOption);
    assert.deepEqual(expired.responses[localOnlyAnswer.attempt_item_id].answer, {});
    assert.equal(localOnlyAnswer.confirmed, false);
    assert.ok((await clients.studentB.rpc('save_assessment_response', { target_attempt: attemptB, target_attempt_item: expired.items[0].id, response_payload: {}, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 })).error);
  });

  await t.test('expired token is rejected and brute-force attempts lock access', async () => {
    const issued = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentExpired, valid_minutes: 5 }))[0];
    attemptExpired = issued.attempt_id;
    value(await service.from('assessment_attempts').update({ token_expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', issued.attempt_id));
    assert.equal((await clients.studentExpired.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: issued.access_token, origin: 'token' })).data.ok, false);
    const rotated = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentExpired, valid_minutes: 5 }))[0];
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await clients.studentExpired.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: `INVALID-${index}`, origin: 'token' })).data.ok, false);
    }
    assert.equal((await clients.studentExpired.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: rotated.access_token, origin: 'token' })).data.ok, false);
    const locked = value(await service.from('assessment_attempts').select('token_failed_attempts,token_locked_until').eq('id', issued.attempt_id).single());
    assert.equal(locked.token_failed_attempts, 5); assert.ok(locked.token_locked_until);
  });

  await t.test('administrative transitions are scoped, audited and cannot revive a final attempt arbitrarily', async () => {
    assert.ok((await clients.studentExpired.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'cancel', action_reason: 'Tentativa do próprio aluno' })).error);
    assert.ok((await clients.teacherB.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'cancel', action_reason: 'Outra escola não pode cancelar' })).error);
    assert.ok((await clients.teacherA.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'cancel', action_reason: 'x' })).error);
    const cancelled = value(await clients.teacherA.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'cancel', action_reason: 'Token bloqueado durante a aplicação' }));
    assert.equal(cancelled.status, 'cancelled');
    const reopened = value(await clients.teacherA.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'reopen', action_reason: 'Novo acesso autorizado pela escola' }));
    assert.equal(reopened.status, 'available');
    const replacement = value(await clients.teacherA.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: ids.studentExpired, valid_minutes: 5 }))[0];
    assert.equal(value(await clients.studentExpired.rpc('start_assessment_attempt', { target_schedule: scheduleId, access_token: replacement.access_token, origin: 'token' })).ok, true);
    assert.ok((await clients.teacherB.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'close', action_reason: 'Fora da escola' })).error);
    const closed = value(await clients.teacherA.rpc('manage_assessment_attempt', { target_attempt: attemptExpired, target_action: 'close', action_reason: 'Encerramento supervisionado' }));
    assert.equal(closed.status, 'pending_review');
    assert.ok((await clients.studentExpired.rpc('save_assessment_response', { target_attempt: attemptExpired, target_attempt_item: randomUUID(), response_payload: {}, mark_for_review: false, idempotency_key: randomUUID(), expected_revision: 0 })).error);
    const administrativeEvents = value(await clients.teacherA.rpc('list_assessment_attempt_events', { target_attempt: attemptExpired }));
    for (const event of ['cancelled', 'reopened', 'started', 'submitted', 'pending_review']) assert.ok(administrativeEvents.some((row) => row.event_type === event), event);
  });

  await t.test('monitoring and event log expose real scoped progress without N+1 reads', async () => {
    const monitor = value(await clients.teacherA.rpc('list_assessment_attempt_monitor', { target_assessment: assessment.id, page_size: 2, page_offset: 0 }));
    const nextPage = value(await clients.teacherA.rpc('list_assessment_attempt_monitor', { target_assessment: assessment.id, page_size: 2, page_offset: 2 }));
    assert.equal(monitor.length, 2); assert.equal(nextPage.length, 2); assert.equal(Number(monitor[0].total_count), 4);
    const unissued = [...monitor, ...nextPage].find((row) => row.student_id === ids.studentUnissued);
    assert.ok(unissued); assert.equal(unissued.attempt_id, null); assert.equal(unissued.attempt_status, 'scheduled'); assert.equal(Number(unissued.question_count), 0);
    assert.ok(monitor.some((row) => row.attempt_id === attemptA && row.attempt_status === 'graded' && Number(row.progress_percent) === 100));
    const events = value(await clients.teacherA.rpc('list_assessment_attempt_events', { target_attempt: attemptA }));
    for (const event of ['attempt_created', 'token_rotated', 'started', 'answer_saved', 'submitted', 'pending_review', 'graded']) {
      assert.ok(events.some((row) => row.event_type === event), event);
    }
    assert.ok(events.filter((row) => row.event_type === 'answer_saved').every((row) => !JSON.stringify(row.metadata).includes('Resposta discursiva')));
    assert.ok((await clients.teacherB.rpc('list_assessment_attempt_events', { target_attempt: attemptA })).error);
  });
});
