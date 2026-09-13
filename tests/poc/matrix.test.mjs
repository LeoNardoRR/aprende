import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMatrix, summarize, validateMatrix } from '../../scripts/poc-matrix.mjs';

test('matriz PoC e completa, rastreavel e nao infla requisitos atendidos', async () => {
  const matrix = await loadMatrix();
  assert.deepEqual(await validateMatrix(matrix), []);
  const summary = summarize(matrix);
  assert.equal(summary.total, 21);
  assert.equal(summary.counts.ATENDIDO, 4);
  assert.equal(summary.counts.PARCIAL, 9);
  assert.equal(summary.counts.NAO_ATENDIDO, 5);
  assert.equal(summary.counts.DEPENDENCIA_EXTERNA, 3);
  assert.equal(summary.conformity, 47.2);
  assert.ok(summary.severity.P0 > 0, 'bloqueadores P0 devem permanecer explicitos');
});

test('fases futuras permanecem classificadas sem conformidade artificial', async () => {
  const { requirements } = await loadMatrix();
  const future = requirements.filter((requirement) => ['7', '8'].includes(requirement.phase));
  assert.ok(future.length >= 6);
  assert.ok(future.every((requirement) => requirement.status !== 'ATENDIDO'));
  assert.ok(future.some((requirement) => requirement.id === 'POC-1.10'));
  assert.ok(future.some((requirement) => requirement.id === 'POC-2.3'));
});
