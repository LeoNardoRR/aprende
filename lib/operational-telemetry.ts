export type OperationalLevel = 'info' | 'warn' | 'error';
export type OperationalResult = 'success' | 'failure' | 'degraded';

export type OperationalEvent = {
  timestamp: string;
  level: OperationalLevel;
  environment: string;
  release: string;
  correlation_id: string;
  operation: string;
  result: OperationalResult;
  duration_ms: number;
  scope?: Record<string, string | number | boolean | null>;
  error_code?: string;
};

const forbiddenKey = /password|passwd|token|secret|authorization|cookie|answer|response|description|comment|note|email|name/i;

export function sanitizeOperationalScope(
  input: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!input) return undefined;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (forbiddenKey.test(key)) continue;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safe[key] = typeof value === 'string' ? value.slice(0, 120) : value;
    }
  }
  return Object.keys(safe).length ? safe : undefined;
}

export function createCorrelationId() {
  return globalThis.crypto?.randomUUID?.() ??
    `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createOperationalEvent(input: {
  operation: string;
  result: OperationalResult;
  durationMs: number;
  correlationId?: string;
  level?: OperationalLevel;
  scope?: Record<string, unknown>;
  errorCode?: string;
}): OperationalEvent {
  return {
    timestamp: new Date().toISOString(),
    level: input.level ?? (input.result === 'failure' ? 'error' : 'info'),
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'unknown',
    release: process.env.NEXT_PUBLIC_APP_RELEASE ?? process.env.APP_RELEASE ?? 'development',
    correlation_id: input.correlationId ?? createCorrelationId(),
    operation: input.operation,
    result: input.result,
    duration_ms: Math.max(0, Math.round(input.durationMs * 10) / 10),
    scope: sanitizeOperationalScope(input.scope),
    error_code: input.errorCode?.slice(0, 80),
  };
}

export type OperationalSink = (event: OperationalEvent) => void | Promise<void>;

export async function observeOperation<T>(
  operation: string,
  action: (correlationId: string) => Promise<T>,
  options: {
    correlationId?: string;
    scope?: Record<string, unknown>;
    sink?: OperationalSink;
  } = {},
): Promise<T> {
  const correlationId = options.correlationId ?? createCorrelationId();
  const started = performance.now();
  try {
    const value = await action(correlationId);
    await options.sink?.(
      createOperationalEvent({
        operation,
        result: 'success',
        durationMs: performance.now() - started,
        correlationId,
        scope: options.scope,
      }),
    );
    return value;
  } catch (error) {
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'unexpected_error';
    await options.sink?.(
      createOperationalEvent({
        operation,
        result: 'failure',
        durationMs: performance.now() - started,
        correlationId,
        scope: options.scope,
        errorCode,
      }),
    );
    throw error;
  }
}

export function latencyPercentiles(samples: number[]) {
  const sorted = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (ratio: number) =>
    sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
      : null;
  return {
    count: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    worst: percentile(1),
  };
}

export type HealthProbe = {
  name: 'auth' | 'data_api' | 'postgres' | 'storage' | 'edge_functions' | 'jobs';
  run: () => Promise<void>;
};

export async function runHealthChecks(probes: HealthProbe[]) {
  const results = await Promise.all(
    probes.map(async (probe) => {
      const started = performance.now();
      try {
        await probe.run();
        return { name: probe.name, status: 'healthy' as const, duration_ms: Math.round((performance.now() - started) * 10) / 10 };
      } catch {
        return { name: probe.name, status: 'unhealthy' as const, duration_ms: Math.round((performance.now() - started) * 10) / 10 };
      }
    }),
  );
  return {
    status: results.every((item) => item.status === 'healthy') ? 'healthy' as const : 'degraded' as const,
    checked_at: new Date().toISOString(),
    results,
  };
}
