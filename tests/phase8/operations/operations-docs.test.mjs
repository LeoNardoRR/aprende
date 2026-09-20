import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const required = ['deployment.md', 'rollback.md', 'backup-restore.md', 'incident-response.md', 'runbook.md'];

test('required operational runbooks exist', async () => {
  await Promise.all(required.map((name) => access(new URL(`../../../docs/operations/${name}`, import.meta.url))));
});

test('environment example warns against browser service-role exposure', async () => {
  const text = await readFile(new URL('../../../.env.example', import.meta.url), 'utf8');
  assert.match(text, /Never place service_role or secret keys here/);
});
