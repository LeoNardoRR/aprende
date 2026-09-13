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

test('seed POC fecha rede, escola, turma, aluno, analytics e isolamento', async (t) => {
  if (!isLocal(url) || !anon) return t.skip('PoC conectada roda somente no Supabase local descartavel.');
  let manifest;
  try { manifest = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8')); } catch { return t.skip('Execute npm run seed:poc antes da suite conectada.'); }
  assert.equal(manifest.synthetic, true);
  assert.deepEqual(manifest.counts, { networks: 1, schools: 33, grades: 3, classrooms: 6, students: 12, items: 4, attempts: 12 });
  const login = async (email) => { const client = createClient(url, anon, options); value(await client.auth.signInWithPassword({ email, password })); return client; };
  const [admin, manager, teacher, student] = await Promise.all([login(manifest.users.admin), login(manifest.users.manager1), login(manifest.users.teacher1), login(manifest.users.student1)]);

  const network = value(await admin.rpc('get_analytics_dashboard', { filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id } }));
  assert.equal(Number(network.summary.students), 12);
  assert.equal(Number(network.summary.attempts), 12);
  const school = value(await manager.rpc('get_analytics_dashboard', { filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id } }));
  assert.equal(Number(school.summary.students), 4);
  const otherSchool = value(await manager.rpc('get_analytics_dashboard', { filters: { school_id: manifest.school_ids[1], assessment_id: manifest.assessment_id } }));
  assert.equal(otherSchool.state, 'empty');
  const classroomScope = value(await teacher.rpc('get_analytics_dashboard', { filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id } }));
  assert.equal(Number(classroomScope.summary.students), 4);
  const own = value(await student.rpc('get_analytics_dashboard', { filters: { assessment_id: manifest.assessment_id } }));
  assert.equal(Number(own.summary.students), 1);
  const manipulated = value(await student.rpc('get_analytics_dashboard', { filters: { student_id: network.students.find((row) => row.student_id !== own.students[0].student_id).student_id } }));
  assert.equal(manipulated.state, 'empty');
  assert.equal(value(await student.from('assessment_responses').select('id')).length, 4);
  assert.equal(value(await student.from('proficiency_scales').select('id')).length, 0);
});
