import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../../scripts/poc-matrix.mjs';

test('exclusão vira solicitação idempotente e a função legada não apaga a conta', async (t) => {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Exige Supabase local descartável.');
    return;
  }
  const fixture = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
  assert.equal(fixture.synthetic, true);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({
    email: fixture.users.student1,
    password: process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026',
  });
  assert.ifError(signed.error);
  const denied = await client.rpc('delete_my_account', { confirmation: 'EXCLUIR' });
  assert.ok(denied.error);
  const first = await client.rpc('request_my_account_deletion', { confirmation: 'EXCLUIR' });
  assert.ifError(first.error);
  const again = await client.rpc('request_my_account_deletion', { confirmation: 'EXCLUIR' });
  assert.ifError(again.error);
  assert.equal(again.data, first.data);
  const request = await client.from('privacy_requests').select('*').eq('id', first.data).single();
  assert.ifError(request.error);
  assert.equal(request.data.requester_id, signed.data.user.id);
  assert.equal(request.data.request_type, 'deletion');
  assert.equal(request.data.status, 'requested');
  assert.ok(request.data.network_id);
  assert.ifError((await client.auth.getUser()).error);
});
