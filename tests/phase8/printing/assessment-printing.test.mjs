import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  assessmentPrintFilename,
  createAssessmentPrintArtifact,
  createAssessmentPrintPackage,
} from '../../../lib/assessment-printing.ts';

const payload = {
  assessmentId: 'assessment-1',
  assessmentTitle: 'Avaliação Diagnóstica de Matemática',
  component: 'Matemática',
  instructions: 'Leia com atenção e marque somente uma alternativa.',
  schoolId: 'school-1',
  schoolName: 'Escola Municipal José de Alencar',
  classroomId: 'class-1',
  classroomName: '6º ano A',
  bookletCode: 'Caderno A',
  applicationDate: '20/09/2026',
  targetStudent: { id: 'student-1', name: 'Ana Júlia', institutionalId: '2026001' },
  students: [
    { id: 'student-2', name: 'Bruno Souza', institutionalId: '2026002' },
    { id: 'student-1', name: 'Ana Júlia', institutionalId: '2026001' },
  ],
  questions: [
    {
      id: 'question-1',
      position: 1,
      statement: 'Qual fração representa a metade?',
      type: 'multiple_choice',
      options: [
        { id: 'option-a', label: 'A', text: '1/2', correct: true },
        { id: 'option-b', label: 'B', text: '1/3' },
        { id: 'option-c', label: 'C', text: '2/3' },
      ],
      correctAnswer: 'A',
      skillCode: 'EF06MA07',
      skillDescription: 'Compreender frações equivalentes.',
    },
    {
      id: 'question-2',
      position: 2,
      statement: 'Explique como você chegou ao resultado.',
      type: 'essay',
      correctAnswer: 'Resposta pessoal com justificativa coerente.',
      responseLines: 4,
    },
  ],
};

const authorization = {
  actorId: 'manager-1',
  role: 'manager',
  schoolIds: ['school-1'],
  canViewPedagogy: true,
};

test('generates five valid, non-empty PDFs with metadata and pagination', async () => {
  const artifacts = await createAssessmentPrintPackage(payload, 'pdf', authorization);
  assert.deepEqual(
    artifacts.map((artifact) => artifact.kind),
    ['student_exam', 'teacher_version', 'answer_key', 'answer_sheet', 'attendance_list'],
  );
  for (const artifact of artifacts) {
    assert.match(artifact.filename, /^aprende-[a-z-]+-avaliacao-diagnostica-de-matematica-caderno-a\.pdf$/);
    assert.equal(artifact.blob.type, 'application/pdf');
    assert.ok(artifact.blob.size > 900);
    const pdf = await PDFDocument.load(await artifact.blob.arrayBuffer());
    assert.ok(pdf.getPageCount() >= 1);
    assert.match(pdf.getTitle(), /Avaliação Diagnóstica de Matemática/);
    assert.equal(pdf.getSubject(), 'Avaliação assessment-1');
  }
});

test('generates DOCX packages with readable OOXML content for every required document', async () => {
  const artifacts = await createAssessmentPrintPackage(payload, 'docx', authorization);
  for (const artifact of artifacts) {
    assert.equal(
      artifact.blob.type,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const zip = await JSZip.loadAsync(await artifact.blob.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /Avaliação Diagnóstica de Matemática/);
    assert.match(xml, /Escola Municipal José de Alencar/);
    assert.ok(zip.file('word/footer1.xml'));
  }
});

test('teacher output includes answer and skill, while student output omits both', async () => {
  const teacher = await createAssessmentPrintArtifact(payload, 'teacher_version', 'docx', authorization);
  const student = await createAssessmentPrintArtifact(payload, 'student_exam', 'docx', authorization);
  const teacherXml = await (await JSZip.loadAsync(await teacher.blob.arrayBuffer()))
    .file('word/document.xml')
    .async('string');
  const studentXml = await (await JSZip.loadAsync(await student.blob.arrayBuffer()))
    .file('word/document.xml')
    .async('string');
  assert.match(teacherXml, /Resposta correta/);
  assert.match(teacherXml, /EF06MA07/);
  assert.doesNotMatch(studentXml, /Resposta correta|EF06MA07/);
  assert.match(studentXml, /Ana Júlia/);
});

test('rejects unauthorized scope and incomplete answer keys', async () => {
  await assert.rejects(
    createAssessmentPrintArtifact(payload, 'student_exam', 'pdf', {
      actorId: 'teacher-2',
      role: 'teacher',
      classroomIds: ['another-class'],
    }),
    /escopo autorizado/,
  );
  await assert.rejects(
    createAssessmentPrintArtifact(
      { ...payload, questions: [{ ...payload.questions[0], correctAnswer: '' }] },
      'answer_key',
      'docx',
      authorization,
    ),
    /não possui resposta correta/,
  );
  assert.equal(
    assessmentPrintFilename(payload, 'answer_sheet', 'pdf'),
    'aprende-folha-respostas-avaliacao-diagnostica-de-matematica-caderno-a.pdf',
  );
});
