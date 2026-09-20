import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('root layout declares Portuguese and global skip-link styles exist', async () => {
  const layout = await readFile(new URL('../../../app/layout.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../app/design-tokens.css', import.meta.url), 'utf8');
  assert.match(layout, /<html lang="pt-BR">/);
  assert.match(css, /\.skip-link/);
  assert.match(css, /outline:3px solid var\(--aprende-focus\)/);
});
