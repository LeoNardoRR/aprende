import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('privacy operation preserves academic retention and audit stages', async () => {
  const text = await readFile(new URL('../../../docs/privacy/lgpd-operational.md', import.meta.url), 'utf8');
  for (const stage of ['Request', 'Validation', 'Authorization', 'Execution', 'Audit']) assert.match(text, new RegExp(stage));
  assert.match(text, /não como autorização para eliminar automaticamente registros acadêmicos/i);
});

test('retention periods are not invented', async () => {
  const text = await readFile(new URL('../../../docs/privacy/data-retention.md', import.meta.url), 'utf8');
  assert.match(text, /A DEFINIR/);
});
