import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../../supabase/migrations/20260920234232_add_phase8_operational_domains.sql', import.meta.url);

test('phase 8 operational tables use RLS and explicit grants', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const tables = [
    'legal_documents', 'legal_acceptances', 'privacy_requests',
    'support_departments', 'support_tickets', 'support_messages',
    'support_ticket_history', 'offline_response_imports',
    'offline_response_import_rows',
  ];
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /revoke all on public\.legal_documents[\s\S]+from anon, authenticated/i);
  assert.doesNotMatch(sql, /auth\.role\(\)/i);
});

test('help desk keeps internal notes behind agent authorization', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /visibility in \('public', 'internal'\)/);
  assert.match(sql, /support_messages\.visibility = 'public' or private\.has_permission\('support\.agent'/);
  assert.match(sql, /support_ticket_audit/);
});

test('offline imports enforce content idempotency and indexed foreign keys', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /unique\(network_id, assessment_id, content_hash\)/);
  assert.match(sql, /offline_import_rows_import_idx/);
  assert.match(sql, /offline_import_rows_student_idx/);
  assert.match(sql, /offline_import_rows_item_idx/);
});
