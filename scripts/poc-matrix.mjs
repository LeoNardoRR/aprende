import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const matrixPath = path.join(root, 'docs/poc/matriz-conformidade.json');
export const statuses = new Set(['ATENDIDO', 'PARCIAL', 'NAO_ATENDIDO', 'NAO_APLICAVEL', 'DEPENDENCIA_EXTERNA']);
export const severities = new Set(['P0', 'P1', 'P2', 'P3']);

export async function loadMatrix() {
  return JSON.parse(await readFile(matrixPath, 'utf8'));
}

export async function validateMatrix(matrix) {
  const errors = [];
  if (!matrix?.metadata || !Array.isArray(matrix?.requirements)) errors.push('Estrutura raiz invalida.');
  const ids = new Set();
  for (const [index, requirement] of (matrix.requirements ?? []).entries()) {
    const label = requirement.id || `indice ${index}`;
    for (const field of ['id', 'category', 'description', 'edital_reference', 'phase', 'status', 'route', 'gap', 'severity', 'observations']) {
      if (typeof requirement[field] !== 'string') errors.push(`${label}: campo ${field} ausente ou invalido.`);
    }
    for (const field of ['implementation', 'required_profile', 'required_data', 'test', 'evidence']) {
      if (!Array.isArray(requirement[field])) errors.push(`${label}: campo ${field} deve ser uma lista.`);
    }
    if (ids.has(label)) errors.push(`${label}: ID duplicado.`);
    ids.add(label);
    if (!statuses.has(requirement.status)) errors.push(`${label}: status invalido.`);
    if (!severities.has(requirement.severity)) errors.push(`${label}: severidade invalida.`);
    if (requirement.status === 'ATENDIDO') {
      if (!requirement.implementation?.length) errors.push(`${label}: ATENDIDO sem implementacao.`);
      if (!requirement.test?.length) errors.push(`${label}: ATENDIDO sem teste.`);
      if (!requirement.evidence?.length) errors.push(`${label}: ATENDIDO sem evidencia.`);
      if (requirement.gap) errors.push(`${label}: ATENDIDO nao pode declarar gap.`);
    }
    for (const relative of [...(requirement.implementation ?? []), ...(requirement.test ?? []), ...(requirement.evidence ?? [])]) {
      try { await readFile(path.join(root, relative)); } catch { errors.push(`${label}: caminho de evidencia inexistente: ${relative}.`); }
    }
  }
  return errors;
}

export function summarize(matrix) {
  const counts = Object.fromEntries([...statuses].map((status) => [status, 0]));
  const severity = Object.fromEntries([...severities].map((level) => [level, 0]));
  for (const requirement of matrix.requirements) {
    counts[requirement.status] += 1;
    if (requirement.status !== 'ATENDIDO') severity[requirement.severity] += 1;
  }
  const denominator = counts.ATENDIDO + counts.PARCIAL + counts.NAO_ATENDIDO;
  const conformity = denominator ? ((counts.ATENDIDO + counts.PARCIAL * 0.5) / denominator) * 100 : 0;
  return { total: matrix.requirements.length, counts, severity, conformity: Number(conformity.toFixed(1)) };
}
