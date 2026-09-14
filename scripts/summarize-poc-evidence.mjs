import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './poc-matrix.mjs';

const readText = async (file) => {
  try { return await readFile(file, 'utf8'); } catch { return ''; }
};

const lastNumber = (text, label) => {
  const matches = [...text.matchAll(new RegExp(`(?:^|\\n)[^\\n]*\\b${label}\\s+(\\d+)\\s*(?:\\n|$)`, 'gi'))];
  return matches.length ? Number(matches.at(-1)[1]) : 0;
};

const nodeSummary = (text) => ({
  total: lastNumber(text, 'tests'),
  pass: lastNumber(text, 'pass'),
  fail: lastNumber(text, 'fail'),
  skip: lastNumber(text, 'skipped'),
});

const playwrightSummary = (text) => {
  const count = (label) => {
    const matches = [...text.matchAll(new RegExp(`(\\d+)\\s+${label}`, 'gi'))];
    return matches.length ? Number(matches.at(-1)[1]) : 0;
  };
  const pass = count('passed');
  const fail = count('failed');
  const skip = count('skipped');
  return { total: pass + fail + skip, pass, fail, skip };
};

const regression = nodeSummary(await readText('/tmp/poc-regression.log'));
const poc = nodeSummary(await readText('/tmp/poc-tests.log'));
const e2e = playwrightSummary(await readText('/tmp/poc-e2e.log'));
const groups = { regression, poc, e2e };
const tests = {
  total: Object.values(groups).reduce((sum, group) => sum + group.total, 0),
  pass: Object.values(groups).reduce((sum, group) => sum + group.pass, 0),
  fail: Object.values(groups).reduce((sum, group) => sum + group.fail, 0),
  skip: Object.values(groups).reduce((sum, group) => sum + group.skip, 0),
  state: 'executed',
  groups,
};

let advisorFindings = [];
try {
  const raw = await readFile(path.join(root, 'artifacts/poc/supabase-advisors.json'), 'utf8');
  const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
  advisorFindings = Array.isArray(parsed) ? parsed : [];
} catch {
  throw new Error('O resultado JSON dos database advisors nao foi encontrado ou e invalido.');
}

// Supabase emite ERROR, WARN e INFO. A matriz da PoC mapeia ERROR para HIGH,
// WARN para MEDIUM e preserva INFO; CRITICAL exige uma revisao humana adicional.
const security = {
  critical: 0,
  high: advisorFindings.filter((finding) => finding.level === 'ERROR').length,
  medium: advisorFindings.filter((finding) => finding.level === 'WARN').length,
  low: 0,
  info: advisorFindings.filter((finding) => finding.level === 'INFO').length,
  state: 'reviewed',
  source: 'supabase_db_advisors_local',
  severity_mapping: { ERROR: 'HIGH', WARN: 'MEDIUM', INFO: 'INFO' },
  findings: advisorFindings.map(({ name, title, level, detail, categories }) => ({ name, title, level, detail, categories })),
};

const output = path.join(root, 'artifacts/poc');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'test-summary.json'), `${JSON.stringify(tests, null, 2)}\n`);
await writeFile(path.join(output, 'security-summary.json'), `${JSON.stringify(security, null, 2)}\n`);
console.log(`Evidencias resumidas: ${tests.pass}/${tests.total} testes passaram; advisors ${security.high} HIGH, ${security.medium} MEDIUM e ${security.info} INFO.`);
