import JSZip from 'jszip';
import { parseImport, type ImportRow } from './import-data.ts';

export type OfflineResponseInput = {
  assessmentId: string;
  studentId: string;
  questionId: string;
  answer: string;
};

export type OfflineQuestionCatalog = {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'essay';
  optionIds?: string[];
  optionLabels?: string[];
};

export type OfflineImportCatalog = {
  assessmentId: string;
  studentIds: string[];
  questions: OfflineQuestionCatalog[];
  existingResponses?: Array<OfflineResponseInput & { answer: string }>;
};

export type OfflineImportIssueCode =
  | 'missing_assessment'
  | 'assessment_not_found'
  | 'missing_student'
  | 'student_not_found'
  | 'missing_question'
  | 'question_not_found'
  | 'missing_answer'
  | 'invalid_answer'
  | 'duplicate_in_file'
  | 'conflict';

export type OfflineImportDecision = 'CREATE' | 'UPDATE' | 'SKIP';

export type OfflineImportPreviewRow = OfflineResponseInput & {
  line: number;
  issues: OfflineImportIssueCode[];
  valid: boolean;
  conflict: boolean;
  decision: OfflineImportDecision;
};

export type OfflineImportPreview = {
  filename: string;
  fingerprint: string;
  assessmentId: string;
  rows: OfflineImportPreviewRow[];
  total: number;
  valid: number;
  invalid: number;
  conflicts: number;
  duplicates: number;
};

export type OfflineImportAudit = {
  batchId: string;
  fingerprint: string;
  filename: string;
  assessmentId: string;
  actorId: string;
  importedAt: string;
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
};

export type OfflineImportStore = {
  responses: Map<string, OfflineResponseInput>;
  processedFingerprints: Set<string>;
  audits: OfflineImportAudit[];
};

const aliases: Record<string, keyof OfflineResponseInput> = {
  avaliacao: 'assessmentId',
  avaliacao_id: 'assessmentId',
  assessment: 'assessmentId',
  assessment_id: 'assessmentId',
  aluno: 'studentId',
  aluno_id: 'studentId',
  student: 'studentId',
  student_id: 'studentId',
  questao: 'questionId',
  questao_id: 'questionId',
  question: 'questionId',
  question_id: 'questionId',
  assessment_item_id: 'questionId',
  resposta: 'answer',
  answer: 'answer',
};

function normalizedHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function normalizeRows(rows: ImportRow[]): OfflineResponseInput[] {
  return rows.map((row) => {
    const mapped = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [aliases[normalizedHeader(key)] ?? key, value.trim()]),
    ) as Partial<OfflineResponseInput>;
    return {
      assessmentId: mapped.assessmentId ?? '',
      studentId: mapped.studentId ?? '',
      questionId: mapped.questionId ?? '',
      answer: mapped.answer ?? '',
    };
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlText(xml: string) {
  return decodeXml(xml.replace(/<[^>]+>/g, ''));
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? '';
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ImportRow[]> {
  if (buffer.byteLength > 5_000_000) throw new Error('Arquivo excede 5 MB. Divida a carga.');
  const zip = await JSZip.loadAsync(buffer);
  if (zip.file('xl/vbaProject.bin')) throw new Error('Planilhas com macros não são aceitas.');
  const worksheetNames = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!worksheetNames.length) throw new Error('XLSX inválido: nenhuma planilha encontrada.');
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml
    ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map((match) =>
        [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
          .map((part) => xmlText(part[1]))
          .join(''),
      )
    : [];
  const xml = await zip.file(worksheetNames[0])!.async('string');
  const matrix: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1];
      const content = cellMatch[2];
      const reference = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1] ?? `A${matrix.length + 1}`;
      const type = attributes.match(/\bt="([^"]+)"/i)?.[1];
      const raw = content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
      const inline = content.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i)?.[1];
      const value =
        type === 's'
          ? (shared[Number(raw)] ?? '')
          : type === 'inlineStr'
            ? xmlText(inline ?? '')
            : type === 'b'
              ? raw === '1'
                ? 'TRUE'
                : 'FALSE'
              : decodeXml(raw);
      row[columnIndex(reference)] = value.trim();
    }
    if (row.some((value) => value)) matrix.push(row);
  }
  if (!matrix.length) throw new Error('A planilha está vazia.');
  const headers = matrix.shift()!.map(normalizedHeader);
  if (!headers.length || headers.some((header) => !header) || new Set(headers).size !== headers.length)
    throw new Error('Cabeçalhos vazios ou duplicados.');
  const rows = matrix.map((row, index) => {
    if (row.length > headers.length)
      throw new Error(`Linha ${index + 2}: número de colunas incorreto.`);
    return Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']));
  });
  if (!rows.length || rows.length > 5_000)
    throw new Error('Envie de 1 a 5.000 respostas por lote.');
  return rows;
}

export async function parseOfflineResponseFile(
  content: string | ArrayBuffer,
  filename: string,
): Promise<OfflineResponseInput[]> {
  const extension = filename.toLocaleLowerCase('pt-BR').split('.').pop();
  if (extension === 'csv') {
    const text =
      typeof content === 'string' ? content : new TextDecoder('utf-8', { fatal: true }).decode(content);
    return normalizeRows(parseImport(text, 'csv'));
  }
  if (extension === 'xlsx') {
    const buffer =
      typeof content === 'string' ? new TextEncoder().encode(content).buffer : content;
    return normalizeRows(await parseXlsx(buffer));
  }
  throw new Error('Formato não aceito. Use CSV ou XLSX.');
}

function responseKey(row: Pick<OfflineResponseInput, 'assessmentId' | 'studentId' | 'questionId'>) {
  return `${row.assessmentId}\u001f${row.studentId}\u001f${row.questionId}`;
}

async function fingerprintRows(rows: OfflineResponseInput[]) {
  const canonical = [...rows]
    .map((row) => [row.assessmentId, row.studentId, row.questionId, row.answer].join('\u001f'))
    .sort()
    .join('\u001e');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function createOfflineImportPreview(
  filename: string,
  rows: OfflineResponseInput[],
  catalog: OfflineImportCatalog,
): Promise<OfflineImportPreview> {
  if (!rows.length || rows.length > 5_000)
    throw new Error('Envie de 1 a 5.000 respostas por lote.');
  const students = new Set(catalog.studentIds);
  const questions = new Map(catalog.questions.map((question) => [question.id, question]));
  const existing = new Map(
    (catalog.existingResponses ?? []).map((response) => [responseKey(response), response]),
  );
  const occurrences = new Map<string, number>();
  const previewRows = rows.map((row, index): OfflineImportPreviewRow => {
    const issues: OfflineImportIssueCode[] = [];
    if (!row.assessmentId) issues.push('missing_assessment');
    else if (row.assessmentId !== catalog.assessmentId) issues.push('assessment_not_found');
    if (!row.studentId) issues.push('missing_student');
    else if (!students.has(row.studentId)) issues.push('student_not_found');
    const question = questions.get(row.questionId);
    if (!row.questionId) issues.push('missing_question');
    else if (!question) issues.push('question_not_found');
    if (!row.answer.trim()) issues.push('missing_answer');
    else if (
      question &&
      question.type !== 'essay' &&
      !new Set([...(question.optionIds ?? []), ...(question.optionLabels ?? [])]).has(row.answer)
    )
      issues.push('invalid_answer');
    const key = responseKey(row);
    const seen = occurrences.get(key) ?? 0;
    occurrences.set(key, seen + 1);
    if (seen > 0) issues.push('duplicate_in_file');
    const previous = existing.get(key);
    const conflict = Boolean(previous && previous.answer !== row.answer);
    if (conflict) issues.push('conflict');
    const invalid = issues.some((issue) => issue !== 'conflict');
    return {
      ...row,
      line: index + 2,
      issues,
      valid: !invalid,
      conflict,
      decision: invalid ? 'SKIP' : conflict ? 'UPDATE' : previous ? 'SKIP' : 'CREATE',
    };
  });
  return {
    filename,
    fingerprint: await fingerprintRows(rows),
    assessmentId: catalog.assessmentId,
    rows: previewRows,
    total: previewRows.length,
    valid: previewRows.filter((row) => row.valid).length,
    invalid: previewRows.filter((row) => !row.valid).length,
    conflicts: previewRows.filter((row) => row.conflict).length,
    duplicates: previewRows.filter((row) => row.issues.includes('duplicate_in_file')).length,
  };
}

export function setOfflineImportDecision(
  preview: OfflineImportPreview,
  line: number,
  decision: OfflineImportDecision,
) {
  return {
    ...preview,
    rows: preview.rows.map((row) => {
      if (row.line !== line) return row;
      if (!row.valid && decision !== 'SKIP')
        throw new Error(`Linha ${line}: uma resposta inválida só pode ser ignorada.`);
      if (decision === 'CREATE' && row.conflict)
        throw new Error(`Linha ${line}: escolha atualizar ou ignorar o conflito.`);
      return { ...row, decision };
    }),
  };
}

export function createOfflineImportStore(
  responses: OfflineResponseInput[] = [],
): OfflineImportStore {
  return {
    responses: new Map(responses.map((response) => [responseKey(response), response])),
    processedFingerprints: new Set(),
    audits: [],
  };
}

export function commitOfflineResponseImport(
  preview: OfflineImportPreview,
  store: OfflineImportStore,
  actorId: string,
  options: { confirmed: boolean; now?: string; batchId?: string },
) {
  if (!options.confirmed) throw new Error('Confirme a importação antes de gravar.');
  if (!actorId) throw new Error('Usuário não autenticado.');
  const previous = store.audits.find((audit) => audit.fingerprint === preview.fingerprint);
  if (store.processedFingerprints.has(preview.fingerprint) && previous)
    return { status: 'already_imported' as const, audit: previous };
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let rejected = 0;
  for (const row of preview.rows) {
    if (!row.valid) {
      rejected++;
      continue;
    }
    if (row.decision === 'SKIP') {
      skipped++;
      continue;
    }
    const key = responseKey(row);
    const exists = store.responses.has(key);
    if (row.decision === 'CREATE' && exists)
      throw new Error(`Linha ${row.line}: a resposta já existe; revise o conflito.`);
    store.responses.set(key, {
      assessmentId: row.assessmentId,
      studentId: row.studentId,
      questionId: row.questionId,
      answer: row.answer,
    });
    if (exists) updated++;
    else created++;
  }
  const audit: OfflineImportAudit = {
    batchId: options.batchId ?? crypto.randomUUID(),
    fingerprint: preview.fingerprint,
    filename: preview.filename,
    assessmentId: preview.assessmentId,
    actorId,
    importedAt: options.now ?? new Date().toISOString(),
    created,
    updated,
    skipped,
    rejected,
  };
  store.processedFingerprints.add(preview.fingerprint);
  store.audits.push(audit);
  return { status: 'imported' as const, audit };
}

export function offlineImportIssueLabel(code: OfflineImportIssueCode) {
  const labels: Record<OfflineImportIssueCode, string> = {
    missing_assessment: 'Avaliação não informada',
    assessment_not_found: 'Avaliação inexistente ou fora do lote',
    missing_student: 'Aluno não informado',
    student_not_found: 'Aluno inexistente na turma',
    missing_question: 'Questão não informada',
    question_not_found: 'Questão inexistente na avaliação',
    missing_answer: 'Resposta não informada',
    invalid_answer: 'Resposta inválida para a questão',
    duplicate_in_file: 'Resposta duplicada no arquivo',
    conflict: 'Resposta diferente já registrada',
  };
  return labels[code];
}
