import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root } from './poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLocal = (target) => { try { return ['localhost', '127.0.0.1'].includes(new URL(target).hostname); } catch { return false; } };
if (!isLocal(url) || !serviceKey) throw new Error('seed:phase7 exige a instancia Supabase local descartavel.');
const base = JSON.parse(await readFile(path.join(root, 'artifacts/poc/seed-manifest.json'), 'utf8'));
if (!base.synthetic || !base.user_ids) throw new Error('Execute novamente npm run seed:poc antes de seed:phase7.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!anonKey) throw new Error('seed:phase7 exige a chave anon da instancia local.');
const teacher = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const value = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const one = async (table, payload) => value(await db.from(table).insert(payload).select().single(), `insert ${table}`);
const networkId = base.network_id;

for (const table of ['pedagogical_recommendations', 'learning_journey_assignments', 'reading_fluency_activities', 'equity_group_definitions', 'ai_pedagogical_suggestions', 'learning_journeys', 'pedagogical_resources', 'remediation_programs']) {
  value(await db.from(table).delete().eq('network_id', networkId), `clean ${table}`);
}

const curriculum = value(await db.from('curricula').select('id').eq('network_id', networkId).single(), 'curriculum');
const skills = value(await db.from('curriculum_skills').select('id,code').eq('curriculum_id', curriculum.id).order('code'), 'skills');
const common = { network_id: networkId, status: 'published', current_version: 1, author_id: base.user_ids.teacher1, reviewed_by: base.user_ids.reviewer, approved_by: base.user_ids.approver, published_at: '2026-09-13T12:00:00Z' };
const guide = await one('pedagogical_resources', { ...common, skill_id: skills[0].id, title: 'Estratégias de cálculo - DEMO', description: 'Material sintético de apoio com exemplos graduais.', resource_type: 'interactive', difficulty: 'adaptive', estimated_minutes: 15, source_name: 'Aprendê DEMO' });
const reading = await one('pedagogical_resources', { ...common, skill_id: skills[1].id, title: 'Leitura orientada - DEMO', description: 'Texto sintético criado somente para testar fluência no ambiente local.', resource_type: 'text', difficulty: 'introductory', estimated_minutes: 10, source_name: 'Aprendê DEMO' });
for (const resource of [guide, reading]) await one('pedagogical_resource_versions', { resource_id: resource.id, version_number: 1, snapshot: resource, change_summary: 'Publicação sintética determinística.', created_by: base.user_ids.approver });

const program = await one('remediation_programs', { network_id: networkId, name: 'Recomposição matemática - DEMO', description: 'Programa sintético da Fase 7.', status: 'active', created_by: base.user_ids.admin });
const journey = await one('learning_journeys', { network_id: networkId, program_id: program.id, curriculum_id: curriculum.id, skill_id: skills[0].id, title: 'Reconstruindo estratégias de cálculo - DEMO', description: 'Explicação, prática guiada e reavaliação em uma sequência validada.', difficulty: 'adaptive', estimated_minutes: 35, mastery_threshold: 70, status: 'draft', current_version: 0, created_by: base.user_ids.teacher1 });
const steps = [];
steps.push(await one('learning_journey_steps', { journey_id: journey.id, resource_id: guide.id, title: 'Retomar a estratégia', instructions: 'Leia o exemplo e identifique as etapas.', step_type: 'content', position: 1, required: true, pedagogical_points: 0, gamification_points: 10 }));
steps.push(await one('learning_journey_steps', { journey_id: journey.id, resource_id: guide.id, title: 'Praticar com apoio', instructions: 'Resolva os exercícios usando as pistas.', step_type: 'exercise', position: 2, required: true, pedagogical_points: 10, gamification_points: 15 }));
steps.push(await one('learning_journey_steps', { journey_id: journey.id, assessment_id: base.assessment_id, title: 'Verificar o que aprendeu', instructions: 'Faça a reavaliação para registrar a evolução observada.', step_type: 'reassessment', position: 3, required: true, pedagogical_points: 20, gamification_points: 20 }));
value(await teacher.auth.signInWithPassword({ email: base.users.teacher1, password }), 'teacher login');
value(await teacher.rpc('configure_journey_step_validation', { target_step: steps[0].id, response_type: 'acknowledgement', prompt: 'Confirme que leu o exemplo.', options: [], answer_key: {}, max_score: 0 }), 'configure acknowledgement');
value(await teacher.rpc('configure_journey_step_validation', { target_step: steps[1].id, response_type: 'single_choice', prompt: 'Qual estratégia decompõe 27 + 15 corretamente?', options: ['20 + 10 + 7 + 5', '27 + 10 + 15', '20 + 7 + 5'], answer_key: { choice: '20 + 10 + 7 + 5' }, max_score: 10 }), 'configure exercise');
value(await teacher.rpc('configure_journey_step_validation', { target_step: steps[2].id, response_type: 'assessment', prompt: 'Conclua a reavaliação vinculada.', options: [], answer_key: {}, max_score: 20 }), 'configure reassessment');
const publishedJourney = value(await db.from('learning_journeys').update({ status: 'published', current_version: 1, reviewed_by: base.user_ids.reviewer, approved_by: base.user_ids.approver, published_at: '2026-09-13T12:00:00Z' }).eq('id', journey.id).select().single(), 'publish journey');
const validationPublic = [
  { step_id: steps[0].id, response_type: 'acknowledgement', prompt: 'Confirme que leu o exemplo.', options: [] },
  { step_id: steps[1].id, response_type: 'single_choice', prompt: 'Qual estratégia decompõe 27 + 15 corretamente?', options: ['20 + 10 + 7 + 5', '27 + 10 + 15', '20 + 7 + 5'] },
  { step_id: steps[2].id, response_type: 'assessment', prompt: 'Conclua a reavaliação vinculada.', options: [] },
];
const journeyVersion = await one('learning_journey_versions', { journey_id: journey.id, version_number: 1, snapshot: { journey: publishedJourney, steps: steps.map((step) => ({ ...step, validation: validationPublic.find((item) => item.step_id === step.id) })) }, created_by: base.user_ids.approver });

const requestKey = '77000000-0000-4000-8000-000000000001';
const assignment = await one('learning_journey_assignments', { journey_id: journey.id, journey_version_id: journeyVersion.id, network_id: networkId, school_id: base.school_ids[0], classroom_id: base.classroom_ids[0], target_type: 'classroom', source_assessment_id: base.assessment_id, source_skill_id: skills[0].id, reason: 'Desempenho diagnóstico abaixo do limiar DEMO.', status: 'active', idempotency_key: requestKey, assigned_by: base.user_ids.teacher1 });
for (const key of ['student1', 'student2']) await one('learning_journey_students', { assignment_id: assignment.id, student_id: base.user_ids[key], status: key === 'student1' ? 'in_progress' : 'assigned', progress_percentage: key === 'student1' ? 33.33 : 0, gamification_points: key === 'student1' ? 10 : 0, started_at: key === 'student1' ? '2026-09-13T13:00:00Z' : null });
await one('learning_journey_step_progress', { assignment_id: assignment.id, student_id: base.user_ids.student1, step_id: steps[0].id, status: 'completed', response: { synthetic: true }, started_at: '2026-09-13T13:00:00Z', completed_at: '2026-09-13T13:05:00Z' });
const recommendation = await one('pedagogical_recommendations', { network_id: networkId, school_id: base.school_ids[0], classroom_id: base.classroom_ids[0], student_id: base.user_ids.student1, assessment_id: base.assessment_id, skill_id: skills[0].id, journey_id: journey.id, observed_percentage: 50, threshold_percentage: 60, explanation: 'Desempenho observado de 50% abaixo do limiar configurado de 60%.', created_by: base.user_ids.teacher1 });
const aiSuggestion = await one('ai_pedagogical_suggestions', { network_id: networkId, suggestion_type: 'activity', structured_prompt: { skill_code: skills[0].code, objective: 'propor atividade graduada' }, generated_content: { title: 'Atividade sugerida DEMO', body: 'Conteúdo sintético pendente de revisão humana.' }, provider: 'deterministic-local-fixture', model: 'none', requested_by: base.user_ids.teacher1 });
const fluencyActivity = await one('reading_fluency_activities', { network_id: networkId, school_id: base.school_ids[0], classroom_id: base.classroom_ids[0], resource_id: reading.id, title: 'Aplicação de fluência - DEMO', starts_at: '2026-09-13T12:00:00Z', due_at: '2026-09-30T23:59:00Z', status: 'active', created_by: base.user_ids.teacher1 });
const fluencySession = await one('reading_fluency_sessions', { activity_id: fluencyActivity.id, student_id: base.user_ids.student1, words_read: 100, correct_words: 90, errors: 5, omissions: 3, substitutions: 2, duration_seconds: 75, classification: 'Registro DEMO sem escala oficial', notes: 'Métrica observada manualmente.', recorded_by: base.user_ids.teacher1 });
const equityGroup = await one('equity_group_definitions', { network_id: networkId, name: 'Grupo sintético A - DEMO', description: 'Agrupamento sem atributo sensível real.', minimum_group_size: 3, created_by: base.user_ids.admin });
for (const key of ['student1', 'student2', 'student3', 'student4']) await one('equity_group_members', { group_id: equityGroup.id, student_id: base.user_ids[key], added_by: base.user_ids.admin });

const manifest = { synthetic: true, network_id: networkId, skill_id: skills[0].id, skill_code: skills[0].code, resource_ids: [guide.id, reading.id], journey_id: journey.id, step_ids: steps.map((step) => step.id), assignment_id: assignment.id, recommendation_id: recommendation.id, ai_suggestion_id: aiSuggestion.id, fluency_activity_id: fluencyActivity.id, fluency_session_id: fluencySession.id, equity_group_id: equityGroup.id, expected_wcpm: 72 };
await mkdir(path.join(root, 'artifacts/poc'), { recursive: true });
await writeFile(path.join(root, 'artifacts/poc/phase7-seed-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Seed Fase 7 concluído: recursos, jornada, intervenção, fluência e equidade sintéticos.');
