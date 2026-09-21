'use client';

import { useState } from 'react';
import {
  createAssessmentPrintArtifact,
  downloadAssessmentPrintArtifact,
  type AssessmentPrintAuthorization,
  type AssessmentPrintFormat,
  type AssessmentPrintKind,
  type AssessmentPrintPayload,
} from '@/lib/assessment-printing';

const documents: Array<{ kind: AssessmentPrintKind; label: string; description: string }> = [
  {
    kind: 'student_exam',
    label: 'Prova do aluno',
    description: 'Identificação, instruções, questões e alternativas.',
  },
  {
    kind: 'teacher_version',
    label: 'Versão do professor',
    description: 'Questões, respostas e habilidades autorizadas.',
  },
  {
    kind: 'answer_key',
    label: 'Gabarito',
    description: 'Relação objetiva de questões e respostas corretas.',
  },
  {
    kind: 'answer_sheet',
    label: 'Folha de respostas',
    description: 'Campos de identificação e marcação por questão.',
  },
  {
    kind: 'attendance_list',
    label: 'Lista de presença',
    description: 'Alunos em ordem alfabética, presença e assinatura.',
  },
];

export function AssessmentPrintCenter({
  payload,
  authorization,
}: {
  payload: AssessmentPrintPayload;
  authorization: AssessmentPrintAuthorization;
}) {
  const [format, setFormat] = useState<AssessmentPrintFormat>('pdf');
  const [busy, setBusy] = useState<AssessmentPrintKind | null>(null);
  const [notice, setNotice] = useState('');

  async function generate(kind: AssessmentPrintKind) {
    setBusy(kind);
    setNotice('');
    try {
      const artifact = await createAssessmentPrintArtifact(payload, kind, format, authorization);
      downloadAssessmentPrintArtifact(artifact);
      setNotice(`${artifact.filename} gerado com sucesso.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível gerar o documento.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="phase12-box" aria-labelledby="assessment-print-title">
      <h3 id="assessment-print-title">Aplicação impressa</h3>
      <p>
        Gere documentos a partir do caderno atual. Confira avaliação, turma e versão antes de
        imprimir.
      </p>
      <fieldset disabled={busy !== null}>
        <legend>Formato do arquivo</legend>
        <label>
          <input
            type="radio"
            name="assessment-print-format"
            value="pdf"
            checked={format === 'pdf'}
            onChange={() => setFormat('pdf')}
          />{' '}
          PDF
        </label>
        <label>
          <input
            type="radio"
            name="assessment-print-format"
            value="docx"
            checked={format === 'docx'}
            onChange={() => setFormat('docx')}
          />{' '}
          DOCX
        </label>
      </fieldset>
      <div className="phase8-operation-grid">
        {documents.map((document) => (
          <article className="phase8-operation-card" key={document.kind}>
            <h4>{document.label}</h4>
            <p>{document.description}</p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void generate(document.kind)}
            >
              {busy === document.kind ? 'Gerando…' : `Gerar ${format.toUpperCase()}`}
            </button>
          </article>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
