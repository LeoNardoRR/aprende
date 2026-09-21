import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {
  commitOfflineResponseImport,
  createOfflineImportPreview,
  createOfflineImportStore,
  parseOfflineResponseFile,
  setOfflineImportDecision,
} from '../../../lib/offline-response-import.ts';

const catalog = {
  assessmentId: 'assessment-1',
  studentIds: ['student-1', 'student-2'],
  questions: [
    {
      id: 'question-1',
      type: 'multiple_choice',
      optionIds: ['option-a', 'option-b'],
      optionLabels: ['A', 'B'],
    },
    { id: 'question-2', type: 'essay' },
  ],
  existingResponses: [
    {
      assessmentId: 'assessment-1',
      studentId: 'student-1',
      questionId: 'question-1',
      answer: 'A',
    },
  ],
};

async function xlsxFixture(rows) {
  const zip = new JSZip();
  const strings = [...new Set(rows.flat())];
  const stringIndex = new Map(strings.map((value, index) => [value, index]));
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    'xl/sharedStrings.xml',
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((value) => `<si><t>${value}</t></si>`).join('')}</sst>`,
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row
            .map(
              (value, columnIndex) =>
                `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="s"><v>${stringIndex.get(value)}</v></c>`,
            )
            .join('')}</row>`,
      )
      .join('')}</sheetData></worksheet>`,
  );
  return (await zip.generateAsync({ type: 'uint8array' })).buffer;
}

test('parses CSV and XLSX into the same normalized response rows', async () => {
  const csv =
    'avaliacao_id;aluno_id;questao_id;resposta\nassessment-1;student-1;question-1;A';
  const rows = [
    ['avaliação id', 'aluno id', 'questão id', 'resposta'],
    ['assessment-1', 'student-1', 'question-1', 'A'],
  ];
  const expected = [
    {
      assessmentId: 'assessment-1',
      studentId: 'student-1',
      questionId: 'question-1',
      answer: 'A',
    },
  ];
  assert.deepEqual(await parseOfflineResponseFile(csv, 'respostas.csv'), expected);
  assert.deepEqual(await parseOfflineResponseFile(await xlsxFixture(rows), 'respostas.xlsx'), expected);
});

test('validates missing references, invalid answers, duplicates and conflicts before commit', async () => {
  const rows = [
    {
      assessmentId: 'assessment-1',
      studentId: 'student-1',
      questionId: 'question-1',
      answer: 'B',
    },
    {
      assessmentId: 'assessment-1',
      studentId: 'student-1',
      questionId: 'question-1',
      answer: 'B',
    },
    {
      assessmentId: 'assessment-1',
      studentId: 'missing-student',
      questionId: 'question-1',
      answer: 'Z',
    },
    {
      assessmentId: 'missing-assessment',
      studentId: 'student-2',
      questionId: 'missing-question',
      answer: '',
    },
  ];
  const preview = await createOfflineImportPreview('respostas.csv', rows, catalog);
  assert.equal(preview.total, 4);
  assert.equal(preview.conflicts, 2);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.valid, 1);
  assert.deepEqual(preview.rows[0].issues, ['conflict']);
  assert.ok(preview.rows[1].issues.includes('duplicate_in_file'));
  assert.ok(preview.rows[2].issues.includes('student_not_found'));
  assert.ok(preview.rows[2].issues.includes('invalid_answer'));
  assert.ok(preview.rows[3].issues.includes('assessment_not_found'));
  assert.ok(preview.rows[3].issues.includes('question_not_found'));
  assert.ok(preview.rows[3].issues.includes('missing_answer'));
  assert.throws(() => setOfflineImportDecision(preview, 3, 'CREATE'), /inválida/);
});

test('commit is confirmed, audited, conflict-aware and idempotent', async () => {
  const rows = [
    {
      assessmentId: 'assessment-1',
      studentId: 'student-1',
      questionId: 'question-1',
      answer: 'B',
    },
    {
      assessmentId: 'assessment-1',
      studentId: 'student-2',
      questionId: 'question-2',
      answer: 'Uma justificativa.',
    },
  ];
  const preview = await createOfflineImportPreview('respostas.xlsx', rows, catalog);
  const store = createOfflineImportStore(catalog.existingResponses);
  assert.throws(
    () => commitOfflineResponseImport(preview, store, 'manager-1', { confirmed: false }),
    /Confirme/,
  );
  const first = commitOfflineResponseImport(preview, store, 'manager-1', {
    confirmed: true,
    now: '2026-09-20T15:00:00.000Z',
    batchId: 'batch-1',
  });
  assert.equal(first.status, 'imported');
  assert.deepEqual(
    { created: first.audit.created, updated: first.audit.updated, rejected: first.audit.rejected },
    { created: 1, updated: 1, rejected: 0 },
  );
  assert.equal(store.responses.size, 2);
  assert.equal(store.audits.length, 1);
  const second = commitOfflineResponseImport(preview, store, 'manager-1', {
    confirmed: true,
  });
  assert.equal(second.status, 'already_imported');
  assert.equal(store.responses.size, 2);
  assert.equal(store.audits.length, 1);
  assert.equal(second.audit.batchId, 'batch-1');
});

test('rejects malformed formats, macro workbooks and unsupported extensions', async () => {
  await assert.rejects(parseOfflineResponseFile('x', 'respostas.xls'), /Formato não aceito/);
  const zip = new JSZip();
  zip.file('xl/vbaProject.bin', 'macro');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>');
  await assert.rejects(
    parseOfflineResponseFile((await zip.generateAsync({ type: 'uint8array' })).buffer, 'bad.xlsx'),
    /macros/,
  );
});
