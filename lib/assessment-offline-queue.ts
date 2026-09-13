import {
  enqueueAssessmentSave,
  parseAssessmentQueue,
  type PendingAssessmentSave,
} from './assessment-runtime.ts';

const DATABASE_NAME = 'aprende-assessment-runtime';
const DATABASE_VERSION = 1;
const STORE_NAME = 'pending-saves';
const ATTEMPT_INDEX = 'attempt-id';
const ATTEMPT_ITEM_INDEX = 'attempt-item';
const FALLBACK_PREFIX = 'aprende-assessment-queue-fallback:';
export const legacyAssessmentQueueKey = (attemptId: string) => `aprende-assessment-queue:${attemptId}`;

type DurableTarget = 'indexeddb' | 'localstorage' | 'memory';
const memoryFallback = new Map<string, PendingAssessmentSave[]>();

function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

function openQueueDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      store.createIndex(ATTEMPT_INDEX, 'attemptId', { unique: false });
      store.createIndex(ATTEMPT_ITEM_INDEX, ['attemptId', 'attemptItemId'], { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function loadIndexed(attemptId: string): Promise<PendingAssessmentSave[]> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const entries = await requestResult(transaction.objectStore(STORE_NAME).index(ATTEMPT_INDEX).getAll(attemptId));
    await transactionDone(transaction);
    return parseAssessmentQueue(JSON.stringify(entries));
  } finally { database.close(); }
}

async function putIndexed(entry: PendingAssessmentSave): Promise<void> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const oldEntries = await requestResult(store.index(ATTEMPT_ITEM_INDEX).getAll(IDBKeyRange.only([entry.attemptId, entry.attemptItemId])));
    for (const oldEntry of oldEntries as PendingAssessmentSave[]) {
      if (oldEntry.idempotencyKey !== entry.idempotencyKey) store.delete(oldEntry.idempotencyKey);
    }
    store.put(entry);
    await transactionDone(transaction);
  } finally { database.close(); }
}

async function removeIndexed(attemptId: string, idempotencyKey: string): Promise<void> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const entry = await requestResult(store.get(idempotencyKey)) as PendingAssessmentSave | undefined;
    if (entry?.attemptId === attemptId) store.delete(idempotencyKey);
    await transactionDone(transaction);
  } finally { database.close(); }
}

async function clearIndexed(attemptId: string): Promise<void> {
  const entries = await loadIndexed(attemptId);
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const entry of entries) store.delete(entry.idempotencyKey);
    await transactionDone(transaction);
  } finally { database.close(); }
}

function fallbackKey(attemptId: string) { return `${FALLBACK_PREFIX}${attemptId}`; }

function loadFallback(attemptId: string, storage = browserStorage()): PendingAssessmentSave[] {
  if (storage) {
    try { return parseAssessmentQueue(storage.getItem(fallbackKey(attemptId))); }
    catch { /* Use the in-memory fallback below. */ }
  }
  return memoryFallback.get(attemptId) ?? [];
}

function saveFallback(entry: PendingAssessmentSave, storage = browserStorage()): DurableTarget {
  const next = enqueueAssessmentSave(loadFallback(entry.attemptId, storage), entry);
  memoryFallback.set(entry.attemptId, next);
  if (storage) {
    try { storage.setItem(fallbackKey(entry.attemptId), JSON.stringify(next)); return 'localstorage'; }
    catch { /* The current session still retains the entry in memory. */ }
  }
  return 'memory';
}

function removeFallback(attemptId: string, idempotencyKey: string, storage = browserStorage()) {
  const next = loadFallback(attemptId, storage).filter((entry) => entry.idempotencyKey !== idempotencyKey);
  memoryFallback.set(attemptId, next);
  if (!storage) return;
  try {
    if (next.length) storage.setItem(fallbackKey(attemptId), JSON.stringify(next));
    else storage.removeItem(fallbackKey(attemptId));
  } catch { /* The in-memory copy remains accurate for this session. */ }
}

export async function loadPendingAssessmentSaves(attemptId: string): Promise<PendingAssessmentSave[]> {
  try {
    let entries = await loadIndexed(attemptId);
    const fallback = loadFallback(attemptId);
    for (const pending of fallback) {
      entries = enqueueAssessmentSave(entries, pending);
      await putIndexed(pending);
    }
    if (fallback.length) {
      const storage = browserStorage();
      storage?.removeItem(fallbackKey(attemptId));
      memoryFallback.delete(attemptId);
    }
    return entries;
  } catch {
    return loadFallback(attemptId);
  }
}

export async function savePendingAssessmentSave(entry: PendingAssessmentSave): Promise<DurableTarget> {
  try { await putIndexed(entry); return 'indexeddb'; }
  catch { return saveFallback(entry); }
}

export const replacePendingAssessmentSave = savePendingAssessmentSave;

export async function removePendingAssessmentSave(attemptId: string, idempotencyKey: string): Promise<void> {
  try { await removeIndexed(attemptId, idempotencyKey); }
  catch { /* Also remove the controlled fallback below. */ }
  removeFallback(attemptId, idempotencyKey);
}

export async function clearAssessmentQueue(attemptId: string): Promise<void> {
  try { await clearIndexed(attemptId); }
  catch { /* Also clear the controlled fallback below. */ }
  memoryFallback.delete(attemptId);
  try { browserStorage()?.removeItem(fallbackKey(attemptId)); }
  catch { /* Nothing else can be cleared. */ }
}

export async function migrateLegacyAssessmentQueue(
  attemptId: string,
  storage = browserStorage(),
  persist: (entry: PendingAssessmentSave) => Promise<DurableTarget> = savePendingAssessmentSave,
): Promise<number> {
  if (!storage) return 0;
  const key = legacyAssessmentQueueKey(attemptId);
  const entries = parseAssessmentQueue(storage.getItem(key)).filter((entry) => entry.attemptId === attemptId);
  if (!entries.length) return 0;
  const targets = await Promise.all(entries.map(persist));
  if (targets.every((target) => target !== 'memory')) storage.removeItem(key);
  return entries.length;
}
