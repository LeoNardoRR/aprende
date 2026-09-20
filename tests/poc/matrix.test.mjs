import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMatrix, summarize, validateMatrix } from '../../scripts/poc-matrix.mjs';

test('matriz PoC e completa, rastreavel e nao infla requisitos atendidos', async () => {
  const matrix = await loadMatrix();
  assert.deepEqual(await validateMatrix(matrix), []);
  const summary = summarize(matrix);
  assert.equal(summary.total, 21);
  assert.equal(summary.counts.ATENDIDO, 4);
  assert.equal(summary.counts.PARCIAL, 12);
  assert.equal(summary.counts.NAO_ATENDIDO, 2);
  assert.equal(summary.counts.DEPENDENCIA_EXTERNA, 3);
  assert.equal(summary.conformity, 55.6);
  for (const id of ['POC-1.10', 'POC-1.11', 'POC-1.12', 'POC-1.13']) {
    const requirement = matrix.requirements.find((item) => item.id === id);
    assert.equal(requirement.status, 'PARCIAL');
    assert.ok(requirement.implementation.length > 0);
    assert.ok(requirement.test.length > 0);
    assert.ok(requirement.gap.length > 0);
  }
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
