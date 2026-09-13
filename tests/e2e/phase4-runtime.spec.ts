import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required for the local Phase 4 E2E test.`);
  return value;
}

function data(result: { data: unknown; error: unknown }): any {
  if (result.error) {
    const message = typeof result.error === 'object' && result.error && 'message' in result.error
      ? String(result.error.message)
      : 'Unknown Supabase error';
    throw new Error(message);
  }
  if (result.data == null) throw new Error('Supabase returned no data.');
  return result.data;
}

function success(result: { error: unknown }): void {
  if (result.error) {
    const message = typeof result.error === 'object' && result.error && 'message' in result.error
      ? String(result.error.message)
      : 'Unknown Supabase error';
    throw new Error(message);
  }
}

async function signIn(email: string, password: string) {
  const client = createClient(required(url, 'SUPABASE_URL'), required(anonKey, 'SUPABASE_ANON_KEY'), clientOptions);
  const signedIn = data(await client.auth.signInWithPassword({ email, password }));
  if (!signedIn.user || !signedIn.session) throw new Error('The E2E user could not sign in.');
  return client;
}

type Fixture = {
  service: SupabaseClient;
  teacher: SupabaseClient;
  networkId: string;
  studentId: string;
  attemptId: string;
  email: string;
  teacherEmail: string;
  password: string;
  token: string;
  title: string;
};

async function createFixture(): Promise<Fixture> {
  const localUrl = required(url, 'SUPABASE_URL');
  if (!['127.0.0.1', 'localhost'].includes(new URL(localUrl).hostname)) {
    throw new Error('The Phase 4 E2E fixture may run only against disposable local Supabase.');
  }
  const service = createClient(localUrl, required(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
  const suffix = randomUUID().slice(0, 8);
  const password = `Local-e2e-${suffix}-!Aa12345`;
  const studentEmail = `phase4-e2e-student-${suffix}@example.test`;
  const teacherEmail = `phase4-e2e-teacher-${suffix}@example.test`;
  const student = data(await service.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { display_name: 'Aluno E2E Fase 4' } })).user;
  const teacherUser = data(await service.auth.admin.createUser({ email: teacherEmail, password, email_confirm: true, user_metadata: { display_name: 'Professor E2E Fase 4' } })).user;
  if (!student || !teacherUser) throw new Error('The E2E fixture users could not be created.');
  success(await service.from('profiles').update({ role: 'teacher' }).eq('id', teacherUser.id));
  const teacher = await signIn(teacherEmail, password);

  const network = data(await service.from('networks').insert({ name: `Rede E2E F4 ${suffix}`, created_by: teacherUser.id }).select().single());
  const school = data(await service.from('schools').insert({ network_id: network.id, name: 'Escola E2E F4', code: `E2E-${suffix}` }).select().single());
  const year = data(await service.from('academic_years').insert({ network_id: network.id, label: `2026 E2E ${suffix}`, starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'open' }).select().single());
  const schoolYear = data(await service.from('school_years').insert({ school_id: school.id, name: '6º ano', code: `6E2E-${suffix}` }).select().single());
  for (const [userId, role] of [[teacherUser.id, 'teacher'], [student.id, 'student']] as const) {
    success(await service.from('institutional_memberships').insert({ user_id: userId, network_id: network.id, school_id: school.id, role, status: 'active', created_by: teacherUser.id }));
  }
  const classroom = data(await service.from('classrooms').insert({
    owner_id: teacherUser.id, name: `Turma E2E ${suffix}`, subject: 'Matemática', join_code: `E${suffix.toUpperCase()}`,
    network_id: network.id, school_id: school.id, academic_year_id: year.id, school_year_id: schoolYear.id, classroom_status: 'active',
  }).select().single());
  success(await service.from('student_enrollments').insert({
    student_id: student.id, network_id: network.id, school_id: school.id, academic_year_id: year.id,
    classroom_id: classroom.id, status: 'enrolled', source: 'manual', created_by: teacherUser.id,
  }));

  const curriculum = data(await service.from('curricula').insert({ network_id: network.id, name: `Currículo E2E ${suffix}`, curriculum_type: 'custom', version: '1', created_by: teacherUser.id }).select().single());
  const area = data(await service.from('curriculum_areas').insert({ curriculum_id: curriculum.id, name: 'Matemática' }).select().single());
  const subject = data(await service.from('curriculum_subjects').insert({ curriculum_id: curriculum.id, area_id: area.id, name: 'Matemática' }).select().single());
  const curriculumYear = data(await service.from('curriculum_school_years').insert({ curriculum_id: curriculum.id, school_year_id: schoolYear.id, code: `6EF-${suffix}`, name: '6º ano' }).select().single());
  const skill = data(await service.from('curriculum_skills').insert({ curriculum_id: curriculum.id, subject_id: subject.id, curriculum_school_year_id: curriculumYear.id, code: `E2E-${suffix}`, description: 'Habilidade DEMO exclusiva do teste E2E descartável.' }).select().single());

  const itemIds: string[] = [];
  for (let itemIndex = 1; itemIndex <= 2; itemIndex += 1) {
    const item = data(await service.from('assessment_items').insert({
      network_id: network.id, curriculum_id: curriculum.id, curriculum_school_year_id: curriculumYear.id,
      subject_id: subject.id, skill_id: skill.id, internal_title: `DEMO E2E questão ${itemIndex} ${suffix}`,
      statement: `Questão E2E ${itemIndex}: selecione uma alternativa.`, difficulty: 'medium', item_type: 'multiple_choice',
      status: 'approved', author_id: teacherUser.id, image_paths: [],
    }).select().single());
    const options = [1, 2, 3, 4].map((optionIndex) => ({
      id: randomUUID(), label: String.fromCharCode(64 + optionIndex), content: `Opção ${optionIndex} da questão ${itemIndex}`,
      is_correct: optionIndex === 1, feedback: null,
      distractor_analysis: optionIndex === 1 ? null : 'Análise DEMO do distrator.', sort_order: optionIndex - 1,
    }));
    success(await service.from('assessment_item_versions').insert({
      item_id: item.id, version_number: 1, created_by: teacherUser.id,
      snapshot: {
        id: item.id, network_id: network.id, curriculum_id: curriculum.id,
        curriculum_school_year_id: curriculumYear.id, subject_id: subject.id, skill_id: skill.id,
        internal_title: item.internal_title, statement: item.statement, support_text: null,
        pedagogical_comment: 'DEMO E2E.', correct_answer_justification: 'Justificativa DEMO E2E.',
        difficulty: 'medium', item_type: 'multiple_choice', formula: null, image_paths: [], options,
      },
    }));
    itemIds.push(item.id);
  }

  const startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const endsAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const cycle = data(await service.from('assessment_cycles').insert({ network_id: network.id, name: `Ciclo E2E ${suffix}`, starts_at: startsAt, ends_at: endsAt, created_by: teacherUser.id }).select().single());
  const title = `Avaliação offline E2E ${suffix}`;
  const assessment = data(await service.from('diagnostic_assessments').insert({
    cycle_id: cycle.id, network_id: network.id, curriculum_id: curriculum.id, subject_id: subject.id,
    curriculum_school_year_id: curriculumYear.id, title, instructions: 'Fluxo E2E descartável.', duration_minutes: 30,
    randomize_questions: false, randomize_options: false, allow_back_navigation: true, created_by: teacherUser.id,
  }).select().single());
  const bookletId = data(await teacher.rpc('create_assessment_booklet', { target_assessment: assessment.id, booklet_title: null, strategy: 'manual', deterministic_seed: `E2E-${suffix}` }));
  for (const [index, itemId] of itemIds.entries()) {
    data(await teacher.rpc('add_approved_item_to_booklet', { target_booklet: bookletId, target_item: itemId, target_position: index + 1, item_points: 10 }));
  }
  success(await teacher.rpc('transition_diagnostic_assessment', { target_assessment: assessment.id, target_action: 'ready' }));
  const scheduleId = data(await teacher.rpc('schedule_diagnostic_assessment', {
    target_assessment: assessment.id, target_school: school.id, target_classrooms: [classroom.id],
    window_starts_at: startsAt, window_ends_at: endsAt,
  }));
  const issued = data(await teacher.rpc('issue_assessment_access_token', { target_schedule: scheduleId, target_student: student.id, valid_minutes: 120 }))[0];
  return { service, teacher, networkId: network.id, studentId: student.id, attemptId: issued.attempt_id, email: studentEmail, teacherEmail, password, token: issued.access_token, title };
}

async function cleanupFixture(fixture: Fixture) {
  await fixture.service.from('assessment_attempts').delete().eq('network_id', fixture.networkId);
  await fixture.service.from('audit_logs').delete().eq('network_id', fixture.networkId);
  await fixture.service.from('networks').delete().eq('id', fixture.networkId);
  await fixture.service.auth.admin.deleteUser(fixture.studentId);
  const teacherProfile = data(await fixture.teacher.auth.getUser()).user;
  if (teacherProfile) await fixture.service.auth.admin.deleteUser(teacherProfile.id);
}

test('restores an offline answer, blocks pending submit, reconnects and locks the final attempt', async ({ page }) => {
  const fixture = await createFixture();
  try {
    await page.goto('/');
    await page.getByLabel('E-mail').fill(fixture.email);
    await page.getByLabel('Senha').fill(fixture.password);
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Minhas aplicações' })).toBeVisible();

    const application = page.locator('.assessment-entry-list article').filter({ hasText: fixture.title });
    await expect(application).toBeVisible();
    await application.getByRole('textbox', { name: `Token para ${fixture.title}` }).fill(fixture.token);
    await application.getByRole('button', { name: 'Acessar' }).click();
    await expect(page.getByRole('heading', { name: fixture.title })).toBeVisible();

    await page.locator('.assessment-options input[type="radio"]').first().check();
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Próxima/ }).click();
    await expect(page.getByText('Questão 2 de 2')).toBeVisible();

    await page.route('**/rest/v1/rpc/save_assessment_response', (route) => route.abort('internetdisconnected'));
    await page.locator('.assessment-options input[type="radio"]').nth(1).check();
    await expect(page.getByText('Erro ao sincronizar', { exact: true })).toBeVisible();
    await expect(page.getByText(/1 resposta\(s\) aguardando sincronização/)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Sincronizar e finalizar' }).click();
    await expect(page.getByText('Estamos sincronizando suas respostas antes de finalizar. Verifique sua conexão e tente novamente.')).toBeVisible();
    const openAttempt = data(await fixture.service.from('assessment_attempts').select('status,submitted_at').eq('id', fixture.attemptId).single());
    expect(openAttempt.status).toBe('in_progress');
    expect(openAttempt.submitted_at).toBeNull();

    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    const reloadedApplication = page.locator('.assessment-entry-list article').filter({ hasText: fixture.title });
    await reloadedApplication.getByRole('button', { name: 'Retomar' }).click();
    await expect(page.getByText('Questão 2 de 2')).toBeVisible();
    await expect(page.locator('.assessment-options input[type="radio"]:checked')).toHaveCount(1);

    await page.unroute('**/rest/v1/rpc/save_assessment_response');
    await page.getByRole('button', { name: 'Tentar sincronizar novamente' }).click();
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    await expect(page.getByText(/aguardando sincronização/)).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Finalizar prova' }).click();
    await expect(page.getByText('AVALIAÇÃO ENVIADA')).toBeVisible();
    const finished = data(await fixture.service.from('assessment_attempts').select('status,submitted_at').eq('id', fixture.attemptId).single());
    expect(finished.status).toBe('graded');
    expect(finished.submitted_at).not.toBeNull();
    expect(data(await fixture.service.from('assessment_responses').select('id').eq('attempt_id', fixture.attemptId))).toHaveLength(2);

    await page.getByRole('button', { name: 'Voltar às avaliações' }).click();
    await page.locator('.assessment-entry-list article').filter({ hasText: fixture.title }).getByRole('button', { name: 'Ver envio' }).click();
    await expect(page.getByText('AVALIAÇÃO ENVIADA')).toBeVisible();
    await expect(page.locator('.assessment-options input[type="radio"]')).toHaveCount(0);

    await page.goto('/?auth=teacher');
    await page.getByLabel('E-mail').fill(fixture.teacherEmail);
    await page.getByLabel('Senha').fill(fixture.password);
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
    await page.getByRole('button', { name: 'Notas' }).click();
    await expect(page.getByRole('heading', { name: 'Desempenho da turma' })).toBeVisible();
    await expect(page.getByText('Participação', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Habilidades' })).toBeVisible();
    await page.getByRole('button', { name: 'Detalhar' }).first().click();
    await expect(page.getByText('Aluno E2E Fase 4')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^aprende-classroom-.*\.pdf$/);
  } finally {
    await cleanupFixture(fixture);
  }
});
