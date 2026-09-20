import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('phase readiness does not claim mobile or skipped integrations', async () => {
  const text = await readFile(new URL('../../../docs/phase8-desktop-readiness.md', import.meta.url), 'utf8');
  assert.match(text, /Mobile, Android e iOS permanecem fora do escopo e não atendidos/);
  assert.match(text, /não foram contadas como executadas/);
});
