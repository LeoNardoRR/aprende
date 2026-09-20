import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationalEvent,
  latencyPercentiles,
  observeOperation,
  runHealthChecks,
  sanitizeOperationalScope,
} from '../../../lib/operational-telemetry.ts';

test('structured telemetry removes secrets, PII and free-text content', () => {
  const scope = sanitizeOperationalScope({
    network_id: 'network-demo',
    rows: 42,
    token: 'never-log',
    password: 'never-log',
    email: 'student@example.test',
    answer: 'sensitive',
    ticket_description: 'sensitive',
  });
  assert.deepEqual(scope, { network_id: 'network-demo', rows: 42 });
  const event = createOperationalEvent({ operation: 'report.generate', result: 'success', durationMs: 12.34, scope });
  assert.equal(event.duration_ms, 12.3);
  assert.match(event.correlation_id, /.+/);
});

test('operation observer records sanitized success and failure without swallowing errors', async () => {
  const events = [];
  assert.equal(await observeOperation('ok', async () => 7, { sink: (event) => events.push(event) }), 7);
  await assert.rejects(
    observeOperation('fail', async () => { throw Object.assign(new Error('private detail'), { code: 'TIMEOUT' }); }, { sink: (event) => events.push(event) }),
  );
  assert.deepEqual(events.map((event) => [event.operation, event.result, event.error_code]), [
    ['ok', 'success', undefined],
    ['fail', 'failure', 'TIMEOUT'],
  ]);
});

test('health and latency metrics report degraded probes and exact percentiles', async () => {
  const health = await runHealthChecks([
    { name: 'auth', run: async () => {} },
    { name: 'storage', run: async () => { throw new Error('offline'); } },
  ]);
  assert.equal(health.status, 'degraded');
  assert.deepEqual(health.results.map((item) => item.status), ['healthy', 'unhealthy']);
  assert.deepEqual(latencyPercentiles([1, 2, 3, 4, 100]), { count: 5, p50: 3, p95: 100, p99: 100, worst: 100 });
});
