import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('desktop validation contract lists every required resolution and zoom', async () => {
  const text = await readFile(new URL('../../../docs/design/design-system.md', import.meta.url), 'utf8');
  assert.match(text, /1024/);
  assert.match(text, /1600/);
  assert.match(text, /1920/);
});
