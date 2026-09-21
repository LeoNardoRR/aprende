import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../../scripts/poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const options = { auth: { persistSession: false, autoRefreshToken: false } };

test('pacote de impressão usa versões reais e bloqueia outra escola', async (t) => {
  if (!url || !anon || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Exige Supabase local descartável.');
    return;
  }
  const fixture = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
  assert.equal(fixture.synthetic, true);
  async function login(email) {
    const client = createClient(url, anon, options);
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.ifError(signed.error);
    return client;
  }
  const [admin, managerOtherSchool, student] = await Promise.all([
    login(fixture.users.admin), login(fixture.users.manager2), login(fixture.users.student1),
  ]);
  const bookletResult = await admin.from('assessment_booklets').select('id').eq('assessment_id', fixture.assessment_id).single();
  assert.ifError(bookletResult.error);
  const args = { target_booklet: bookletResult.data.id, target_classroom: fixture.classroom_ids[0] };
  const result = await admin.rpc('get_assessment_print_payload', args);
  assert.ifError(result.error);
  assert.equal(result.data.assessmentId, fixture.assessment_id);
  assert.equal(result.data.questions.length, 4);
  assert.equal(result.data.questions[0].options[0].text, 'Resposta correta DEMO');
  assert.equal(result.data.questions[0].correctAnswer, 'A');
  assert.ok(result.data.students.length > 0);
  assert.ok((await managerOtherSchool.rpc('get_assessment_print_payload', args)).error);
  assert.ok((await student.rpc('get_assessment_print_payload', args)).error);
});
