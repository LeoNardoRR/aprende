import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('seed POC recusa remoto, usa identidades sinteticas e nao imprime senha', async () => {
  const source = await readFile(new URL('../../scripts/seed-poc.mjs', import.meta.url), 'utf8');
  assert.match(source, /localhost/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /@poc\.aprende\.invalid/);
  assert.match(source, /synthetic_poc/);
  assert.match(source, /Senha nao exibida/);
  assert.doesNotMatch(source, /console\.log\([^)]*password/);
});
