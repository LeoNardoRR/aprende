import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root } from './poc-matrix.mjs';

const apiUrl = process.env.SUPABASE_URL;
const dbUrl = process.env.DB_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const local = (value) => { try { return ['localhost','127.0.0.1'].includes(new URL(value ?? '').hostname); } catch { return false; } };
if (!local(apiUrl) || !local(dbUrl) || !anonKey) throw new Error('Benchmark permitido somente com Supabase local descartável.');

const reportPath = path.join(root, 'artifacts/poc/phase7-performance-report.json');
const explainPath = path.join(root, 'artifacts/poc/phase7-explain.txt');
const report = { generated_at: new Date().toISOString(), environment: 'Supabase local descartável no CI',
  dataset: { synthetic: true, students: 12849, schools: 33, catalog_journeys: 1500 },
  scenarios: [], explain_file: 'phase7-explain.txt', warnings: [], status: 'running' };
const save = async () => { await mkdir(path.dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); };

const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts/poc/seed-manifest.json'), 'utf8'));
assert.equal(manifest.synthetic, true);
assert.equal(manifest.scale_school_ids.length, 33);
const client = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const student = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const pct = (sorted, ratio) => Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)].toFixed(1));
async function measure(name, count, action) {
  const times = [];
  for (let index = 0; index < count; index += 1) {
    const start = performance.now();
    await action();
    times.push(performance.now() - start);
  }
  const sorted = times.sort((a,b) => a-b);
  report.scenarios.push({ name, observations: count, p50_ms: pct(sorted,.5), p95_ms: pct(sorted,.95), max_ms: pct(sorted,1) });
}
const checked = (result, name) => { if (result.error) throw new Error(`${name}: ${result.error.message}`); return result.data; };
const rpc = (who, name, args) => who.rpc(name, args).abortSignal(AbortSignal.timeout(30000));

try {
  const started = performance.now();
  const explain = execFileSync('psql', ['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-d',dbUrl,'-f',path.join(root,'scripts/phase7-scale-fixture.sql')], { encoding: 'utf8', maxBuffer: 10*1024*1024 });
  await writeFile(explainPath, explain);
  report.fixture_ms = Number((performance.now()-started).toFixed(1));
  report.query_execution_ms = [...explain.matchAll(/"Execution Time": ([\d.]+)/g)].map((match) => Number(match[1]));
  assert.equal(report.query_execution_ms.length, 2, 'EXPLAIN ANALYZE deve medir as duas consultas críticas');
  checked(await client.auth.signInWithPassword({ email: manifest.users.admin, password }), 'login admin');
  checked(await student.auth.signInWithPassword({ email: manifest.users.student1, password }), 'login aluno');

  const filters = { query: 'Jornada catálogo escala DEMO' };
  const seen = new Set();
  let sampledPage = 0;
  await measure('catálogo: primeira/intermediária/última página', 3, async () => {
    const page = [1,32,63][sampledPage++];
    const data = checked(await rpc(client,'search_pedagogical_catalog',{ target_network: manifest.network_id, filters, page, page_size: 24 }), 'catálogo');
    assert.equal(Number(data.total),1500);
  });
  for (let page=1;page<=63;page++) {
    const data = checked(await rpc(client,'search_pedagogical_catalog',{ target_network: manifest.network_id, filters, page, page_size: 24 }), `catálogo página ${page}`);
    for (const journey of data.journeys) {
      assert.equal(seen.has(journey.id),false,`duplicado na página ${page}`);
      seen.add(journey.id);
    }
  }
  assert.equal(seen.size,1500,'catálogo sem itens perdidos');
  await measure('dashboard pedagógico da rede', 5, async () => {
    const data = checked(await rpc(client,'get_pedagogical_dashboard',{ filters: { network_id: manifest.network_id } }), 'dashboard');
    assert.ok(Number(data.summary.students)>=12849);
  });
  await measure('relatório institucional da rede', 5, async () => {
    const data = checked(await rpc(client,'get_pedagogical_report_data',{ filters: { network_id: manifest.network_id } }), 'relatório');
    assert.ok(Number(data.summary.students)>=12849);
  });
  await measure('portfólio do aluno sob carga', 5, async () => {
    const data = checked(await rpc(student,'get_student_pedagogical_portfolio',{ target_student: null }), 'portfólio');
    assert.equal(data.student_id,manifest.user_ids.student1);
  });
  await measure('contagem protegida de recomendações', 5, async () => {
    const result = await client.from('pedagogical_recommendations').select('id',{ count: 'exact', head: true }).eq('network_id',manifest.network_id);
    if (result.error) throw result.error;
    assert.ok(Number(result.count)>=12849);
  });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await save();
  console.log(`Fase 7 escala: ${report.status}; 12.849 estudantes, 33 escolas, 1.500 jornadas; relatório ${reportPath}`);
}
