import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../scripts/poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const isLocal = (target) => { try { return ['localhost', '127.0.0.1'].includes(new URL(target).hostname); } catch { return false; } };
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const value = (result) => { assert.ifError(result.error); return result.data; };

async function fixtures(t) {
  if (!isLocal(url) || !anon) { t.skip('Fase 7 conectada roda somente no Supabase local descartável.'); return null; }
  let base; let phase7;
  try {
    base = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
    phase7 = JSON.parse(await readFile(`${root}/artifacts/poc/phase7-seed-manifest.json`, 'utf8'));
  } catch { t.skip('Execute npm run seed:poc && npm run seed:phase7 antes da suíte conectada.'); return null; }
  assert.equal(base.synthetic, true); assert.equal(phase7.synthetic, true);
  const login = async (email) => { const client = createClient(url, anon, options); value(await client.auth.signInWithPassword({ email, password })); return client; };
  return { base, phase7, login };
}

test('catálogo publicado alimenta atribuição real e respeita o escopo da turma', async (t) => {
  const f = await fixtures(t); if (!f) return;
  const [teacher, otherTeacher] = await Promise.all([f.login(f.base.users.teacher1), f.login(f.base.users.teacher2)]);
  const catalog = value(await teacher.rpc('list_pedagogical_catalog', { target_network: f.base.network_id, target_skill: null }));
  assert.equal(catalog.journeys.some((row) => row.id === f.phase7.journey_id), true);
  assert.equal(catalog.resources.length, 2);
  const denied = await otherTeacher.rpc('assign_learning_journey', { target_journey: f.phase7.journey_id, target_classroom: f.base.classroom_ids[0], target_students: null, assignment_reason: 'Ataque entre escolas', source_assessment: null, request_key: '77000000-0000-4000-8000-000000000099' });
  assert.ok(denied.error);
  const hidden = value(await otherTeacher.rpc('get_pedagogical_dashboard', { filters: { classroom_id: f.base.classroom_ids[0] } }));
  assert.equal(hidden.state, 'empty');
});

test('aluno vê somente sua jornada e progresso é idempotente', async (t) => {
  const f = await fixtures(t); if (!f) return;
  const [student, outsider] = await Promise.all([f.login(f.base.users.student1), f.login(f.base.users.student3)]);
  const own = value(await student.rpc('get_my_learning_journeys'));
  assert.equal(own.length, 1); assert.equal(own[0].assignment_id, f.phase7.assignment_id);
  assert.equal(own[0].journey_version, 1);
  assert.equal(own[0].steps[1].response_type, 'single_choice');
  const outOfOrder = await student.rpc('save_journey_step_progress', { target_assignment: f.phase7.assignment_id, target_step: f.phase7.step_ids[2], target_status: 'completed', response_payload: { acknowledged: true }, request_key: crypto.randomUUID() });
  assert.ok(outOfOrder.error);
  const key = '77000000-0000-4000-8000-000000000010';
  const saved = value(await student.rpc('save_journey_step_progress', { target_assignment: f.phase7.assignment_id, target_step: f.phase7.step_ids[1], target_status: 'completed', response_payload: { choice: '20 + 10 + 7 + 5' }, request_key: key }));
  assert.equal(saved.idempotent, false); assert.equal(Number(saved.progress_percentage), 66.67);
  assert.equal(Number(saved.pedagogical_score), 10);
  const prematureReassessment = await student.rpc('save_journey_step_progress', { target_assignment: f.phase7.assignment_id, target_step: f.phase7.step_ids[2], target_status: 'completed', response_payload: {}, request_key: crypto.randomUUID() });
  assert.ok(prematureReassessment.error, 'reavaliação anterior à atribuição ou ainda não corrigida não conclui a jornada');
  const repeated = value(await student.rpc('save_journey_step_progress', { target_assignment: f.phase7.assignment_id, target_step: f.phase7.step_ids[1], target_status: 'completed', response_payload: { choice: '20 + 10 + 7 + 5' }, request_key: key }));
  assert.equal(repeated.idempotent, true);
  assert.equal(value(await outsider.rpc('get_my_learning_journeys')).length, 0);
  const attack = await outsider.rpc('save_journey_step_progress', { target_assignment: f.phase7.assignment_id, target_step: f.phase7.step_ids[1], target_status: 'completed', response_payload: {}, request_key: crypto.randomUUID() });
  assert.ok(attack.error);
  assert.equal(value(await student.from('learning_journey_assignments').select('id')).length, 0);
});

test('sugestão assistiva exige revisão humana e recusa PII', async (t) => {
  const f = await fixtures(t); if (!f) return;
  const [teacher, reviewer] = await Promise.all([f.login(f.base.users.teacher1), f.login(f.base.users.reviewer)]);
  const teacherApproval = await teacher.rpc('review_ai_pedagogical_suggestion', { target_suggestion: f.phase7.ai_suggestion_id, decision: 'approved', notes: 'Tentativa indevida' });
  assert.ok(teacherApproval.error);
  const sensitive = await teacher.rpc('request_ai_pedagogical_suggestion', { target_network: f.base.network_id, suggestion_type: 'activity', structured_prompt: { context: { student_name: 'Dado proibido' } }, generated_content: { title: 'x' }, provider: 'fixture', model: 'none' });
  assert.ok(sensitive.error);
  const approved = value(await reviewer.rpc('review_ai_pedagogical_suggestion', { target_suggestion: f.phase7.ai_suggestion_id, decision: 'approved', notes: 'Conteúdo sintético revisado.' }));
  assert.equal(approved.status, 'approved'); assert.equal(approved.reviewed_by != null, true);
});

test('fluência calcula PCMin e equidade suprime ou bloqueia o escopo inadequado', async (t) => {
  const f = await fixtures(t); if (!f) return;
  const [student, manager, admin] = await Promise.all([f.login(f.base.users.student1), f.login(f.base.users.manager1), f.login(f.base.users.admin)]);
  const sessions = value(await student.from('reading_fluency_sessions').select('correct_words_per_minute').eq('id', f.phase7.fluency_session_id));
  assert.equal(Number(sessions[0].correct_words_per_minute), f.phase7.expected_wcpm);
  const managerAttack = await manager.rpc('get_equity_summary', { target_network: f.base.network_id, target_assessment: f.base.assessment_id });
  assert.ok(managerAttack.error);
  const summary = value(await admin.rpc('get_equity_summary', { target_network: f.base.network_id, target_assessment: f.base.assessment_id }));
  assert.equal(summary.methodology.includes('não representa fórmula oficial VAAR'), true);
  assert.equal(summary.groups[0].suppressed, false);
  assert.equal(Number(summary.groups[0].students), 4);
});
