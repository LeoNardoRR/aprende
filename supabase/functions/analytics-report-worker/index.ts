import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import JSZip from 'npm:jszip@3.10.1';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const safe = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'relatorio';
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

type StudentRow = Record<string, string | number | boolean | null>;
type Dashboard = { students?: StudentRow[]; summary?: Record<string, unknown> };
type Job = { id: string; requested_by: string; network_id: string; report_type: string; status: string; filters: Record<string, unknown>; attempt_count: number };

async function studentPdf(student: StudentRow) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lines = [
    ['Aprende - Relatorio individual', true],
    [`Estudante: ${student.student_name ?? 'Nao identificado'}`, false],
    [`Escola: ${student.school_name ?? 'Nao informada'}`, false],
    [`Turma: ${student.classroom_name ?? 'Nao informada'}`, false],
    [`Avaliacao: ${student.assessment_title ?? 'Nao informada'}`, false],
    [`Situacao: ${student.status ?? 'indisponivel'}`, false],
    [`Pontuacao: ${student.score ?? 'indisponivel'} de ${student.max_score ?? 'indisponivel'}`, false],
    [`Percentual: ${student.percentage ?? 'indisponivel'}`, false],
    [`Questoes respondidas: ${student.answered_questions ?? 0}`, false],
    [`Acertos: ${student.correct_answers ?? 0}`, false],
    [`Erros: ${student.incorrect_answers ?? 0}`, false],
    [`Tempo total (s): ${student.total_time_seconds ?? 'indisponivel'}`, false],
    ['', false],
    ['Documento gerado a partir da mesma RPC analitica usada pelo dashboard.', false],
  ] as const;
  let y = 790;
  for (const [line, heading] of lines) {
    page.drawText(line, { x: 48, y, size: heading ? 16 : 10, font: heading ? bold : regular, color: heading ? rgb(.18,.12,.42) : rgb(.15,.17,.22) });
    y -= heading ? 32 : 20;
  }
  page.drawText('Aprende - pagina 1 de 1', { x: 48, y: 28, size: 8, font: regular });
  return pdf.save();
}

async function processJob(service: ReturnType<typeof createClient>, caller: ReturnType<typeof createClient>, job: Job) {
  try {
    await service.from('analytics_report_jobs').update({ status: 'processing', progress: 1, started_at: new Date().toISOString(), attempt_count: job.attempt_count + 1, updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued');
    const students: StudentRow[] = [];
    let page = 1;
    for (;;) {
      const { data, error } = await caller.rpc('get_analytics_dashboard', { filters: { ...job.filters, page, page_size: 200 } });
      if (error) throw error;
      const rows = ((data as Dashboard | null)?.students ?? []) as StudentRow[];
      students.push(...rows);
      if (rows.length < 200) break;
      page += 1;
      if (page > 100) throw new Error('O lote excede o limite seguro de 20.000 resultados. Divida-o por turma.');
    }

    const zip = new JSZip();
    const table: unknown[][] = [['student_id','estudante','escola','turma','avaliacao','status','pontuacao','maximo','percentual','respondidas','acertos','erros','tempo_segundos']];
    students.forEach((student) => table.push(['student_id','student_name','school_name','classroom_name','assessment_title','status','score','max_score','percentage','answered_questions','correct_answers','incorrect_answers','total_time_seconds'].map((key) => student[key])));
    zip.file('indice.csv', `\ufeff${table.map((row) => row.map(csvCell).join(';')).join('\n')}`);
    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      zip.file(`alunos/${safe(student.student_name)}-${safe(student.student_id)}.pdf`, await studentPdf(student));
      if (index % 25 === 0) await service.from('analytics_report_jobs').update({ progress: Math.min(90, Math.round(5 + (index / Math.max(students.length, 1)) * 85)), updated_at: new Date().toISOString() }).eq('id', job.id);
    }
    zip.file('metodologia.txt', 'Fonte: get_analytics_dashboard\nVersao: phase5-v1\nTentativas canceladas e invalidadas excluidas. Resultados com correcao discursiva pendente nao recebem percentual definitivo.');
    const archive = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const path = `${job.network_id}/${job.requested_by}/${job.id}.zip`;
    const uploaded = await service.storage.from('analytics-reports').upload(path, archive, { contentType: 'application/zip', upsert: false });
    if (uploaded.error) throw uploaded.error;
    await service.from('analytics_report_jobs').update({ status: 'completed', progress: 100, output_path: path, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id);
  } catch (error) {
    await service.from('analytics_report_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 2000) : 'Falha ao gerar lote.', updated_at: new Date().toISOString() }).eq('id', job.id);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({}, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({}, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Worker indisponivel.' }, 503);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identity = await caller.auth.getUser();
  if (identity.error || !identity.data.user) return json({}, 401);
  const body = await req.json().catch(() => ({})) as { job_id?: string; action?: string };
  const selected = await service.from('analytics_report_jobs').select('id,requested_by,network_id,report_type,status,filters,output_path,attempt_count').eq('id', body.job_id ?? '').eq('requested_by', identity.data.user.id).maybeSingle();
  if (selected.error || !selected.data) return json({ error: 'Lote nao encontrado.' }, 404);
  if (body.action === 'download') {
    if (selected.data.status !== 'completed' || !selected.data.output_path) return json({ error: 'Arquivo ainda nao esta disponivel.' }, 409);
    const signed = await service.storage.from('analytics-reports').createSignedUrl(selected.data.output_path, 300);
    return signed.error ? json({ error: 'Download indisponivel.' }, 500) : json({ signed_url: signed.data.signedUrl });
  }
  if (selected.data.status !== 'queued') return json({ id: selected.data.id, status: selected.data.status }, 202);
  const task = processJob(service, caller, selected.data as Job);
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(task); else await task;
  return json({ id: selected.data.id, status: 'processing' }, 202);
});
