export type PedagogyReport = {
  generated_at: string;
  methodology: string;
  filters: Record<string, unknown>;
  summary: Record<string, number | null>;
  assignments: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  evolution: Array<Record<string, unknown>>;
};

export type PedagogyReportFormat = 'pdf' | 'docx' | 'csv';
const labels: Record<string, string> = { students: 'Estudantes', assignments: 'Atribuições', in_progress: 'Em andamento', completed: 'Concluídas', average_progress: 'Progresso médio (%)', pedagogical_score: 'Resultado pedagógico', gamification_points: 'Pontos de participação' };
const text = (value: unknown) => value == null ? 'Indisponível' : typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(value);
const pdfText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('→', '->').replaceAll('—', '-').replaceAll('·', '-');
const lines = (report: PedagogyReport) => [
  'Aprendê — Relatório Pedagógico de Recomposição',
  `Gerado em: ${new Date(report.generated_at).toLocaleString('pt-BR')}`,
  `Metodologia: ${report.methodology}`,
  `Filtros: ${Object.entries(report.filters).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`).join(', ') || 'escopo autorizado'}`,
  '', 'Resumo', ...Object.entries(report.summary).map(([key, value]) => `${labels[key] ?? key}: ${text(value)}`),
  '', 'Habilidades', ...(report.skills.length ? report.skills.map((row) => `${text(row.skill_code)} — ${text(row.skill_description)}: ${text(row.average_progress)}% (${text(row.students)} estudantes)`) : ['Sem dados suficientes']),
  '', 'Evolução observada', ...(report.evolution.length ? report.evolution.map((row) => `${text(row.before_percentage)}% → ${text(row.after_percentage)}% · diferença ${text(row.absolute_difference)} p.p. · ${text(row.interpretation)}`) : ['Sem reavaliação comparável']),
];

function download(blob: Blob, extension: string) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob); anchor.download = `aprende-recomposicao-${new Date().toISOString().slice(0, 10)}.${extension}`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

async function createPdf(report: PedagogyReport) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: Array<ReturnType<typeof pdf.addPage>> = []; let page = pdf.addPage([595.28, 841.89]); pages.push(page); let y = 790;
  for (const raw of lines(report)) for (const chunk of raw.match(/.{1,88}(?:\s|$)|\S.{0,87}/g) ?? ['']) {
    if (y < 55) { page = pdf.addPage([595.28, 841.89]); pages.push(page); y = 790; }
    const heading = ['Aprendê — Relatório Pedagógico de Recomposição', 'Resumo', 'Habilidades', 'Evolução observada'].includes(raw);
    page.drawText(pdfText(chunk.trim()), { x: 48, y, size: heading ? 13 : 9, font: heading ? bold : regular, color: heading ? rgb(.08,.29,.18) : rgb(.14,.2,.17) }); y -= heading ? 22 : 14;
  }
  pages.forEach((item, index) => item.drawText(`Aprendê · página ${index + 1} de ${pages.length}`, { x: 48, y: 28, size: 8, font: regular }));
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}

async function createDocx(report: PedagogyReport) {
  const { Document, HeadingLevel, Packer, Paragraph } = await import('docx');
  const document = new Document({ sections: [{ children: lines(report).map((line) => new Paragraph({ text: line, heading: line === 'Aprendê — Relatório Pedagógico de Recomposição' ? HeadingLevel.TITLE : ['Resumo','Habilidades','Evolução observada'].includes(line) ? HeadingLevel.HEADING_1 : undefined })) }] });
  return new Blob([new Uint8Array(await Packer.toBuffer(document))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function createCsv(report: PedagogyReport) {
  const headers = ['assignment_id','student_id','journey','skill_code','status','progress_percentage','pedagogical_score','gamification_points'];
  const cell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"','""')}"`;
  };
  return new Blob([`\ufeff${headers.join(';')}\n${report.assignments.map((row) => headers.map((header) => cell(row[header])).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
}

export async function buildPedagogyReport(report: PedagogyReport, format: PedagogyReportFormat) {
  return format === 'pdf' ? createPdf(report) : format === 'docx' ? createDocx(report) : createCsv(report);
}

export async function exportPedagogyReport(report: PedagogyReport, format: PedagogyReportFormat) {
  const blob = await buildPedagogyReport(report, format);
  download(blob, format);
}
