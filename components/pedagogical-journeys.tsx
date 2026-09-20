'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { studentSupabase, supabase } from '@/lib/supabase';
import {
  exportPedagogyReport,
  type PedagogyReport,
  type PedagogyReportFormat,
} from '@/lib/pedagogy-report-export';

type Mode = 'student' | 'teacher' | 'institutional';
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Phase7Api = { rpc<T>(name: string, args?: Record<string, unknown>): RpcResult<T> };
type Journey = {
  id: string;
  title: string;
  description: string;
  skill_id: string | null;
  difficulty?: string;
  estimated_minutes?: number | null;
  mastery_threshold?: number;
  step_count?: number;
};
type StudentStep = {
  id: string;
  title: string;
  instructions: string;
  step_type: string;
  position: number;
  required: boolean;
  pedagogical_points: number;
  gamification_points: number;
  status: 'not_started' | 'in_progress' | 'completed';
  response_type?: 'acknowledgement' | 'single_choice' | 'short_text' | 'teacher_review' | 'assessment' | null;
  prompt?: string | null;
  options?: string[];
};
type StudentJourney = Journey & {
  assignment_id: string;
  journey_id: string;
  status: string;
  progress_percentage: number;
  gamification_points: number;
  due_at: string | null;
  steps: StudentStep[];
};
type Dashboard = {
  state: 'empty' | 'success';
  summary: {
    students: number;
    assignments: number;
    in_progress: number;
    completed: number;
    average_progress: number | null;
    gamification_points: number;
  };
  students: Array<{
    assignment_id: string;
    student_id: string;
    journey: string;
    status: string;
    progress_percentage: number;
    gamification_points: number;
  }>;
};
type Portfolio = {
  journeys: unknown[];
  evidence: unknown[];
  assessments: unknown[];
  fluency: unknown[];
};

const demoJourneys: Journey[] = [
  { id: 'demo-journey-1', title: 'Reconstruindo estratégias de cálculo', description: 'Uma sequência curta com explicação, prática guiada e reavaliação.', skill_id: 'demo-2', difficulty: 'adaptive', estimated_minutes: 35, mastery_threshold: 70, step_count: 3 },
  { id: 'demo-journey-2', title: 'Ler, localizar e relacionar informações', description: 'Leitura orientada com pistas graduais e atividade de síntese.', skill_id: 'demo-1', difficulty: 'introductory', estimated_minutes: 25, mastery_threshold: 70, step_count: 3 },
];
const demoStudentJourneys: StudentJourney[] = [{
  ...demoJourneys[0], assignment_id: 'demo-assignment', journey_id: 'demo-journey-1', status: 'in_progress', progress_percentage: 33.33, gamification_points: 10, due_at: '2026-09-20T23:59:00Z',
  steps: [
    { id: 'demo-step-1', title: 'Retomar a estratégia', instructions: 'Leia o exemplo e identifique as etapas do cálculo.', step_type: 'content', position: 1, required: true, pedagogical_points: 0, gamification_points: 10, status: 'completed' },
    { id: 'demo-step-2', title: 'Praticar com apoio', instructions: 'Resolva os exercícios usando as pistas quando precisar.', step_type: 'exercise', position: 2, required: true, pedagogical_points: 10, gamification_points: 15, status: 'in_progress', response_type: 'single_choice', prompt: 'Qual estratégia decompõe 27 + 15 corretamente?', options: ['20 + 10 + 7 + 5', '27 + 10 + 15', '20 + 7 + 5'] },
    { id: 'demo-step-3', title: 'Verificar o que aprendeu', instructions: 'Faça a atividade final para registrar sua evolução.', step_type: 'reassessment', position: 3, required: true, pedagogical_points: 20, gamification_points: 20, status: 'not_started', response_type: 'assessment', prompt: 'Conclua a reavaliação vinculada.' },
  ],
}];
const demoDashboard: Dashboard = { state: 'success', summary: { students: 24, assignments: 24, in_progress: 18, completed: 6, average_progress: 57.64, gamification_points: 385 }, students: [] };

export function PedagogicalJourneys({ mode, networkId, schoolId, classroomId, skillId, preview = false }: { mode: Mode; networkId?: string | null; schoolId?: string | null; classroomId?: string | null; skillId?: string | null; preview?: boolean }) {
  const client = mode === 'student' ? studentSupabase : supabase;
  const api = client as unknown as Phase7Api;
  const [catalog, setCatalog] = useState<Journey[]>(preview ? demoJourneys : []);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(preview ? demoJourneys.length : 0);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogDifficulty, setCatalogDifficulty] = useState('');
  const [studentJourneys, setStudentJourneys] = useState<StudentJourney[]>(preview && mode === 'student' ? demoStudentJourneys : []);
  const [dashboard, setDashboard] = useState<Dashboard | null>(preview && mode !== 'student' ? demoDashboard : null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(preview && mode === 'student' ? { journeys: demoStudentJourneys, evidence: [], assessments: [{ id: 'demo' }], fluency: [] } : null);
  const [selectedJourney, setSelectedJourney] = useState(preview ? demoJourneys[0].id : '');
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'success'>(preview ? 'success' : 'loading');
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const requestKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (preview) return;
    setState('loading'); setMessage('');
    if (mode === 'student') {
      const [result, portfolioResult] = await Promise.all([
        api.rpc<StudentJourney[]>('get_my_learning_journeys'),
        api.rpc<Portfolio>('get_student_pedagogical_portfolio', { target_student: null }),
      ]);
      if (result.error || portfolioResult.error) { setState('error'); setMessage(result.error?.message ?? portfolioResult.error?.message ?? 'Não foi possível abrir o portfólio.'); return; }
      setStudentJourneys(result.data ?? []); setPortfolio(portfolioResult.data); setState(result.data?.length ? 'success' : 'empty'); return;
    }
    if (!networkId) { setState('empty'); return; }
    const filters = Object.fromEntries(Object.entries({ network_id: networkId, school_id: schoolId || undefined, classroom_id: classroomId || undefined, skill_id: skillId || undefined }).filter(([, value]) => value));
    const catalogFilters = Object.fromEntries(Object.entries({ skill_id: skillId || undefined, query: catalogQuery.trim() || undefined, difficulty: catalogDifficulty || undefined }).filter(([, value]) => value));
    const [catalogResult, dashboardResult] = await Promise.all([
      api.rpc<{ journeys: Journey[]; total: number }>('search_pedagogical_catalog', { target_network: networkId, filters: catalogFilters, page: catalogPage, page_size: 24 }),
      api.rpc<Dashboard>('get_pedagogical_dashboard', { filters }),
    ]);
    if (catalogResult.error || dashboardResult.error) { setState('error'); setMessage(catalogResult.error?.message ?? dashboardResult.error?.message ?? 'Não foi possível carregar as jornadas.'); return; }
    const journeys = catalogResult.data?.journeys ?? [];
    setCatalog(journeys); setCatalogTotal(catalogResult.data?.total ?? 0); setDashboard(dashboardResult.data);
    setSelectedJourney((current) => journeys.some((item) => item.id === current) ? current : journeys[0]?.id ?? '');
    setState(journeys.length || dashboardResult.data?.summary.assignments ? 'success' : 'empty');
  }, [api, catalogDifficulty, catalogPage, catalogQuery, classroomId, mode, networkId, preview, schoolId, skillId]);

  useEffect(() => { void load(); }, [load]);

  async function assignJourney() {
    if (!selectedJourney || !classroomId) { setMessage('Selecione uma jornada e uma turma.'); return; }
    if (preview) { setMessage('DEMO: jornada atribuída à turma para visualização.'); return; }
    requestKey.current ??= crypto.randomUUID();
    const result = await api.rpc<string>('assign_learning_journey', { target_journey: selectedJourney, target_classroom: classroomId, target_students: null, assignment_reason: skillId ? 'Intervenção a partir do desempenho da habilidade selecionada.' : 'Intervenção pedagógica definida pelo professor.', source_assessment: null, request_key: requestKey.current });
    if (result.error) { setMessage(result.error.message); return; }
    requestKey.current = null; await load(); setMessage('Jornada atribuída. Os estudantes já podem iniciar.');
  }

  async function completeStep(journey: StudentJourney, step: StudentStep) {
    const response: { choice?: string; text?: string; acknowledged?: boolean } = step.response_type === 'single_choice' ? { choice: responses[step.id] } : step.response_type === 'short_text' ? { text: responses[step.id] } : { acknowledged: true };
    if (step.response_type === 'single_choice' && !response.choice) { setMessage('Selecione uma resposta antes de concluir.'); return; }
    if (step.response_type === 'short_text' && !response.text?.trim()) { setMessage('Escreva sua resposta antes de concluir.'); return; }
    if (step.response_type === 'teacher_review') { setMessage('Esta etapa depende da validação do professor.'); return; }
    if (step.response_type === 'assessment' && preview) { setMessage('DEMO: faça a avaliação vinculada no modo conectado.'); return; }
    if (preview) {
      setStudentJourneys((items) => items.map((item) => item.assignment_id !== journey.assignment_id ? item : { ...item, steps: item.steps.map((candidate) => candidate.id === step.id ? { ...candidate, status: 'completed' } : candidate) }));
      setMessage('DEMO: progresso salvo. No modo conectado, o registro é persistido com idempotência.'); return;
    }
    const result = await api.rpc<{ progress_percentage: number }>('save_journey_step_progress', { target_assignment: journey.assignment_id, target_step: step.id, target_status: 'completed', response_payload: response, request_key: crypto.randomUUID() });
    if (result.error) {
      if (step.response_type === 'assessment') {
        setMessage('Conclua a avaliação vinculada nesta página e depois valide esta etapa. Avaliações com correção pendente ainda não são definitivas.');
        document.querySelector('.assessment-entry, .assessment-runtime')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else setMessage(result.error.message);
      return;
    }
    await load(); setMessage('Progresso salvo com segurança.');
  }

  async function exportReport(format: PedagogyReportFormat) {
    if (preview) { setMessage(`DEMO: relatório ${format.toUpperCase()} disponível no modo conectado.`); return; }
    const filters = Object.fromEntries(Object.entries({ network_id: networkId || undefined, school_id: schoolId || undefined, classroom_id: classroomId || undefined, skill_id: skillId || undefined }).filter(([, value]) => value));
    const result = await api.rpc<PedagogyReport>('get_pedagogical_report_data', { filters });
    if (result.error || !result.data) { setMessage(result.error?.message ?? 'Não foi possível gerar o relatório.'); return; }
    await exportPedagogyReport(result.data, format); setMessage(`Relatório ${format.toUpperCase()} gerado com a mesma fonte das jornadas.`);
  }

  const activeStudentJourney = studentJourneys[0];
  const nextStep = useMemo(() => activeStudentJourney?.steps.find((step) => step.status !== 'completed'), [activeStudentJourney]);
  const title = mode === 'student' ? 'Minha jornada de aprendizagem' : mode === 'teacher' ? 'Recomposição da turma' : 'Jornadas e intervenções';

  return <section id="remediation" className={`pedagogy-hub pedagogy-${mode}`} aria-labelledby={`pedagogy-title-${mode}`}>
    <header className="pedagogy-head"><div><span><Route /> FASE 7 · INTERVENÇÃO PEDAGÓGICA</span><h2 id={`pedagogy-title-${mode}`}>{title}</h2><p>{mode === 'student' ? 'Avance no seu ritmo. A jornada registra progresso sem rotular seu desempenho.' : 'Conecte diagnóstico, habilidade, intervenção e evolução observada.'}</p></div><button type="button" onClick={() => void load()} aria-label="Atualizar jornadas"><RefreshCw /> Atualizar</button></header>
    {preview && <output className="pedagogy-demo">DEMO visual · dados sintéticos identificados.</output>}
    {message && <output className="pedagogy-message" aria-live="polite">{message}</output>}
    {state === 'loading' && <div className="pedagogy-state"><LoaderCircle className="spin" /> Carregando intervenções autorizadas…</div>}
    {state === 'error' && <div className="pedagogy-state error"><ShieldCheck /> Acesso indisponível neste escopo.<small>{message}</small></div>}
    {state === 'empty' && <div className="pedagogy-state"><BookOpenCheck /> Nenhuma jornada disponível neste escopo.<small>Publique uma jornada validada ou atribua uma intervenção existente.</small></div>}
    {state === 'success' && mode === 'student' && activeStudentJourney && <>
      <div className="pedagogy-student-summary"><div><span>JORNADA ATUAL</span><h3>{activeStudentJourney.title}</h3><p>{activeStudentJourney.description}</p></div><div className="pedagogy-progress-ring" aria-label={`${activeStudentJourney.progress_percentage}% concluído`}><strong>{Math.round(activeStudentJourney.progress_percentage)}%</strong><small>concluído</small></div></div>
      <progress className="pedagogy-progress" value={activeStudentJourney.progress_percentage} max="100">{activeStudentJourney.progress_percentage}%</progress>
      <ol className="pedagogy-steps">{activeStudentJourney.steps.map((step) => <li key={step.id} className={step.status}><span>{step.status === 'completed' ? <CheckCircle2 /> : step.position}</span><div><small>{step.step_type}</small><strong>{step.title}</strong><p>{step.instructions}</p>{step.status !== 'completed' && step.prompt && <fieldset className="pedagogy-response"><legend>{step.prompt}</legend>{step.response_type === 'single_choice' && step.options?.map((option) => <label key={option}><input type="radio" name={`step-${step.id}`} value={option} checked={responses[step.id] === option} onChange={() => setResponses((current) => ({ ...current, [step.id]: option }))} /> {option}</label>)}{step.response_type === 'short_text' && <textarea aria-label="Resposta da atividade" value={responses[step.id] ?? ''} onChange={(event) => setResponses((current) => ({ ...current, [step.id]: event.target.value }))} />}</fieldset>}</div><button type="button" disabled={step.status === 'completed' || (step.id !== nextStep?.id)} onClick={() => void completeStep(activeStudentJourney, step)}>{step.status === 'completed' ? 'Concluída' : step.response_type === 'assessment' ? 'Validar reavaliação' : step.id === nextStep?.id ? 'Concluir etapa' : 'Bloqueada'} <ArrowRight /></button></li>)}</ol>
      <p className="pedagogy-points"><Sparkles /> {activeStudentJourney.gamification_points} pontos de participação. Eles são separados do resultado pedagógico.</p>
      <div className="pedagogy-portfolio"><BookOpenCheck /><div><span>MEU PORTFÓLIO</span><strong>{portfolio?.journeys.length ?? 0} jornada(s) · {portfolio?.assessments.length ?? 0} avaliação(ões)</strong><small>Histórico de atividades, evidências, feedbacks e fluência no mesmo escopo protegido.</small></div></div>
    </>}
    {state === 'success' && mode !== 'student' && <>
      <div className="pedagogy-kpis"><article><Users /><span>Estudantes</span><strong>{dashboard?.summary.students ?? 0}</strong></article><article><Route /><span>Em andamento</span><strong>{dashboard?.summary.in_progress ?? 0}</strong></article><article><CheckCircle2 /><span>Concluídas</span><strong>{dashboard?.summary.completed ?? 0}</strong></article><article><Target /><span>Progresso médio</span><strong>{dashboard?.summary.average_progress == null ? 'Sem dados' : `${Number(dashboard.summary.average_progress).toLocaleString('pt-BR')}%`}</strong></article></div>
      <div className="pedagogy-assign"><div><span>ATRIBUIR INTERVENÇÃO</span><h3>{skillId ? 'Jornadas da habilidade selecionada' : 'Catálogo publicado'}</h3><p>A atribuição usa a turma selecionada e é validada novamente pelo banco.</p></div><label>Jornada<select value={selectedJourney} onChange={(event) => setSelectedJourney(event.target.value)}><option value="">Selecione</option>{catalog.map((journey) => <option key={journey.id} value={journey.id}>{journey.title}</option>)}</select></label><button type="button" onClick={() => void assignJourney()} disabled={!selectedJourney || !classroomId}><BookOpenCheck /> Atribuir à turma</button></div>
      <div className="pedagogy-catalog-controls"><label>Buscar jornadas<input type="search" value={catalogQuery} onChange={(event) => { setCatalogPage(1); setCatalogQuery(event.target.value); }} placeholder="Título da jornada" /></label><label>Dificuldade<select value={catalogDifficulty} onChange={(event) => { setCatalogPage(1); setCatalogDifficulty(event.target.value); }}><option value="">Todas</option><option value="introductory">Introdução</option><option value="easy">Fácil</option><option value="medium">Média</option><option value="advanced">Avançada</option><option value="adaptive">Adaptativa</option></select></label></div>
      {catalogTotal === 0 && <p className="pedagogy-catalog-empty">Nenhuma jornada publicada corresponde aos filtros.</p>}
      <div className="pedagogy-catalog">{catalog.map((journey) => <article key={journey.id}><span>{journey.difficulty === 'introductory' ? 'Introdução' : journey.difficulty ?? 'Adaptativa'}</span><h3>{journey.title}</h3><p>{journey.description}</p><footer><small>{journey.step_count ?? 0} etapas</small><small>{journey.estimated_minutes ?? '—'} min</small><small>Domínio {journey.mastery_threshold ?? 70}%</small></footer></article>)}</div>
      <nav className="pedagogy-catalog-pages" aria-label="Páginas do catálogo"><span>{catalogTotal} jornada(s) · página {catalogPage} de {Math.max(1, Math.ceil(catalogTotal / 24))}</span><button type="button" disabled={preview || catalogPage <= 1} onClick={() => setCatalogPage((page) => page - 1)}>Anterior</button><button type="button" disabled={preview || catalogPage * 24 >= catalogTotal} onClick={() => setCatalogPage((page) => page + 1)}>Próxima</button></nav>
      <div className="pedagogy-reports"><div><span>RELATÓRIOS PEDAGÓGICOS</span><strong>Atribuições, progresso, habilidades e evolução observada</strong></div><button type="button" onClick={() => void exportReport('pdf')}><Download /> PDF</button><button type="button" onClick={() => void exportReport('docx')}><FileText /> DOCX</button><button type="button" onClick={() => void exportReport('csv')}><Download /> CSV</button></div>
    </>}
  </section>;
}
