import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPedagogyReport } from '../../lib/pedagogy-report-export.ts';

const report = {
  generated_at: '2026-09-13T12:00:00Z',
  methodology: 'Evolução observada; não demonstra causalidade.',
  filters: { classroom_id: 'turma-demo' },
  summary: { students: 2, assignments: 2, in_progress: 1, completed: 1, average_progress: 75, pedagogical_score: 8, gamification_points: 25 },
  assignments: [{ assignment_id: 'a1', student_id: 's1', journey: '=HIPERLINK("https://invalid")', skill_code: 'EF05MA03', status: 'completed', progress_percentage: 100, pedagogical_score: 8, gamification_points: 15 }],
  skills: [{ skill_code: 'EF05MA03', skill_description: 'Resolver problemas', average_progress: 75, students: 2 }],
  evolution: [{ before_percentage: 50, after_percentage: 75, absolute_difference: 25, interpretation: 'Evolução observada; não demonstra causalidade.' }],
};

test('relatórios pedagógicos produzem PDF, DOCX e CSV reais a partir do mesmo payload', async () => {
  const pdf = new Uint8Array(await (await buildPedagogyReport(report, 'pdf')).arrayBuffer());
  const docx = new Uint8Array(await (await buildPedagogyReport(report, 'docx')).arrayBuffer());
  const csv = await (await buildPedagogyReport(report, 'csv')).text();
  assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF');
  assert.equal(docx[0], 0x50);
  assert.equal(docx[1], 0x4b);
  assert.match(csv, /EF05MA03/);
  assert.match(csv, /"'=HIPERLINK/);
});
