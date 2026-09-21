import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

test('account privacy center uses the authenticated client and owner ids', async () => {
  const source = await readFile(
    new URL('components/privacy-center.tsx', root),
    'utf8',
  );
  assert.match(source, /role === 'student' \? studentSupabase : supabase/);
  assert.match(source, /\.eq\('requester_id', user\.id\)/);
  assert.match(source, /requester_id: userId/);
  assert.match(source, /from\('legal_acceptances'\)\.insert/);
  assert.match(source, /request_type: String\(values\.get\('request_type'\)\)/);
});

test('institutional privacy queue is gated to operational roles', async () => {
  const source = await readFile(
    new URL('components/institutional-operations.tsx', root),
    'utf8',
  );
  assert.match(source, /const canManage = canOperateSupport\(profile\.role\)/);
  assert.match(source, /\{canManage &&\s*\(/);
  assert.match(source, /id="privacy-requests"/);
  assert.match(source, /handled_by: profile\.id/);
  assert.match(source, /status === 'completed'/);
});
