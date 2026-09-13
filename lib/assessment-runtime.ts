export type AssessmentItemType = 'multiple_choice' | 'true_false' | 'essay';
export type AssessmentAnswer = { option_id?: string; text?: string };
export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'pending' | 'sync_error';

export type PendingAssessmentSave = {
  idempotencyKey: string;
  attemptId: string;
  attemptItemId: string;
  answer: AssessmentAnswer;
  markedForReview: boolean;
  queuedAt: string;
  expectedRevision: number;
};

export type RuntimeResponse = {
  answer: AssessmentAnswer;
  marked_for_review: boolean;
  revision?: number;
  saved_at?: string;
  points_awarded?: number | null;
  reviewer_comment?: string | null;
};

export type RuntimeResponses = Record<string, RuntimeResponse>;

export type ServerClock = {
  deadlineMs: number;
  serverNowMs: number;
  receivedAtMs: number;
};

export function normalizeAssessmentAnswer(
  itemType: AssessmentItemType,
  input: unknown,
): AssessmentAnswer {
  if (itemType === 'essay') {
    const text = typeof input === 'string' ? input : '';
    return { text: text.slice(0, 20_000) };
  }
  return { option_id: typeof input === 'string' ? input : '' };
}

export function enqueueAssessmentSave(
  queue: PendingAssessmentSave[],
  entry: PendingAssessmentSave,
): PendingAssessmentSave[] {
  const withoutSuperseded = queue.filter(
    (queued) =>
      queued.idempotencyKey === entry.idempotencyKey ||
      queued.attemptId !== entry.attemptId ||
      queued.attemptItemId !== entry.attemptItemId,
  );
  if (withoutSuperseded.some((queued) => queued.idempotencyKey === entry.idempotencyKey)) {
    return withoutSuperseded;
  }
  return [...withoutSuperseded, entry].sort((left, right) =>
    left.queuedAt.localeCompare(right.queuedAt),
  );
}

export function acknowledgeAssessmentSave(
  queue: PendingAssessmentSave[],
  idempotencyKey: string,
): PendingAssessmentSave[] {
  return queue.filter((entry) => entry.idempotencyKey !== idempotencyKey);
}

export function parseAssessmentQueue(raw: string | null): PendingAssessmentSave[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (
        typeof entry?.idempotencyKey !== 'string' ||
        typeof entry?.attemptId !== 'string' ||
        typeof entry?.attemptItemId !== 'string' ||
        typeof entry?.answer !== 'object' ||
        typeof entry?.markedForReview !== 'boolean' ||
        typeof entry?.queuedAt !== 'string'
      ) return [];
      return [{
        ...entry,
        expectedRevision: Number.isInteger(entry.expectedRevision) && entry.expectedRevision >= 0
          ? entry.expectedRevision
          : 0,
      } as PendingAssessmentSave];
    });
  } catch {
    return [];
  }
}

export function overlayPendingResponses(
  remote: RuntimeResponses,
  queue: PendingAssessmentSave[],
  attemptId: string,
): RuntimeResponses {
  const merged = structuredClone(remote);
  for (const pending of queue) {
    if (pending.attemptId !== attemptId) continue;
    merged[pending.attemptItemId] = {
      ...merged[pending.attemptItemId],
      answer: pending.answer,
      marked_for_review: pending.markedForReview,
    };
  }
  return merged;
}

export function createServerClock(
  deadline: string,
  serverNow: string,
  receivedAtMs = Date.now(),
): ServerClock {
  return {
    deadlineMs: new Date(deadline).getTime(),
    serverNowMs: new Date(serverNow).getTime(),
    receivedAtMs,
  };
}

export function remainingServerSeconds(clock: ServerClock, clientNowMs = Date.now()): number {
  const elapsedSinceSync = Math.max(0, clientNowMs - clock.receivedAtMs);
  return Math.max(0, Math.ceil((clock.deadlineMs - clock.serverNowMs - elapsedSinceSync) / 1000));
}

export function answeredQuestionCount(
  itemIds: string[],
  responses: RuntimeResponses,
): number {
  return itemIds.filter((itemId) => {
    const answer = responses[itemId]?.answer;
    return Boolean(answer?.option_id || answer?.text?.trim());
  }).length;
}

export function formatAssessmentTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function saveStateLabel(state: SaveState, queuedCount: number): string {
  if (state === 'saving') return 'Salvando...';
  if (state === 'offline') return 'Sem conexão';
  if (state === 'sync_error') return 'Erro ao sincronizar';
  if (state === 'pending' || queuedCount > 0) return 'Pendente para sincronizar';
  if (state === 'saved') return 'Salvo';
  return 'Pronto para responder';
}
