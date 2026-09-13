import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAssessmentQueue,
  legacyAssessmentQueueKey,
  loadPendingAssessmentSaves,
  migrateLegacyAssessmentQueue,
  removePendingAssessmentSave,
  replacePendingAssessmentSave,
} from '../lib/assessment-offline-queue.ts';

const entry = (overrides = {}) => ({
  idempotencyKey: 'offline-key-1',
  attemptId: 'offline-attempt-1',
  attemptItemId: 'offline-item-1',
  answer: { option_id: 'A' },
  markedForReview: false,
  queuedAt: '2026-09-13T12:00:00.000Z',
  expectedRevision: 0,
  ...overrides,
});

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
}

test('legacy localStorage queue migrates once and is removed only after durable persistence', async () => {
  const attemptId = 'legacy-attempt';
  const oldEntry = { ...entry({ attemptId }), expectedRevision: undefined };
  delete oldEntry.expectedRevision;
  const key = legacyAssessmentQueueKey(attemptId);
  const storage = fakeStorage({ [key]: JSON.stringify([oldEntry]) });
  const persisted = [];
  const migrated = await migrateLegacyAssessmentQueue(attemptId, storage, async (pending) => {
    persisted.push(pending);
    return 'indexeddb';
  });
  assert.equal(migrated, 1);
  assert.equal(persisted[0].expectedRevision, 0);
  assert.equal(storage.has(key), false);

  storage.setItem(key, JSON.stringify([oldEntry]));
  await migrateLegacyAssessmentQueue(attemptId, storage, async () => 'memory');
  assert.equal(storage.has(key), true);
});

test('controlled fallback keeps only the latest pending answer and supports acknowledgement', async () => {
  const attemptId = 'memory-attempt';
  await clearAssessmentQueue(attemptId);
  assert.equal(await replacePendingAssessmentSave(entry({ attemptId })), 'memory');
  await replacePendingAssessmentSave(entry({
    attemptId,
    idempotencyKey: 'offline-key-2',
    answer: { option_id: 'B' },
    queuedAt: '2026-09-13T12:00:01.000Z',
  }));
  const loaded = await loadPendingAssessmentSaves(attemptId);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].answer.option_id, 'B');
  await removePendingAssessmentSave(attemptId, loaded[0].idempotencyKey);
  assert.deepEqual(await loadPendingAssessmentSaves(attemptId), []);
});
