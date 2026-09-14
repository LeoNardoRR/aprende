import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root } from './poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const isLocal = (target) => { try { return ['localhost', '127.0.0.1'].includes(new URL(target).hostname); } catch { return false; } };
if (!isLocal(url) || !anon) throw new Error('poc:performance aceita somente Supabase local descartavel.');
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts/poc/seed-manifest.json'), 'utf8'));
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email: manifest.users.admin, password });
if (signedIn.error) throw signedIn.error;
const samples = [];
for (let index = 0; index < 12; index += 1) {
  const started = performance.now();
  const result = await client.rpc('get_analytics_dashboard', { filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id, page: 1, page_size: 50 } });
  if (result.error) throw result.error;
  samples.push(performance.now() - started);
}
const sorted = samples.slice().sort((left, right) => left - right);
const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
const scenarios = [{ name: 'POC dashboard - 33 escolas cadastradas, 3 ativas na demonstracao, 12 tentativas', observations: samples.length, p50_ms: Number(percentile(0.5).toFixed(1)), p95_ms: Number(percentile(0.95).toFixed(1)), max_ms: Number(sorted.at(-1).toFixed(1)) }];
const regressionLog = process.argv[2];
if (regressionLog) {
  const log = await readFile(regressionLog, 'utf8');
  const match = log.match(/12,849-attempt aggregation: ([\d.]+) ms/);
  if (match) scenarios.push({ name: 'Agregacao analitica de 12.849 tentativas', observations: 1, p50_ms: Number(match[1]), p95_ms: Number(match[1]), max_ms: Number(match[1]), note: 'Uma amostra de escala; nao representa 12.849 logins concorrentes.' });
}
const payload = { generated_at: new Date().toISOString(), environment: 'Supabase local descartavel no runner', scope: { registered_schools: 33, demonstration_schools: 3, unique_students: 12, attempts: 12, reference_attempt_volume: 12849 }, scenarios, warnings: ['O volume de 12.849 mede tentativas/agregacao, nao identidades ou logins concorrentes.'] };
await mkdir(path.join(root, 'artifacts/poc'), { recursive: true });
await writeFile(path.join(root, 'artifacts/poc/performance-summary.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(scenarios.map((item) => `${item.name}: p50 ${item.p50_ms} ms; p95 ${item.p95_ms} ms; max ${item.max_ms} ms`).join('\n'));
