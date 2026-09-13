import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProficiency, cronbachAlpha, descriptiveStatistics, difficultyIndex, discriminationIndex, evolution, pointBiserialCorrelation, validateProficiencyLevels } from '../lib/analytics-statistics.ts';
import { createAnalyticsReportBlob } from '../lib/analytics-report-export.ts';

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

const levels = [
  { code: 'below_basic', label: 'Abaixo do Básico', lowerBound: 0, upperBound: 25, order: 1 },
  { code: 'basic', label: 'Básico', lowerBound: 25, upperBound: 50, order: 2 },
  { code: 'adequate', label: 'Adequado', lowerBound: 50, upperBound: 75, order: 3 },
  { code: 'advanced', label: 'Avançado', lowerBound: 75, upperBound: 100, order: 4 },
];

test('descriptive statistics use population variance and ignore null/non-finite observations', () => {
  const result = descriptiveStatistics([1, 2, 3, 4, null, Number.NaN]);
  assert.deepEqual({ ...result, standardDeviation: undefined }, { observations: 4, mean: 2.5, median: 2.5, minimum: 1, maximum: 4, variance: 1.25, standardDeviation: undefined });
  close(result.standardDeviation, Math.sqrt(1.25));
  assert.equal(descriptiveStatistics([]).mean, null);
});

test('difficulty is the observed correct proportion and requires three valid responses', () => {
  close(difficultyIndex([true, true, false, false]), 0.5);
  assert.equal(difficultyIndex([true, false]), null);
  assert.equal(difficultyIndex([null, undefined, false]), null);
});

test('discrimination compares deterministic upper and lower 27 percent groups', () => {
  const rows = [10,20,30,40,50,60,70,80].map((totalScore, index) => ({ totalScore, correct: index >= 5 }));
  close(discriminationIndex(rows), 1);
  assert.equal(discriminationIndex(rows.slice(0, 3)), null);
});

test('point-biserial is Pearson correlation between binary item score and total score', () => {
  close(pointBiserialCorrelation([
    { correct: false, totalScore: 1 }, { correct: false, totalScore: 2 },
    { correct: true, totalScore: 3 }, { correct: true, totalScore: 4 },
  ]), 0.8944271909999159);
  assert.equal(pointBiserialCorrelation([{ correct: true, totalScore: 1 }, { correct: true, totalScore: 2 }, { correct: true, totalScore: 3 }]), null);
});

test('Cronbach alpha matches a manually verifiable population-variance dataset', () => {
  // Three item variances sum to 0.75; total-score variance is 1.25.
  // alpha = 3/2 * (1 - 0.75/1.25) = 0.6.
  close(cronbachAlpha([[1,1,1],[1,1,0],[0,0,0],[0,0,1]]), 0.6);
  assert.equal(cronbachAlpha([[1],[0],[1]]), null);
  assert.equal(cronbachAlpha([[1,1],[1,1],[1,1]]), null);
  assert.equal(cronbachAlpha([[1,1],[0,0]]), null);
});

test('versioned proficiency levels include 100 and reject overlap', () => {
  assert.equal(validateProficiencyLevels(levels), true);
  assert.equal(classifyProficiency(0, levels)?.code, 'below_basic');
  assert.equal(classifyProficiency(25, levels)?.code, 'basic');
  assert.equal(classifyProficiency(100, levels)?.code, 'advanced');
  assert.equal(classifyProficiency(null, levels), null);
  assert.equal(validateProficiencyLevels([...levels, { code: 'bad', label: 'Bad', lowerBound: 70, upperBound: 80, order: 5 }]), false);
});

test('evolution returns absolute and relative change only when mathematically valid', () => {
  assert.deepEqual(evolution(50, 65), { absolute: 15, percentage: 30 });
  assert.deepEqual(evolution(0, 20), { absolute: 20, percentage: null });
  assert.deepEqual(evolution(null, 20), { absolute: null, percentage: null });
});

test('PDF, DOCX and CSV exports are real files built from one analytical payload', async () => {
  const payload = { report_type: 'classroom', generated_at: '2026-09-13T12:00:00Z', filters: { classroom_id: 'demo' }, methodology_version: 'phase5-v1', provisional: false, data: { state: 'success', summary: { completed: 4, participation_percentage: 80 }, statistics: { mean: 62.5 }, proficiency: [{ label: 'Adequado', count: 2, percentage: 50 }], skills: [{ code: 'DEMO-H01', description: 'Habilidade determinística', percentage: 62.5, students_evaluated: 4 }], students: [], evolution: [] } };
  const [pdf,docx,csv] = await Promise.all(['pdf','docx','csv'].map((format) => createAnalyticsReportBlob(payload,format)));
  assert.equal(pdf.type,'application/pdf'); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  assert.equal(docx.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); assert.equal(Buffer.from(await docx.arrayBuffer()).subarray(0,2).toString(),'PK');
  assert.equal(csv.type,'text/csv;charset=utf-8'); assert.match(await csv.text(),/Participação \(%\).*80/);
});
