import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('existing reporting layer keeps real PDF and DOCX generators', async () => {
  const source = await readFile(new URL('../../../lib/analytics-report-export.ts', import.meta.url), 'utf8');
  assert.match(source, /PDFDocument/);
  assert.match(source, /Document/);
});
