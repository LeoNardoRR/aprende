export type AnalyticsReportPayload = {
  report_type: string;
  generated_at: string;
  filters: Record<string, unknown>;
  methodology_version: string;
  provisional: boolean;
  data: {
    state: string;
    summary: Record<string, number | null>;
    statistics: Record<string, number | null>;
    proficiency: Array<Record<string, string | number>>;
    skills: Array<Record<string, string | number | null>>;
    students: Array<Record<string, string | number | boolean | null>>;
    evolution: Array<Record<string, string | number | null>>;
  };
};

type ExportFormat = 'pdf' | 'docx' | 'csv';
const labels: Record<string, string> = {
  attempts: 'Tentativas', students: 'Estudantes', completed: 'Concluídas', pending_review: 'Aguardando correção',
  questions: 'Questões', answered: 'Respondidas', unanswered: 'Não respondidas', correct: 'Acertos', incorrect: 'Erros',
  score: 'Pontuação', max_score: 'Pontuação máxima', participation_percentage: 'Participação (%)', average_time_seconds: 'Tempo médio (s)',
  observations: 'Observações', mean: 'Média', median: 'Mediana', minimum: 'Mínimo', maximum: 'Máximo', variance: 'Variância', standard_deviation: 'Desvio padrão',
};
const textValue = (value: unknown) => value == null ? 'Indisponível' : typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(value);
const reportLines = (payload: AnalyticsReportPayload) => {
  const lines = [
    'Aprendê — Relatório de Analytics Educacionais',
    `Tipo: ${payload.report_type}`,
    `Gerado em: ${new Date(payload.generated_at).toLocaleString('pt-BR')}`,
    `Metodologia: ${payload.methodology_version}${payload.provisional ? ' · RESULTADO PROVISÓRIO' : ''}`,
    `Filtros: ${Object.entries(payload.filters).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`).join(', ') || 'escopo autorizado completo'}`,
    '', 'Resumo',
    ...Object.entries(payload.data.summary ?? {}).map(([key, value]) => `${labels[key] ?? key}: ${textValue(value)}`),
    '', 'Estatística descritiva',
    ...Object.entries(payload.data.statistics ?? {}).map(([key, value]) => `${labels[key] ?? key}: ${textValue(value)}`),
    '', 'Proficiência',
    ...(payload.data.proficiency?.length ? payload.data.proficiency.map((row) => `${row.label}: ${textValue(row.count)} (${textValue(row.percentage)}%)`) : ['Sem dados suficientes']),
    '', 'Desempenho por habilidade',
    ...(payload.data.skills?.length ? payload.data.skills.map((row) => `${row.code ?? 'Sem código'} — ${row.description ?? ''}: ${textValue(row.percentage)}% (${textValue(row.students_evaluated)} estudantes)`) : ['Sem dados suficientes']),
  ];
  return lines;
};

function download(blob: Blob, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

function safeName(type: string, extension: string) {
  return `aprende-${type}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

async function pdfBlob(payload: AnalyticsReportPayload) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: Array<ReturnType<typeof pdf.addPage>> = [];
  let page = pdf.addPage([595.28, 841.89]); pages.push(page);
  let y = 790;
  for (const rawLine of reportLines(payload)) {
    const chunks = rawLine.match(/.{1,88}(?:\s|$)|\S.{0,87}/g) ?? [''];
    for (const chunk of chunks) {
      if (y < 55) { page = pdf.addPage([595.28, 841.89]); pages.push(page); y = 790; }
      const heading = ['Aprendê — Relatório de Analytics Educacionais','Resumo','Estatística descritiva','Proficiência','Desempenho por habilidade'].includes(rawLine);
      page.drawText(chunk.trim(), { x: 48, y, size: heading ? 13 : 9, font: heading ? bold : regular, color: heading ? rgb(0.18,0.12,0.42) : rgb(0.15,0.17,0.22) });
      y -= heading ? 22 : 14;
    }
  }
  pages.forEach((item, index) => item.drawText(`Aprendê · página ${index + 1} de ${pages.length}`, { x: 48, y: 28, size: 8, font: regular, color: rgb(0.4,0.4,0.45) }));
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}

async function docxBlob(payload: AnalyticsReportPayload) {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } = await import('docx');
  const summaryRows = Object.entries(payload.data.summary ?? {}).map(([key, value]) => new TableRow({ children: [new TableCell({ children: [new Paragraph(labels[key] ?? key)] }), new TableCell({ children: [new Paragraph(textValue(value))] })] }));
  const document = new Document({ sections: [{ children: [
    new Paragraph({ text: 'Aprendê — Relatório de Analytics Educacionais', heading: HeadingLevel.TITLE }),
    new Paragraph(`Tipo: ${payload.report_type}`),
    new Paragraph(`Gerado em: ${new Date(payload.generated_at).toLocaleString('pt-BR')}`),
    new Paragraph(`Metodologia: ${payload.methodology_version}${payload.provisional ? ' · RESULTADO PROVISÓRIO' : ''}`),
    new Paragraph({ text: 'Resumo', heading: HeadingLevel.HEADING_1 }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: summaryRows }),
    new Paragraph({ text: 'Proficiência', heading: HeadingLevel.HEADING_1 }),
    ...((payload.data.proficiency?.length ? payload.data.proficiency.map((row) => `${row.label}: ${textValue(row.count)} (${textValue(row.percentage)}%)`) : ['Sem dados suficientes']).map((line) => new Paragraph(line))),
    new Paragraph({ text: 'Desempenho curricular', heading: HeadingLevel.HEADING_1 }),
    ...((payload.data.skills?.length ? payload.data.skills.map((row) => `${row.code ?? 'Sem código'} — ${row.description ?? ''}: ${textValue(row.percentage)}%`) : ['Sem dados suficientes']).map((line) => new Paragraph(line))),
  ] }] });
  return new Blob([new Uint8Array(await Packer.toBuffer(document))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function csvBlob(payload: AnalyticsReportPayload) {
  const rows: unknown[][] = [['seção','indicador','valor']];
  Object.entries(payload.data.summary ?? {}).forEach(([key, value]) => rows.push(['resumo', labels[key] ?? key, value]));
  Object.entries(payload.data.statistics ?? {}).forEach(([key, value]) => rows.push(['estatística', labels[key] ?? key, value]));
  payload.data.skills?.forEach((row) => rows.push(['habilidade', `${row.code ?? ''} ${row.description ?? ''}`.trim(), row.percentage]));
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`;
  return new Blob([`\ufeff${rows.map((row) => row.map(escape).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
}

export async function exportAnalyticsReport(payload: AnalyticsReportPayload, format: ExportFormat) {
  const blob = format === 'pdf' ? await pdfBlob(payload) : format === 'docx' ? await docxBlob(payload) : csvBlob(payload);
  download(blob, safeName(payload.report_type, format));
}
