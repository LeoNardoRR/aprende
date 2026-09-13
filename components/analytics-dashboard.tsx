'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, FileArchive, FileText, LoaderCircle, RefreshCw, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { supabase, studentSupabase } from '@/lib/supabase';
import { exportAnalyticsReport, type AnalyticsReportPayload } from '@/lib/analytics-report-export';

type OptionRow = { id: string; name: string; network_id?: string | null; school_id?: string | null };
type AnalyticsDashboardProps = {
  mode: 'student' | 'teacher' | 'institutional';
  networks?: OptionRow[];
  schools?: OptionRow[];
  classrooms?: OptionRow[];
  fixedNetworkId?: string | null;
  fixedSchoolId?: string | null;
  fixedClassroomId?: string | null;
  preview?: boolean;
};
type AnalyticsData = AnalyticsReportPayload['data'] & { items: Array<Record<string, string | number | null>> };
type Assessment = { id: string; title: string; network_id: string; cycle_id: string; subject_id: string; curriculum_school_year_id: string };
type ReportJob = { id: string; report_type: string; format: string; status: string; progress: number; output_path: string | null; created_at: string };
type Reliability = { items: number; participants: number; cronbach_alpha: number | null; available: boolean };
type Distractor = { item_id: string; statement: string; option_id: string; label: string; content: string; selected: number; percentage: number | null };
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

const previewData: AnalyticsData = {
  state: 'success',
  summary: { attempts: 86, students: 86, completed: 81, pending_review: 5, questions: 860, answered: 823, unanswered: 37, correct: 592, incorrect: 231, score: 5920, max_score: 8100, participation_percentage: 94.19, average_time_seconds: 1460 },
  statistics: { n: 81, mean: 73.09, median: 75, minimum: 30, maximum: 100, standard_deviation: 14.82, variance: 219.63 },
  proficiency: [{ code: 'below', label: 'Abaixo do Básico', count: 8, percentage: 9.88 }, { code: 'basic', label: 'Básico', count: 17, percentage: 20.99 }, { code: 'adequate', label: 'Adequado', count: 39, percentage: 48.15 }, { code: 'advanced', label: 'Avançado', count: 17, percentage: 20.99 }],
  skills: [{ skill_id: 'demo-1', code: 'DEMO-H01', description: 'Resolver problemas com números naturais', students_evaluated: 81, item_count: 162, answered: 158, correct: 121, incorrect: 37, percentage: 76.58 }, { skill_id: 'demo-2', code: 'DEMO-H02', description: 'Interpretar informações em tabelas', students_evaluated: 81, item_count: 162, answered: 154, correct: 96, incorrect: 58, percentage: 62.34 }],
  students: [],
  evolution: [{ assessment_id: 'demo-a', assessment_title: 'Diagnóstica', performed_at: '2026-03-01', percentage: 58, observations: 81 }, { assessment_id: 'demo-b', assessment_title: 'Intermediária', performed_at: '2026-06-01', percentage: 67, observations: 81 }, { assessment_id: 'demo-c', assessment_title: 'Final', performed_at: '2026-09-01', percentage: 73.09, observations: 81 }],
  items: [{ item_id: 'demo-i1', statement: 'Questão DEMO com maior índice de erro', item_type: 'multiple_choice', responses: 79, correct: 31, incorrect: 48, omissions: 2, average_time_seconds: 82, difficulty_index: .3924, discrimination_index: .41, point_biserial: .37 }],
};

const number = (value: unknown, suffix = '') => value == null ? 'Indisponível' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
const statusLabel: Record<string,string> = { queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou' };

export function AnalyticsDashboard({ mode, networks = [], schools = [], classrooms = [], fixedNetworkId, fixedSchoolId, fixedClassroomId, preview = false }: AnalyticsDashboardProps) {
  const client = mode === 'student' ? studentSupabase : supabase;
  const api = client as unknown as { rpc<T>(name: string, args?: Record<string, unknown>): RpcResult<T> };
  const [networkId, setNetworkId] = useState(fixedNetworkId ?? networks[0]?.id ?? '');
  const [schoolId, setSchoolId] = useState(fixedSchoolId ?? '');
  const [classroomId, setClassroomId] = useState(fixedClassroomId ?? '');
  const [assessmentId, setAssessmentId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [cycles, setCycles] = useState<OptionRow[]>([]);
  const [subjects, setSubjects] = useState<OptionRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<OptionRow[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(preview ? previewData : null);
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [distractors, setDistractors] = useState<Distractor[]>([]);
  const [state, setState] = useState<'loading'|'empty'|'error'|'insufficient_data'|'success'>(preview ? 'success' : 'loading');
  const [message, setMessage] = useState(preview ? 'Visualização DEMO identificada. Dados reais aparecem após avaliações concluídas.' : '');
  const [batchBusy, setBatchBusy] = useState(false);
  const batchKeyRef = useRef<string | null>(null);

  const filters = useMemo(() => Object.fromEntries(Object.entries({ network_id: networkId || undefined, school_id: schoolId || undefined, classroom_id: classroomId || undefined, assessment_id: assessmentId || undefined, cycle_id: cycleId || undefined, subject_id: subjectId || undefined, curriculum_school_year_id: schoolYearId || undefined, skill_id: skillId || undefined }).filter(([, value]) => value)), [networkId, schoolId, classroomId, assessmentId, cycleId, subjectId, schoolYearId, skillId]);

  const load = useCallback(async () => {
    if (preview) return;
    setState('loading'); setMessage('');
    const [result, reliabilityResult, distractorResult] = await Promise.all([
      api.rpc<AnalyticsData>('get_analytics_dashboard', { filters }),
      assessmentId ? api.rpc<Reliability>('get_assessment_reliability', { target_assessment: assessmentId, filters }) : Promise.resolve({ data: null, error: null }),
      assessmentId ? api.rpc<Distractor[]>('get_item_option_distribution', { target_assessment: assessmentId, filters }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (result.error || !result.data) { setState('error'); setMessage(result.error?.message ?? 'Não foi possível carregar os indicadores.'); return; }
    setData(result.data); setReliability(reliabilityResult.data); setDistractors(distractorResult.data ?? []); setState(result.data.state as typeof state);
  }, [api, assessmentId, filters, preview]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (preview) return;
    void Promise.all([
      client.from('diagnostic_assessments').select('id,title,network_id,cycle_id,subject_id,curriculum_school_year_id').order('created_at', { ascending: false }),
      client.from('assessment_cycles').select('id,name,network_id').order('starts_at', { ascending: false }),
      client.from('curriculum_subjects').select('id,name').order('name'),
      client.from('curriculum_school_years').select('id,name').order('sort_order'),
    ]).then(([assessmentRows, cycleRows, subjectRows, yearRows]) => {
      setAssessments((assessmentRows.data ?? []) as Assessment[]);
      setCycles((cycleRows.data ?? []) as OptionRow[]);
      setSubjects((subjectRows.data ?? []) as OptionRow[]);
      setSchoolYears((yearRows.data ?? []) as OptionRow[]);
    });
  }, [client, preview]);
  useEffect(() => {
    if (preview || mode === 'student') return;
    void api.rpc<ReportJob[]>('list_analytics_report_jobs').then((result) => setJobs(result.data ?? []));
  }, [api, mode, preview]);
  useEffect(() => {
    if (preview || mode === 'student' || !jobs.some((job) => ['queued','processing'].includes(job.status))) return;
    const timer = window.setInterval(() => void api.rpc<ReportJob[]>('list_analytics_report_jobs').then((result) => setJobs(result.data ?? [])), 4_000);
    return () => window.clearInterval(timer);
  }, [api, jobs, mode, preview]);

  async function exportReport(format: 'pdf'|'docx'|'csv') {
    setMessage('Preparando relatório com a mesma fonte do dashboard…');
    const reportType = mode === 'student' ? 'student' : classroomId ? 'classroom' : schoolId ? 'school' : 'network';
    const result = await api.rpc<AnalyticsReportPayload>('get_analytics_report_data', { report_type: reportType, filters });
    if (result.error || !result.data) { setMessage(result.error?.message ?? 'Não foi possível gerar o relatório.'); return; }
    await exportAnalyticsReport(result.data, format);
    setMessage(`Relatório ${format.toUpperCase()} gerado com os indicadores exibidos.`);
  }

  async function queueBatch() {
    if (!networkId || !classroomId) { setMessage('Selecione uma rede e uma turma para gerar o lote.'); return; }
    setBatchBusy(true);
    batchKeyRef.current ??= crypto.randomUUID();
    const result = await api.rpc<string>('request_analytics_report', { report_type: 'student_batch', report_format: 'zip', filters, idempotency_key: batchKeyRef.current });
    if (result.error || !result.data) setMessage(result.error?.message ?? 'Não foi possível enfileirar o lote.');
    else {
      const invoked = await client.functions.invoke('analytics-report-worker', { body: { job_id: result.data } });
      setMessage(invoked.error ? 'Lote enfileirado; o worker será retomado com segurança.' : 'Lote em processamento no servidor.');
      const listed = await api.rpc<ReportJob[]>('list_analytics_report_jobs'); setJobs(listed.data ?? []);
      batchKeyRef.current = null;
    }
    setBatchBusy(false);
  }

  async function downloadBatch(job: ReportJob) {
    const result = await client.functions.invoke<{ signed_url: string }>('analytics-report-worker', { body: { job_id: job.id, action: 'download' } });
    if (result.error || !result.data?.signed_url) { setMessage('O arquivo privado não pôde ser liberado para download.'); return; }
    window.location.assign(result.data.signed_url);
  }

  async function retryBatch(job: ReportJob) {
    const retried = await api.rpc<null>('retry_analytics_report_job', { target_job: job.id });
    if (retried.error) { setMessage(retried.error.message); return; }
    const invoked = await client.functions.invoke('analytics-report-worker', { body: { job_id: job.id } });
    setMessage(invoked.error ? 'Retry enfileirado; o worker poderá ser chamado novamente.' : 'Nova tentativa iniciada.');
  }

  const summary = data?.summary ?? {};
  const filteredSchools = schools.filter((school) => !networkId || school.network_id === networkId);
  const filteredClasses = classrooms.filter((room) => (!schoolId || room.school_id === schoolId) && (!networkId || room.network_id === networkId));
  const availableAssessments = assessments.filter((assessment) => !networkId || assessment.network_id === networkId);
  const measurableSkills = [...(data?.skills ?? [])].filter((row) => row.percentage != null).sort((a,b) => Number(b.percentage)-Number(a.percentage));

  return <section className={`analytics-dashboard ${mode === 'student' ? 'student-analytics' : ''}`} aria-labelledby={`analytics-title-${mode}`}>
    <header className="analytics-head"><div><span><BarChart3 /> FASE 5 · DADOS REAIS</span><h2 id={`analytics-title-${mode}`}>{mode === 'student' ? 'Meu desempenho' : mode === 'teacher' ? 'Desempenho da turma' : 'Analytics educacionais'}</h2><p>Resultados consolidados no banco, com notas provisórias identificadas e isolamento institucional.</p></div><button onClick={() => void load()} disabled={state === 'loading'}><RefreshCw className={state === 'loading' ? 'spin' : ''} /> Atualizar</button></header>
    {mode !== 'student' && <div className="analytics-filters" aria-label="Filtros dos indicadores">
      {mode === 'institutional' && <><label>Rede<select value={networkId} onChange={(event) => { setNetworkId(event.target.value); setSchoolId(''); setClassroomId(''); }}><option value="">Todas autorizadas</option>{networks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Escola<select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setClassroomId(''); }}><option value="">Todas</option>{filteredSchools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Turma<select value={classroomId} onChange={(event) => setClassroomId(event.target.value)}><option value="">Todas</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
      <label>Avaliação<select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)}><option value="">Todas</option>{availableAssessments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Ciclo<select value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="">Todos</option>{cycles.filter((item) => !networkId || item.network_id === networkId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Série/ano<select value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Todas</option>{schoolYears.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Componente<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Todos</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {skillId && <button type="button" onClick={() => setSkillId('')}>Limpar habilidade</button>}
    </div>}
    {preview && <output className="analytics-demo-note">DEMO visual · números ilustrativos, claramente separados do modo conectado.</output>}
    {message && <output className="analytics-message" aria-live="polite">{message}</output>}
    {state === 'loading' && <div className="analytics-state"><LoaderCircle className="spin" /><strong>Calculando indicadores no servidor…</strong></div>}
    {state === 'error' && <div className="analytics-state error"><ShieldCheck /><strong>Não foi possível abrir este escopo</strong><p>{message}</p></div>}
    {state === 'empty' && <div className="analytics-state"><BarChart3 /><strong>Nenhum resultado disponível</strong><p>Conclua uma avaliação neste escopo para gerar indicadores.</p></div>}
    {state !== 'loading' && state !== 'error' && state !== 'empty' && data && <>
      {state === 'insufficient_data' && <div className="analytics-state insufficient"><ShieldCheck /><strong>Sem dados suficientes</strong><p>Os totais podem ser consultados, mas médias e psicometria exigem uma amostra válida.</p></div>}
      <div className="analytics-kpis">
        <article><Users /><span>Participação</span><strong>{number(summary.participation_percentage, '%')}</strong><small>{number(summary.completed)} concluídas</small></article>
        <article><TrendingUp /><span>Desempenho médio</span><strong>{number(data.statistics?.mean, '%')}</strong><small>mediana {number(data.statistics?.median, '%')}</small></article>
        <article><BarChart3 /><span>Respondidas</span><strong>{number(summary.answered)}</strong><small>{number(summary.unanswered)} omissões</small></article>
        <article><ShieldCheck /><span>Proficiência</span><strong>{number(data.proficiency?.reduce((sum, item) => sum + Number(item.count ?? 0), 0))}</strong><small>{number(summary.pending_review)} provisórias</small></article>
      </div>
      <div className="analytics-chart-grid">
        <figure><figcaption><strong>Distribuição de proficiência</strong><span>Quantidade por nível, além da tabela textual.</span></figcaption><div className="analytics-chart" role="img" aria-label="Gráfico de barras da distribuição de proficiência"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.proficiency}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="count" name="Estudantes" fill="#6542d7" /></BarChart></ResponsiveContainer></div><table><thead><tr><th>Nível</th><th>Estudantes</th><th>Percentual</th></tr></thead><tbody>{data.proficiency?.map((row) => <tr key={String(row.code)}><td><i className={`level level-${row.code}`} />{row.label}</td><td>{row.count}</td><td>{number(row.percentage, '%')}</td></tr>)}</tbody></table></figure>
        <figure><figcaption><strong>Evolução</strong><span>Médias comparáveis por avaliação e ordem temporal.</span></figcaption>{data.comparison?.compatible === false ? <div className="analytics-state insufficient"><ShieldCheck /><strong>Comparação incompatível</strong><p>{data.comparison.message}</p></div> : <><div className="analytics-chart" role="img" aria-label="Gráfico de linha da evolução das avaliações"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.evolution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="assessment_title" /><YAxis domain={[0,100]} /><Tooltip /><Legend /><Line type="monotone" dataKey="percentage" name="Acerto (%)" stroke="#0d8a70" strokeWidth={3} /></LineChart></ResponsiveContainer></div><table><thead><tr><th>Avaliação</th><th>Resultado</th><th>Variação</th><th>Proficiência</th><th>Amostra</th></tr></thead><tbody>{data.evolution?.map((row) => <tr key={String(row.assessment_id)}><td>{row.assessment_title}</td><td>{number(row.percentage, '%')}</td><td>{row.previous_percentage == null ? 'Base' : `${number(row.absolute_difference)} p.p. (${number(row.percentage_difference, '%')})`}</td><td>{row.proficiency_label ?? 'Distribuição do grupo'}</td><td>{number(row.observations)}</td></tr>)}</tbody></table></>}</figure>
      </div>
      <div className="analytics-table-card"><div><span>DESEMPENHO CURRICULAR</span><h3>Habilidades</h3></div>{data.skills?.length ? <table><thead><tr><th>Habilidade</th><th>Alunos</th><th>Itens</th><th>Acertos</th><th>Resultado</th><th></th></tr></thead><tbody>{data.skills.map((row) => <tr key={String(row.skill_id)}><td><strong>{row.code}</strong><small>{row.description}</small></td><td>{row.students_evaluated}</td><td>{row.item_count}</td><td>{row.correct}</td><td>{number(row.percentage, '%')}</td><td><button onClick={() => setSkillId(String(row.skill_id))}>Detalhar</button></td></tr>)}</tbody></table> : <p>Sem dados suficientes para habilidades.</p>}</div>
      {data.curriculum?.length ? <div className="analytics-table-card"><div><span>COMPONENTE → UNIDADE → OBJETO</span><h3>Leitura curricular consolidada</h3></div><table><thead><tr><th>Dimensão</th><th>Referência</th><th>Alunos</th><th>Itens</th><th>Resultado</th></tr></thead><tbody>{data.curriculum.map((row) => <tr key={`${row.dimension}-${row.id}`}><td>{row.dimension}</td><td>{row.label}</td><td>{row.students_evaluated}</td><td>{row.item_count}</td><td>{number(row.percentage,'%')}</td></tr>)}</tbody></table></div> : null}
      {mode === 'student' && measurableSkills.length > 0 && <div className="analytics-insights"><article><strong>Ponto forte</strong><span>{measurableSkills[0].code} · {number(measurableSkills[0].percentage,'%')}</span></article><article><strong>Precisa de atenção</strong><span>{measurableSkills.at(-1)?.code} · {number(measurableSkills.at(-1)?.percentage,'%')}</span></article></div>}
      {mode !== 'student' && <div className="analytics-table-card"><div><span>DRILL-DOWN</span><h3>Resultados por estudante</h3></div>{data.students?.length ? <table><thead><tr><th>Estudante</th><th>Turma</th><th>Status</th><th>Respondidas</th><th>Resultado</th></tr></thead><tbody>{data.students.map((row) => <tr key={String(row.attempt_id)}><td>{row.student_name}</td><td>{row.classroom_name}</td><td>{row.has_pending_review ? 'Provisório' : row.status}</td><td>{row.answered_questions}/{row.total_questions}</td><td>{number(row.percentage, '%')}</td></tr>)}</tbody></table> : <p>Sem estudantes neste filtro.</p>}</div>}
      <div className="analytics-table-card"><div><span>PSICOMETRIA</span><h3>Questões</h3></div>{data.items?.length ? <table><thead><tr><th>Questão</th><th>Respostas</th><th>Dificuldade</th><th>Discriminação</th><th>Ponto-bisserial</th><th>Tempo médio</th></tr></thead><tbody>{data.items.map((row) => <tr key={String(row.item_id)}><td>{row.statement}</td><td>{row.responses}</td><td>{number(row.difficulty_index)}</td><td>{number(row.discrimination_index)}</td><td>{number(row.point_biserial)}</td><td>{number(row.average_time_seconds, ' s')}</td></tr>)}</tbody></table> : <p>Sem dados suficientes para psicometria.</p>}</div>
      {assessmentId && <div className="analytics-table-card"><div><span>CONSISTÊNCIA E DISTRATORES</span><h3>Alfa de Cronbach: {reliability?.available ? number(reliability.cronbach_alpha) : 'Indisponível'}</h3><p>{reliability?.available ? `${number(reliability.participants)} participantes · ${number(reliability.items)} itens objetivos` : 'A métrica exige pelo menos dois itens, três participantes e variância válida.'}</p></div>{distractors.length ? <table><thead><tr><th>Questão</th><th>Alternativa</th><th>Escolhas</th><th>Percentual</th></tr></thead><tbody>{distractors.map((row) => <tr key={`${row.item_id}-${row.option_id}`}><td>{row.statement}</td><td>{row.label} · {row.content}</td><td>{row.selected}</td><td>{number(row.percentage,'%')}</td></tr>)}</tbody></table> : <p>Sem distribuição de alternativas para esta avaliação.</p>}</div>}
      <div className="analytics-report-actions"><div><span>RELATÓRIOS</span><h3>Exportar esta mesma visão</h3><p>PDF, DOCX e CSV usam o mesmo payload versionado do dashboard.</p></div><button onClick={() => void exportReport('pdf')}><Download /> PDF</button><button onClick={() => void exportReport('docx')}><FileText /> DOCX</button><button onClick={() => void exportReport('csv')}><Download /> CSV</button>{mode !== 'student' && <button disabled={batchBusy} onClick={() => void queueBatch()}>{batchBusy ? <LoaderCircle className="spin" /> : <FileArchive />} Lote ZIP</button>}</div>
      {jobs.length > 0 && <div className="analytics-jobs" aria-label="Geração de relatórios em lote">{jobs.map((job) => <article key={job.id}><FileArchive /><span><strong>{job.report_type} · {job.format.toUpperCase()}</strong><small>{statusLabel[job.status] ?? job.status}</small></span><progress value={job.progress} max="100">{job.progress}%</progress>{job.status === 'completed' && <button onClick={() => void downloadBatch(job)}><Download /> Baixar</button>}{job.status === 'failed' && <button onClick={() => void retryBatch(job)}><RefreshCw /> Tentar novamente</button>}</article>)}</div>}
    </>}
  </section>;
}
