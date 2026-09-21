import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('help desk decision separates public comments from internal notes', async () => {
  const text = await readFile(new URL('../../../docs/operations/helpdesk-decision.md', import.meta.url), 'utf8');
  assert.match(text, /Comentário público e nota interna são entidades e permissões distintas/);
  assert.match(text, /testes negativos entre tenants/);
  assert.match(text, /testes conectados de isolamento existem/);
  assert.match(text, /não exibir um “SLA oficial”/);
});
