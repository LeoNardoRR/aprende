import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../../scripts/poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';

test('importação offline persiste CREATE/UPDATE/SKIP com idempotência e escopo escolar', async (t) => {
  if (!url || !anon || !serviceKey || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Exige Supabase local descartável e chave de fixture.');
    return;
  }
  const fixture = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  async function login(email) {
    const client = createClient(url, anon, options);
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.ifError(signed.error);
    return client;
  }
  const service = createClient(url, serviceKey, options);
  const [manager, otherSchool] = await Promise.all([
    login(fixture.users.manager1), login(fixture.users.manager2),
  ]);
  const attempt = await service.from('assessment_attempts').select('id,student_id,network_id,school_id')
    .eq('id', fixture.attempt_id).single();
  assert.ifError(attempt.error);
  const attemptItem = await service.from('assessment_attempt_items')
    .select('id,source_booklet_item_id,snapshot').eq('attempt_id', attempt.data.id).order('position').limit(1).single();
  assert.ifError(attemptItem.error);
  const bookletItem = await service.from('assessment_booklet_items').select('assessment_item_id')
    .eq('id', attemptItem.data.source_booklet_item_id).single();
  assert.ifError(bookletItem.error);
  const original = await service.from('assessment_responses').select('*')
    .eq('attempt_item_id', attemptItem.data.id).single();
  assert.ifError(original.error);
  const optionsInSnapshot = attemptItem.data.snapshot.options;
  const first = optionsInSnapshot[0].id;
  const second = optionsInSnapshot[1].id;
  const baseRow = {
    line: 2, assessmentId: fixture.assessment_id, studentId: attempt.data.student_id,
    questionId: bookletItem.data.assessment_item_id, answer: first, issues: [], valid: true,
    conflict: false, decision: 'CREATE',
  };
  const fingerprints = ['a', 'b', 'c', 'd'].map((letter) => letter.repeat(64));
  t.after(async () => {
    await service.from('offline_response_imports').delete().in('content_hash', fingerprints);
    await service.from('assessment_responses').delete().eq('attempt_item_id', attemptItem.data.id);
    const { id: _id, ...restore } = original.data;
    await service.from('assessment_responses').insert({ ...restore, id: original.data.id });
  });

  assert.ifError((await service.from('assessment_responses').delete().eq('attempt_item_id', attemptItem.data.id)).error);
  const args = {
    target_network: fixture.network_id, target_assessment: fixture.assessment_id,
    source_filename: 'respostas.csv', source_fingerprint: fingerprints[0], preview_rows: [baseRow],
  };
  const created = await manager.rpc('commit_offline_response_import', args);
  assert.ifError(created.error);
  assert.equal(created.data.created, 1);
  const replay = await manager.rpc('commit_offline_response_import', args);
  assert.ifError(replay.error);
  assert.equal(replay.data.status, 'already_imported');

  const updated = await manager.rpc('commit_offline_response_import', {
    ...args, source_fingerprint: fingerprints[1],
    preview_rows: [{ ...baseRow, answer: second, conflict: true, decision: 'UPDATE', issues: ['conflict'] }],
  });
  assert.ifError(updated.error);
  assert.equal(updated.data.updated, 1);
  const skipped = await manager.rpc('commit_offline_response_import', {
    ...args, source_fingerprint: fingerprints[2], preview_rows: [{ ...baseRow, decision: 'SKIP' }],
  });
  assert.ifError(skipped.error);
  assert.equal(skipped.data.skipped, 1);

  const forbidden = await otherSchool.rpc('commit_offline_response_import', {
    ...args, source_fingerprint: fingerprints[3], preview_rows: [{ ...baseRow, decision: 'UPDATE' }],
  });
  assert.ok(forbidden.error);
  const leakedBatch = await service.from('offline_response_imports').select('id').eq('content_hash', fingerprints[3]);
  assert.ifError(leakedBatch.error);
  assert.equal(leakedBatch.data.length, 0, 'falha de autorização precisa reverter o lote inteiro');
});
