import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeAssessmentSave,
  answeredQuestionCount,
  createServerClock,
  enqueueAssessmentSave,
  formatAssessmentTime,
  normalizeAssessmentAnswer,
  overlayPendingResponses,
  parseAssessmentQueue,
  remainingServerSeconds,
  saveStateLabel,
} from '../lib/assessment-runtime.ts';

const pending = (overrides = {}) => ({
  idempotencyKey: 'key-1', attemptId: 'attempt-1', attemptItemId: 'item-1',
  answer: { option_id: 'A' }, markedForReview: false,
  queuedAt: '2026-09-13T10:00:00.000Z', expectedRevision: 0, ...overrides,
});

test('offline assessment queue is deterministic, compact and idempotent', () => {
  const first = enqueueAssessmentSave([], pending());
  assert.deepEqual(enqueueAssessmentSave(first, pending()), first);
  const replaced = enqueueAssessmentSave(first, pending({ idempotencyKey: 'key-2', answer: { option_id: 'B' }, queuedAt: '2026-09-13T10:00:01.000Z' }));
  assert.equal(replaced.length, 1); assert.equal(replaced[0].answer.option_id, 'B');
  const anotherItem = enqueueAssessmentSave(replaced, pending({ idempotencyKey: 'key-3', attemptItemId: 'item-2', queuedAt: '2026-09-13T10:00:02.000Z' }));
  assert.equal(anotherItem.length, 2);
  assert.deepEqual(acknowledgeAssessmentSave(anotherItem, 'key-2').map((entry) => entry.idempotencyKey), ['key-3']);
  assert.deepEqual(parseAssessmentQueue(JSON.stringify(anotherItem)), anotherItem);
  assert.deepEqual(parseAssessmentQueue('invalid'), []);
});

test('pending local answers overlay remote state without pretending they were saved', () => {
  const remote = { 'item-1': { answer: { option_id: 'A' }, marked_for_review: false, revision: 1 } };
  const merged = overlayPendingResponses(remote, [pending({ answer: { option_id: 'B' }, markedForReview: true })], 'attempt-1');
  assert.equal(merged['item-1'].answer.option_id, 'B');
  assert.equal(merged['item-1'].marked_for_review, true);
  assert.equal(remote['item-1'].answer.option_id, 'A');
  assert.equal(saveStateLabel('offline', 1), 'Sem conexão');
  assert.equal(saveStateLabel('sync_error', 1), 'Erro ao sincronizar');
  assert.equal(saveStateLabel('saved', 1), 'Pendente para sincronizar');
});

test('server clock ignores the workstation wall clock at synchronization', () => {
  const receivedAt = 10_000_000;
  const clock = createServerClock('2026-09-13T10:30:00.000Z', '2026-09-13T10:00:00.000Z', receivedAt);
  assert.equal(remainingServerSeconds(clock, receivedAt), 1800);
  assert.equal(remainingServerSeconds(clock, receivedAt + 10_000), 1790);
  assert.equal(formatAssessmentTime(1790), '29:50');
  assert.equal(formatAssessmentTime(3670), '01:01:10');
});

test('answers normalize by item type and progress counts only real answers', () => {
  assert.deepEqual(normalizeAssessmentAnswer('multiple_choice', 'option-a'), { option_id: 'option-a' });
  assert.deepEqual(normalizeAssessmentAnswer('essay', ' texto '), { text: ' texto ' });
  const responses = {
    a: { answer: { option_id: 'option-a' }, marked_for_review: false },
    b: { answer: { text: '   ' }, marked_for_review: true },
    c: { answer: { text: 'resposta' }, marked_for_review: false },
  };
  assert.equal(answeredQuestionCount(['a', 'b', 'c', 'd'], responses), 2);
});
