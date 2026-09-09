import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateConnectedMetrics, canEditSubmission, friendlySupabaseError, isValidClassCode, normalizeClassCode } from '../lib/connected-flow.ts';

test('class code is normalized and validated before joining', () => {
  assert.equal(normalizeClassCode(' ab-12 cd34! '), 'AB12CD34');
  assert.equal(isValidClassCode('ab12cd34'), true);
  assert.equal(isValidClassCode('AB12'), false);
});

test('connected points use teacher scores and assignment totals', () => {
  const metrics = calculateConnectedMetrics(
    [{ id: 'a', points: 10 }, { id: 'b', points: 20 }],
    [{ assignment_id: 'a', status: 'submitted', score: 8 }, { assignment_id: 'b', status: 'draft', score: null }],
  );
  assert.deepEqual(metrics, { possible: 30, earned: 8, delivered: 1, total: 2 });
});

test('graded submissions are locked and common backend errors are translated', () => {
  assert.equal(canEditSubmission(), true);
  assert.equal(canEditSubmission({ score: null }), true);
  assert.equal(canEditSubmission({ score: 7 }), false);
  assert.equal(friendlySupabaseError('Invalid login credentials'), 'E-mail ou senha incorretos.');
  assert.equal(friendlySupabaseError('Invalid class code'), 'Código de turma inválido. Confira os 8 caracteres.');
});
