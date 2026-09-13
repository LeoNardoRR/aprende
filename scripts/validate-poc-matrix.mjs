import { loadMatrix, summarize, validateMatrix } from './poc-matrix.mjs';

const matrix = await loadMatrix();
const errors = await validateMatrix(matrix);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const summary = summarize(matrix);
  console.log(`Matriz valida: ${summary.total} requisitos; conformidade ponderada ${summary.conformity}%.`);
}
