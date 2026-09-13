import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root } from './poc-matrix.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const isLocal = (target) => { try { return ['localhost', '127.0.0.1'].includes(new URL(target).hostname); } catch { return false; } };
if (!isLocal(url) || !anon) throw new Error('poc:smoke exige uma instancia Supabase local descartavel.');
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts/poc/seed-manifest.json'), 'utf8'));
if (!manifest.synthetic) throw new Error('Manifesto POC nao sintetico recusado.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const login = async (email) => { const client = createClient(url, anon, options); const result = await client.auth.signInWithPassword({ email, password }); if (result.error) throw result.error; return client; };
const ok = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };

const admin = await login(manifest.users.admin);
const networks = ok(await admin.from('networks').select('id').eq('id', manifest.network_id), 'rede POC');
if (networks.length !== 1) throw new Error('Rede POC ausente.');
const dashboard = ok(await admin.rpc('get_analytics_dashboard', { filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id } }), 'analytics');
if (Number(dashboard.summary?.attempts) < 1) throw new Error('Analytics sem tentativas.');
const report = ok(await admin.rpc('get_analytics_report_data', { report_type: 'network', filters: { network_id: manifest.network_id, assessment_id: manifest.assessment_id } }), 'relatorio');
if (!report?.summary) throw new Error('Relatorio sem resumo.');
const student = await login(manifest.users.student1);
const attempt = ok(await student.rpc('get_assessment_attempt', { target_attempt: manifest.attempt_id }), 'tentativa');
if (!attempt?.attempt?.id && !attempt?.id) throw new Error('Tentativa DEMO indisponivel ao aluno.');
console.log(`POC smoke verde: login, seed, tentativa, analytics e relatorio (${dashboard.summary.attempts} tentativas).`);
