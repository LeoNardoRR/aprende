import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../../scripts/poc-matrix.mjs';

test('titular exporta somente o próprio pacote após autorização auditada', async (t) => {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceKey || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Exige Supabase local descartável e chave de fixture.');
    return;
  }
  const fixture = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  async function login(email) {
    const client = createClient(url, anon, options);
    const signed = await client.auth.signInWithPassword({
      email, password: process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026',
    });
    assert.ifError(signed.error);
    return client;
  }
  const service = createClient(url, serviceKey, options);
  const [student, manager, otherStudent] = await Promise.all([
    login(fixture.users.student1), login(fixture.users.manager1), login(fixture.users.student2),
  ]);
  const request = await student.from('privacy_requests').insert({
    requester_id: fixture.user_ids.student1, network_id: fixture.network_id,
    request_type: 'export', details: 'Teste sintético de exportação.',
  }).select().single();
  assert.ifError(request.error);
  t.after(async () => { await service.from('privacy_requests').delete().eq('id', request.data.id); });
  assert.ifError((await manager.from('privacy_requests').update({ status: 'validating', handled_by: fixture.user_ids.manager1 }).eq('id', request.data.id)).error);
  assert.ifError((await manager.from('privacy_requests').update({ status: 'authorized', handled_by: fixture.user_ids.manager1 }).eq('id', request.data.id)).error);
  assert.ok((await otherStudent.rpc('export_my_privacy_request', { target_request: request.data.id })).error);
  const exported = await student.rpc('export_my_privacy_request', { target_request: request.data.id });
  assert.ifError(exported.error);
  assert.equal(exported.data.subject_id, fixture.user_ids.student1);
  assert.equal(exported.data.profile.id, fixture.user_ids.student1);
  assert.ok(exported.data.student_enrollments.every((row) => row.student_id === fixture.user_ids.student1));
  assert.ok(exported.data.support_messages.every((row) => row.visibility === 'public'));
  const completed = await service.from('privacy_requests').select('status,completed_at').eq('id', request.data.id).single();
  assert.ifError(completed.error);
  assert.equal(completed.data.status, 'completed');
  assert.ok(completed.data.completed_at);
  const audit = await service.from('audit_logs').select('action').eq('entity_id', request.data.id).eq('action', 'subject_export_delivered');
  assert.ifError(audit.error);
  assert.equal(audit.data.length, 1);
});
