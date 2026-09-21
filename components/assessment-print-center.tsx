'use client';

import { useState } from 'react';
import {
  BookOpenCheck,
  CheckSquare2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  ListChecks,
  Printer,
  School2,
  UsersRound,
} from 'lucide-react';
import {
  createAssessmentPrintArtifact,
  downloadAssessmentPrintArtifact,
  type AssessmentPrintAuthorization,
  type AssessmentPrintFormat,
  type AssessmentPrintKind,
  type AssessmentPrintPayload,
} from '@/lib/assessment-printing';

const documents: Array<{
  kind: AssessmentPrintKind;
  label: string;
  description: string;
}> = [
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

const documentIcons: Record<AssessmentPrintKind, typeof FileText> = {
  student_exam: GraduationCap,
  teacher_version: BookOpenCheck,
  answer_key: ListChecks,
  answer_sheet: CheckSquare2,
  attendance_list: UsersRound,
};

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
      const artifact = await createAssessmentPrintArtifact(
        payload,
        kind,
        format,
        authorization,
      );
      downloadAssessmentPrintArtifact(artifact);
      setNotice(`${artifact.filename} gerado com sucesso.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o documento.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="assessment-print-center"
      aria-labelledby="assessment-print-title"
    >
      <header className="assessment-print-center__head">
        <div className="assessment-print-center__title">
          <span className="assessment-print-center__icon" aria-hidden="true">
            <Printer />
          </span>
          <div>
            <span className="assessment-print-center__eyebrow">
              DOCUMENTOS DA APLICAÇÃO
            </span>
            <h3 id="assessment-print-title">Aplicação impressa</h3>
            <p>
              Escolha o formato e gere somente os documentos necessários para a
              aplicação.
            </p>
          </div>
        </div>
        <fieldset className="assessment-print-format" disabled={busy !== null}>
          <legend>Formato do arquivo</legend>
          <div>
            {(['pdf', 'docx'] as const).map((option) => (
              <label
                key={option}
                className={format === option ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name="assessment-print-format"
                  value={option}
                  checked={format === option}
                  onChange={() => setFormat(option)}
                />
                <FileText aria-hidden="true" />
                {option.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>
      </header>

      <div
        className="assessment-print-scope"
        aria-label="Resumo da aplicação selecionada"
      >
        <div>
          <School2 aria-hidden="true" />
          <span>Escola</span>
          <strong>{payload.schoolName}</strong>
        </div>
        <div>
          <UsersRound aria-hidden="true" />
          <span>Turma</span>
          <strong>{payload.classroomName}</strong>
        </div>
        <div>
          <ClipboardCheck aria-hidden="true" />
          <span>Caderno</span>
          <strong>{payload.bookletCode}</strong>
        </div>
      </div>

      <div className="assessment-print-documents">
        {documents.map((document) => {
          const DocumentIcon = documentIcons[document.kind];
          return (
            <article className="assessment-print-document" key={document.kind}>
              <span
                className="assessment-print-document__icon"
                aria-hidden="true"
              >
                <DocumentIcon />
              </span>
              <div>
                <h4>{document.label}</h4>
                <p>{document.description}</p>
              </div>
              <footer>
                <span>
                  <FileCheck2 aria-hidden="true" /> {format.toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void generate(document.kind)}
                >
                  <Download aria-hidden="true" />
                  {busy === document.kind ? 'Gerando…' : 'Gerar arquivo'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {notice && (
        <p className="assessment-print-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
