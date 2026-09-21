export type AssessmentPrintFormat = 'pdf' | 'docx';
export type AssessmentPrintKind =
  | 'student_exam'
  | 'teacher_version'
  | 'answer_key'
  | 'answer_sheet'
  | 'attendance_list';

export type AssessmentPrintOption = {
  id: string;
  label: string;
  text: string;
  correct?: boolean;
};

export type AssessmentPrintQuestion = {
  id: string;
  position: number;
  statement: string;
  type: 'multiple_choice' | 'true_false' | 'essay';
  options?: AssessmentPrintOption[];
  correctAnswer?: string;
  skillCode?: string;
  skillDescription?: string;
  responseLines?: number;
};

export type AssessmentPrintStudent = {
  id: string;
  name: string;
  institutionalId?: string;
};

export type AssessmentPrintPayload = {
  assessmentId: string;
  assessmentTitle: string;
  component: string;
  instructions?: string;
  schoolId: string;
  schoolName: string;
  classroomId: string;
  classroomName: string;
  bookletCode: string;
  applicationDate?: string;
  questions: AssessmentPrintQuestion[];
  students: AssessmentPrintStudent[];
  targetStudent?: AssessmentPrintStudent;
};

export type AssessmentPrintAuthorization = {
  actorId: string;
  role: 'network_admin' | 'manager' | 'teacher';
  schoolIds?: string[];
  classroomIds?: string[];
  canViewPedagogy?: boolean;
};

export type AssessmentPrintArtifact = {
  kind: AssessmentPrintKind;
  format: AssessmentPrintFormat;
  filename: string;
  blob: Blob;
};

const TITLES: Record<AssessmentPrintKind, string> = {
  student_exam: 'Prova do aluno',
  teacher_version: 'Versão do professor',
  answer_key: 'Gabarito',
  answer_sheet: 'Folha de respostas',
  attendance_list: 'Lista de presença',
};

function assertAuthorized(
  payload: AssessmentPrintPayload,
  authorization: AssessmentPrintAuthorization,
) {
  if (!authorization.actorId) throw new Error('Usuário não autenticado.');
  if (authorization.role === 'network_admin') return;
  if (authorization.role === 'manager') {
    if (!authorization.schoolIds?.includes(payload.schoolId))
      throw new Error('A escola não pertence ao escopo autorizado.');
    return;
  }
  if (!authorization.classroomIds?.includes(payload.classroomId))
    throw new Error('A turma não pertence ao escopo autorizado.');
}

function validatePayload(payload: AssessmentPrintPayload, kind: AssessmentPrintKind) {
  const required = [
    payload.assessmentId,
    payload.assessmentTitle,
    payload.component,
    payload.schoolId,
    payload.schoolName,
    payload.classroomId,
    payload.classroomName,
    payload.bookletCode,
  ];
  if (required.some((value) => !value.trim()))
    throw new Error('Dados obrigatórios da avaliação estão incompletos.');
  if (!payload.questions.length && kind !== 'attendance_list')
    throw new Error('A avaliação não possui questões para impressão.');
  if (kind === 'attendance_list' && !payload.students.length)
    throw new Error('A turma não possui alunos para a lista de presença.');
  const positions = payload.questions.map((question) => question.position);
  if (new Set(positions).size !== positions.length || positions.some((value) => value < 1))
    throw new Error('As posições das questões devem ser únicas e positivas.');
  for (const question of payload.questions) {
    if (!question.id || !question.statement.trim())
      throw new Error(`Questão ${question.position} incompleta.`);
    if (question.type !== 'essay' && (!question.options || question.options.length < 2))
      throw new Error(`Questão ${question.position} precisa de alternativas.`);
    if (
      (kind === 'teacher_version' || kind === 'answer_key') &&
      !question.correctAnswer?.trim()
    )
      throw new Error(`Questão ${question.position} não possui resposta correta.`);
  }
}

function orderedQuestions(payload: AssessmentPrintPayload) {
  return [...payload.questions].sort((left, right) => left.position - right.position);
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function assessmentPrintFilename(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  format: AssessmentPrintFormat,
) {
  const labels: Record<AssessmentPrintKind, string> = {
    student_exam: 'prova-aluno',
    teacher_version: 'versao-professor',
    answer_key: 'gabarito',
    answer_sheet: 'folha-respostas',
    attendance_list: 'lista-presenca',
  };
  return `aprende-${labels[kind]}-${safeFilename(payload.assessmentTitle)}-${safeFilename(payload.bookletCode)}.${format}`;
}

function metaLines(payload: AssessmentPrintPayload, kind: AssessmentPrintKind) {
  const lines = [
    `Escola: ${payload.schoolName}`,
    `Turma: ${payload.classroomName}`,
    `Avaliação: ${payload.assessmentTitle}`,
    `Componente: ${payload.component}`,
    `Caderno: ${payload.bookletCode}`,
  ];
  if (payload.applicationDate) lines.push(`Data: ${payload.applicationDate}`);
  if (kind === 'student_exam' || kind === 'answer_sheet') {
    lines.push(
      `Aluno: ${payload.targetStudent?.name ?? '________________________________________'}`,
      `Identificador: ${payload.targetStudent?.institutionalId ?? '____________________'}`,
    );
  }
  return lines;
}

function questionTextLines(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  showPedagogy: boolean,
) {
  const lines: Array<{ text: string; style?: 'title' | 'heading' | 'answer' }> = [];
  for (const question of orderedQuestions(payload)) {
    lines.push({ text: `${question.position}. ${question.statement}`, style: 'heading' });
    if (kind !== 'answer_key') {
      if (question.type === 'essay') {
        for (let line = 0; line < Math.max(3, question.responseLines ?? 5); line++)
          lines.push({ text: '____________________________________________________________________' });
      } else {
        for (const option of question.options ?? [])
          lines.push({ text: `(  ) ${option.label}. ${option.text}` });
      }
    }
    if (kind === 'teacher_version' || kind === 'answer_key') {
      lines.push({ text: `Resposta correta: ${question.correctAnswer}`, style: 'answer' });
      if (showPedagogy && (question.skillCode || question.skillDescription))
        lines.push({
          text: `Habilidade: ${[question.skillCode, question.skillDescription].filter(Boolean).join(' - ')}`,
        });
    }
    lines.push({ text: '' });
  }
  return lines;
}

function answerSheetLines(payload: AssessmentPrintPayload) {
  return orderedQuestions(payload).map((question) => {
    if (question.type === 'essay')
      return { text: `${question.position}. Questão discursiva - conferir no caderno`, style: 'heading' as const };
    return {
      text: `${question.position}. ${(question.options ?? []).map((option) => `(  ) ${option.label}`).join('     ')}`,
      style: 'heading' as const,
    };
  });
}

function attendanceLines(payload: AssessmentPrintPayload) {
  return [...payload.students]
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    .map((student, index) => ({
      text: `${String(index + 1).padStart(2, '0')}. ${student.name}  |  Presença: (  )  |  Assinatura: __________________________`,
    }));
}

function documentLines(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  authorization: AssessmentPrintAuthorization,
) {
  const lines: Array<{ text: string; style?: 'title' | 'heading' | 'answer' }> = [
    { text: `Aprendê - ${TITLES[kind]}`, style: 'title' },
    ...metaLines(payload, kind).map((text) => ({ text })),
    { text: '' },
  ];
  if (payload.instructions && (kind === 'student_exam' || kind === 'teacher_version')) {
    lines.push({ text: 'Instruções', style: 'heading' }, { text: payload.instructions }, { text: '' });
  }
  if (kind === 'answer_sheet') lines.push(...answerSheetLines(payload));
  else if (kind === 'attendance_list') lines.push(...attendanceLines(payload));
  else
    lines.push(
      ...questionTextLines(payload, kind, Boolean(authorization.canViewPedagogy)),
    );
  return lines;
}

function pdfSafe(value: string) {
  const normalized = value
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('…', '...')
    .replaceAll('•', '-');
  return [...normalized]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)
        ? character
        : '?';
    })
    .join('');
}

async function buildPdf(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  authorization: AssessmentPrintAuthorization,
) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${TITLES[kind]} - ${payload.assessmentTitle}`);
  pdf.setSubject(`Avaliação ${payload.assessmentId}`);
  pdf.setProducer('Aprendê');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([595.28, 841.89]);
  pages.push(page);
  let y = 792;
  const margin = 48;
  const width = 595.28 - margin * 2;

  function addPage() {
    page = pdf.addPage([595.28, 841.89]);
    pages.push(page);
    y = 792;
  }
  function wrapped(text: string, font: typeof regular, size: number) {
    if (!text) return [''];
    const words = pdfSafe(text).split(/\s+/);
    const result: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
      else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
    return result.length ? result : [''];
  }
  for (const line of documentLines(payload, kind, authorization)) {
    const font = line.style === 'title' || line.style === 'heading' || line.style === 'answer' ? bold : regular;
    const size = line.style === 'title' ? 17 : line.style === 'heading' ? 11 : 10;
    const gap = line.style === 'title' ? 25 : line.style === 'heading' ? 18 : 15;
    for (const chunk of wrapped(line.text, font, size)) {
      if (y < 64) addPage();
      page.drawText(chunk, {
        x: margin,
        y,
        size,
        font,
        color: line.style === 'answer' ? rgb(0.05, 0.35, 0.18) : rgb(0.08, 0.09, 0.12),
      });
      y -= gap;
    }
    if (!line.text) y -= 5;
  }
  pages.forEach((current, index) => {
    current.drawText(
      `Aprendê | ${TITLES[kind]} | página ${index + 1} de ${pages.length}`,
      { x: margin, y: 28, size: 8, font: regular, color: rgb(0.35, 0.36, 0.4) },
    );
  });
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}

async function buildDocx(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  authorization: AssessmentPrintAuthorization,
) {
  const {
    AlignmentType,
    Document,
    Footer,
    HeadingLevel,
    Packer,
    PageNumber,
    Paragraph,
    TextRun,
  } = await import('docx');
  const children = documentLines(payload, kind, authorization).map((line) => {
    const heading =
      line.style === 'title'
        ? HeadingLevel.TITLE
        : line.style === 'heading'
          ? HeadingLevel.HEADING_2
          : undefined;
    return new Paragraph({
      heading,
      spacing: { after: line.style === 'title' ? 220 : line.style === 'heading' ? 120 : 80 },
      children: [
        new TextRun({
          text: line.text,
          bold: line.style === 'answer',
          color: line.style === 'answer' ? '126B3A' : '000000',
          size: line.style === 'title' ? 34 : line.style === 'heading' ? 23 : 22,
        }),
      ],
    });
  });
  const document = new Document({
    creator: 'Aprendê',
    title: `${TITLES[kind]} - ${payload.assessmentTitle}`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: '000000' } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun(`Aprendê | ${TITLES[kind]} | página `),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' de '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });
  return new Blob([new Uint8Array(await Packer.toBuffer(document))], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function createAssessmentPrintArtifact(
  payload: AssessmentPrintPayload,
  kind: AssessmentPrintKind,
  format: AssessmentPrintFormat,
  authorization: AssessmentPrintAuthorization,
): Promise<AssessmentPrintArtifact> {
  assertAuthorized(payload, authorization);
  validatePayload(payload, kind);
  const blob =
    format === 'pdf'
      ? await buildPdf(payload, kind, authorization)
      : await buildDocx(payload, kind, authorization);
  return {
    kind,
    format,
    filename: assessmentPrintFilename(payload, kind, format),
    blob,
  };
}

export async function createAssessmentPrintPackage(
  payload: AssessmentPrintPayload,
  format: AssessmentPrintFormat,
  authorization: AssessmentPrintAuthorization,
) {
  const kinds: AssessmentPrintKind[] = [
    'student_exam',
    'teacher_version',
    'answer_key',
    'answer_sheet',
    'attendance_list',
  ];
  return Promise.all(
    kinds.map((kind) => createAssessmentPrintArtifact(payload, kind, format, authorization)),
  );
}

export function downloadAssessmentPrintArtifact(artifact: AssessmentPrintArtifact) {
  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
