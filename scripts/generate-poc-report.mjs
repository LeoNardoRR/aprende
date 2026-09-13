import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadMatrix, root, summarize, validateMatrix } from './poc-matrix.mjs';

const matrix = await loadMatrix();
const errors = await validateMatrix(matrix);
if (errors.length) throw new Error(errors.join('\n'));
const summary = summarize(matrix);
const readOptional = async (name, fallback) => {
  try { return JSON.parse(await readFile(path.join(root, 'artifacts/poc', name), 'utf8')); } catch { return fallback; }
};
const tests = await readOptional('test-summary.json', { total: null, pass: null, fail: null, skip: null, state: 'not_run' });
const performance = await readOptional('performance-summary.json', { scenarios: [], warnings: ['Medição da Fase 6 ainda não executada.'] });
const security = await readOptional('security-summary.json', { critical: null, high: null, medium: null, low: null, info: null, state: 'not_run' });
const report = {
  generated_at: new Date().toISOString(),
  base: matrix.metadata,
  requirements: summary,
  tests,
  performance,
  security,
  gaps: summary.severity,
  ready_for_poc: summary.severity.P0 === 0,
};
const output = path.join(root, 'artifacts/poc');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'poc-validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = `# Relatorio de validacao da PoC\n\nGerado em ${report.generated_at}.\n\n## Requisitos\n\n- Total: ${summary.total}\n- Atendidos: ${summary.counts.ATENDIDO}\n- Parciais: ${summary.counts.PARCIAL}\n- Nao atendidos: ${summary.counts.NAO_ATENDIDO}\n- Nao aplicaveis: ${summary.counts.NAO_APLICAVEL}\n- Dependencias externas: ${summary.counts.DEPENDENCIA_EXTERNA}\n- Conformidade ponderada: ${summary.conformity}%\n\n## Testes\n\n- Estado: ${tests.state ?? 'executado'}\n- Total: ${tests.total ?? 'nao medido'}\n- Pass: ${tests.pass ?? 'nao medido'}\n- Fail: ${tests.fail ?? 'nao medido'}\n- Skip: ${tests.skip ?? 'nao medido'}\n\n## Performance\n\n${performance.scenarios?.length ? performance.scenarios.map((item) => `- ${item.name}: p50 ${item.p50_ms} ms; p95 ${item.p95_ms} ms; max ${item.max_ms} ms.`).join('\n') : '- Medicao da Fase 6 ainda nao executada.'}\n\n## Seguranca\n\n- Critical: ${security.critical ?? 'nao medido'}\n- High: ${security.high ?? 'nao medido'}\n- Medium: ${security.medium ?? 'nao medido'}\n- Low: ${security.low ?? 'nao medido'}\n- Info: ${security.info ?? 'nao medido'}\n\n## Gaps\n\n- P0: ${summary.severity.P0}\n- P1: ${summary.severity.P1}\n- P2: ${summary.severity.P2}\n- P3: ${summary.severity.P3}\n\n## Pronto para PoC\n\n${report.ready_for_poc ? 'SIM' : 'NAO'}\n`;
await writeFile(path.join(output, 'poc-validation-report.md'), markdown);
console.log(`Relatorio gerado em ${path.relative(root, output)}; pronto para PoC: ${report.ready_for_poc ? 'SIM' : 'NAO'}.`);
