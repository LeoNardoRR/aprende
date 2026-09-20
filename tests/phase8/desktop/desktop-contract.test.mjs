import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('desktop tokens define target shell, focus and reduced motion', async () => {
  const css = await read('app/design-tokens.css');
  assert.match(css, /--aprende-sidebar-width/);
  assert.match(css, /--aprende-content-max/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test('inventory records desktop targets and keeps mobile outside scope', async () => {
  const inventory = await read('docs/design/screen-inventory.md');
  for (const width of ['1024', '1280', '1366', '1440', '1600', '1920']) {
    assert.match(inventory, new RegExp(width));
  }
  assert.match(inventory, /Mobile permanece fora do escopo/);
});
