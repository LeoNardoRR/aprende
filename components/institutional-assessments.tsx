'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, BookCopy, CalendarDays,
  CheckCircle2, ClipboardList, Clock3, Layers3, Plus, RefreshCw, Rocket, Search,
  ShieldCheck, School2, Table2, Trash2, Users,
} from 'lucide-react';
import type { Database, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { InstitutionalProfile } from '@/components/institutional-admin';
import { AssessmentApplicationMonitor } from '@/components/assessment-application-monitor';
import { AssessmentPrintCenter } from '@/components/assessment-print-center';
import type { AssessmentPrintPayload } from '@/lib/assessment-printing';

type View = 'cycles' | 'assessments' | 'booklets' | 'calendar' | 'applications' | 'print';
type CalendarMode = 'month' | 'week' | 'day';
type Cycle = Tables<'assessment_cycles'>;
type Assessment = Tables<'diagnostic_assessments'>;
type Booklet = Tables<'assessment_booklets'>;
type Schedule = Tables<'assessment_schedules'>;
type Curriculum = Tables<'curricula'>;
type Subject = Tables<'curriculum_subjects'>;
type CurriculumYear = Tables<'curriculum_school_years'>;
type Network = Tables<'networks'>;
type School = Tables<'schools'>;
type Classroom = Tables<'classrooms'>;
type CurriculumMapRow = Database['public']['Functions']['assessment_curriculum_map']['Returns'][number];

type CandidateItemRow = {
  item_id: string;
  internal_title: string;
  statement: string;
  item_type: string;
  difficulty: string;
  skill_code: string;
  skill_description: string;
};

type BookletItemRow = {
  link_id: string;
  item_id: string;
  position: number;
  points: number | string;
  internal_title: string;
  statement: string;
  item_type: string;
  difficulty: string;
  skill_code: string;
  version_number: number;
};

type ScheduledStudentRow = {
  schedule_id: string;
  assessment_id: string;
  assessment_title: string;
  school_id: string;
  school_name: string;
  classroom_id: string;
  classroom_name: string;
  student_id: string | null;
  student_name: string | null;
  starts_at: string;
  ends_at: string;
  schedule_status: string;
};

type RpcError = { message: string };
type RpcResponse<T> = { data: T | null; error: RpcError | null };
const phase3Supabase = supabase as unknown as {
  rpc<T>(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResponse<T>>;
};

const previewCycles: Cycle[] = [{ id: 'cycle-demo', network_id: 'network-preview', name: 'Diagnóstica Inicial 2026 - DEMO', description: 'Ciclo demonstrativo', starts_at: '2026-09-14T08:00:00Z', ends_at: '2026-09-30T18:00:00Z', status: 'draft', created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' }];
const previewAssessments: Assessment[] = [{ id: 'assessment-demo', cycle_id: 'cycle-demo', network_id: 'network-preview', curriculum_id: 'curriculum-custom', subject_id: 'subject-demo', curriculum_school_year_id: 'year-demo', title: 'Matemática - 6º ano - DEMO', description: 'Avaliação demonstrativa', instructions: 'Leia cada questão e marque uma resposta.', total_points: 40, duration_minutes: 60, starts_at: null, ends_at: null, status: 'draft', randomize_questions: true, randomize_options: true, allow_back_navigation: true, created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' }];
const previewBooklets: Booklet[] = [{ id: 'booklet-demo', assessment_id: 'assessment-demo', network_id: 'network-preview', code: 'A', title: 'Caderno A', generation_strategy: 'manual', generation_seed: null, created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' }];
const previewCandidates: CandidateItemRow[] = [
  { item_id: 'item-1', internal_title: 'Frações equivalentes', statement: 'Qual fração é equivalente a 1/2?', item_type: 'multiple_choice', difficulty: 'medium', skill_code: 'DEMO-EF06MA07', skill_description: 'Resolver e comparar frações equivalentes.' },
  { item_id: 'item-2', internal_title: 'Leitura e inferência', statement: 'Identifique a informação implícita no trecho.', item_type: 'essay', difficulty: 'medium', skill_code: 'DEMO-EF67LP04', skill_description: 'Inferir informações implícitas em textos.' },
];
const previewBookletItems: BookletItemRow[] = [{ link_id: 'link-1', item_id: 'item-1', position: 1, points: 10, internal_title: 'Frações equivalentes', statement: 'Qual fração é equivalente a 1/2?', item_type: 'multiple_choice', difficulty: 'medium', skill_code: 'DEMO-EF06MA07', version_number: 3 }];
const previewMap: CurriculumMapRow[] = [{ skill_code: 'DEMO-EF06MA07', thematic_unit: 'Números', knowledge_object: 'Frações', difficulty: 'medium', item_count: 1, points: 10, percentage: 100 } as CurriculumMapRow];
const previewScheduled: ScheduledStudentRow[] = [
  { schedule_id: 'schedule-demo', assessment_id: 'assessment-demo', assessment_title: 'Matemática - 6º ano - DEMO', school_id: 'school-1', school_name: 'EM Prof. Miguel Jalbut', classroom_id: 'class-1', classroom_name: '6º A', student_id: 'student-1', student_name: 'Mariana Silva', starts_at: '2026-09-16T11:00:00Z', ends_at: '2026-09-16T13:00:00Z', schedule_status: 'scheduled' },
];

export function InstitutionalAssessments({ profile, networks, schools, classrooms, preview = false }: { profile: InstitutionalProfile; networks: Network[]; schools: School[]; classrooms: Classroom[]; preview?: boolean }) {
  const [view, setView] = useState<View>('cycles');
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [cycles, setCycles] = useState<Cycle[]>(preview ? previewCycles : []);
  const [assessments, setAssessments] = useState<Assessment[]>(preview ? previewAssessments : []);
  const [booklets, setBooklets] = useState<Booklet[]>(preview ? previewBooklets : []);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<CurriculumYear[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState(previewAssessments[0]?.id ?? '');
  const [selectedBooklet, setSelectedBooklet] = useState(previewBooklets[0]?.id ?? '');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateItems, setCandidateItems] = useState<CandidateItemRow[]>(preview ? previewCandidates : []);
  const [bookletItems, setBookletItems] = useState<BookletItemRow[]>(preview ? previewBookletItems : []);
  const [curriculumMap, setCurriculumMap] = useState<CurriculumMapRow[]>(preview ? previewMap : []);
  const [scheduledStudents, setScheduledStudents] = useState<ScheduledStudentRow[]>(preview ? previewScheduled : []);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [form, setForm] = useState<'cycle' | 'assessment' | 'schedule' | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [printClassroom, setPrintClassroom] = useState('');
  const [printPayload, setPrintPayload] = useState<AssessmentPrintPayload | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  useEffect(() => { if (!networkId && networks[0]?.id) setNetworkId(networks[0].id); }, [networkId, networks]);

  const load = useCallback(async () => {
    if (preview || !networkId) return;
    const [cycleResult, assessmentResult, bookletResult, scheduleResult, curriculumResult] = await Promise.all([
      supabase.from('assessment_cycles').select('*').eq('network_id', networkId).order('starts_at', { ascending: false }),
      supabase.from('diagnostic_assessments').select('*').eq('network_id', networkId).order('created_at', { ascending: false }),
      supabase.from('assessment_booklets').select('*').eq('network_id', networkId).order('code'),
      supabase.from('assessment_schedules').select('*').eq('network_id', networkId).order('starts_at'),
      supabase.from('curricula').select('*').or(`network_id.is.null,network_id.eq.${networkId}`).eq('active', true).order('name'),
    ]);
    const error = [cycleResult, assessmentResult, bookletResult, scheduleResult, curriculumResult].find((result) => result.error)?.error;
    if (error) setNotice(`Não foi possível carregar as avaliações: ${error.message}`);
    setCycles(cycleResult.data ?? []);
    setAssessments(assessmentResult.data ?? []);
    setBooklets(bookletResult.data ?? []);
    setSchedules(scheduleResult.data ?? []);
    setCurricula(curriculumResult.data ?? []);
    setSelectedAssessment((current) => current && assessmentResult.data?.some((item) => item.id === current) ? current : assessmentResult.data?.[0]?.id ?? '');
  }, [networkId, preview]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const curriculumId = assessments.find((assessment) => assessment.id === selectedAssessment)?.curriculum_id ?? curricula[0]?.id;
    if (preview || !curriculumId) return;
    void Promise.all([
      supabase.from('curriculum_subjects').select('*').eq('curriculum_id', curriculumId).order('name'),
      supabase.from('curriculum_school_years').select('*').eq('curriculum_id', curriculumId).order('sort_order'),
    ]).then(([subjectResult, yearResult]) => { setSubjects(subjectResult.data ?? []); setYears(yearResult.data ?? []); });
  }, [assessments, curricula, preview, selectedAssessment]);

  const selected = assessments.find((assessment) => assessment.id === selectedAssessment);
  const selectedBooklets = useMemo(() => booklets.filter((booklet) => booklet.assessment_id === selectedAssessment), [booklets, selectedAssessment]);
  const printClassrooms = useMemo(() => classrooms.filter((classroom) => classroom.network_id === networkId), [classrooms, networkId]);

  useEffect(() => {
    if (!printClassrooms.some((classroom) => classroom.id === printClassroom))
      setPrintClassroom(printClassrooms[0]?.id ?? '');
  }, [printClassroom, printClassrooms]);

  useEffect(() => {
    setPrintPayload(null);
    if (view !== 'print' || !selectedBooklet || !printClassroom) return;
    if (preview) {
      const classroom = printClassrooms.find((item) => item.id === printClassroom);
      const school = schools.find((item) => item.id === classroom?.school_id);
      setPrintPayload({
        assessmentId: selectedAssessment, assessmentTitle: selected?.title ?? 'Avaliação DEMO',
        component: 'Matemática', instructions: selected?.instructions ?? '',
        schoolId: school?.id ?? 'school-1', schoolName: school?.name ?? 'Escola demonstrativa',
        classroomId: printClassroom, classroomName: classroom?.name ?? '6º A', bookletCode: 'A',
        questions: [{ id: 'item-1', position: 1, statement: 'Qual fração é equivalente a 1/2?', type: 'multiple_choice', options: [{ id: 'a', label: 'A', text: '2/4', correct: true }, { id: 'b', label: 'B', text: '1/4' }], correctAnswer: 'A' }],
        students: [{ id: 'student-1', name: 'Mariana Silva' }],
      });
      return;
    }
    let active = true;
    setPrintLoading(true);
    void phase3Supabase.rpc<AssessmentPrintPayload>('get_assessment_print_payload', {
      target_booklet: selectedBooklet, target_classroom: printClassroom,
    }).then((result) => {
      if (!active) return;
      setPrintLoading(false);
      if (result.error) setNotice(`Não foi possível preparar a impressão: ${result.error.message}`);
      else setPrintPayload(result.data);
    });
    return () => { active = false; };
  }, [view, selectedBooklet, printClassroom, preview, printClassrooms, schools, selectedAssessment, selected?.title, selected?.instructions]);

  useEffect(() => {
    if (!selectedBooklets.some((booklet) => booklet.id === selectedBooklet)) setSelectedBooklet(selectedBooklets[0]?.id ?? '');
  }, [selectedBooklet, selectedBooklets]);

  const loadBookletWorkspace = useCallback(async () => {
    if (preview || !selectedAssessment) return;
    const candidatePromise = phase3Supabase.rpc<CandidateItemRow[]>('list_assessment_item_candidates', {
      target_assessment: selectedAssessment,
      search_query: candidateSearch,
      page_size: 100,
    });
    const mapPromise = supabase.rpc('assessment_curriculum_map', { target_assessment: selectedAssessment });
    const bookletPromise = selectedBooklet
      ? phase3Supabase.rpc<BookletItemRow[]>('list_assessment_booklet_items', { target_booklet: selectedBooklet })
      : Promise.resolve({ data: [] as BookletItemRow[], error: null });
    const [candidateResult, mapResult, bookletResult] = await Promise.all([candidatePromise, mapPromise, bookletPromise]);
    const error = candidateResult.error ?? mapResult.error ?? bookletResult.error;
    if (error) setNotice(`Não foi possível carregar o construtor: ${error.message}`);
    setCandidateItems(candidateResult.data ?? []);
    setCurriculumMap(mapResult.data ?? []);
    setBookletItems(bookletResult.data ?? []);
  }, [candidateSearch, preview, selectedAssessment, selectedBooklet]);

  useEffect(() => {
    if (view === 'booklets') void loadBookletWorkspace();
  }, [loadBookletWorkspace, view]);

  const loadScheduledStudents = useCallback(async () => {
    if (preview || !networkId) return;
    const result = await phase3Supabase.rpc<ScheduledStudentRow[]>('list_scheduled_assessment_students', {
      target_network: networkId,
      target_assessment: selectedAssessment || null,
    });
    if (result.error) setNotice(`Não foi possível carregar os alunos programados: ${result.error.message}`);
    setScheduledStudents(result.data ?? []);
  }, [networkId, preview, selectedAssessment]);

  useEffect(() => {
    if (view === 'applications') void loadScheduledStudents();
  }, [loadScheduledStudents, view]);

  const mapSummary = useMemo(() => ({
    booklets: selectedBooklets.length,
    points: Number(selected?.total_points ?? 0),
    skills: new Set(curriculumMap.map((row) => row.skill_code)).size,
  }), [curriculumMap, selected?.total_points, selectedBooklets.length]);

  const filteredScheduledStudents = useMemo(() => {
    const query = applicationSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return scheduledStudents;
    return scheduledStudents.filter((row) => [row.student_name, row.school_name, row.classroom_name, row.assessment_title].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)));
  }, [applicationSearch, scheduledStudents]);

  const applicationSummary = useMemo(() => ({
    classrooms: new Set(scheduledStudents.map((row) => row.classroom_id)).size,
    students: new Set(scheduledStudents.map((row) => row.student_id).filter(Boolean)).size,
    schedules: new Set(scheduledStudents.map((row) => row.schedule_id)).size,
  }), [scheduledStudents]);

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const payload = { network_id: networkId, name: String(values.get('name')).trim(), description: String(values.get('description')).trim() || null, starts_at: new Date(String(values.get('starts_at'))).toISOString(), ends_at: new Date(String(values.get('ends_at'))).toISOString(), created_by: profile.id };
    if (preview) setCycles((current) => [...current, { ...payload, id: crypto.randomUUID(), status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    else { const result = await supabase.from('assessment_cycles').insert(payload); if (result.error) setNotice(result.error.message); else await load(); }
    setBusy(false); setForm(null);
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const payload = { cycle_id: String(values.get('cycle_id')), network_id: networkId, curriculum_id: String(values.get('curriculum_id')), subject_id: String(values.get('subject_id')), curriculum_school_year_id: String(values.get('year_id')), title: String(values.get('title')).trim(), description: String(values.get('description')).trim() || null, instructions: String(values.get('instructions')).trim(), duration_minutes: Number(values.get('duration')), randomize_questions: values.get('randomize_questions') === 'on', randomize_options: values.get('randomize_options') === 'on', allow_back_navigation: values.get('allow_back_navigation') === 'on', created_by: profile.id };
    if (preview) setAssessments((current) => [...current, { ...payload, allow_back_navigation: true, id: crypto.randomUUID(), total_points: 0, starts_at: null, ends_at: null, status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    else { const result = await supabase.from('diagnostic_assessments').insert(payload); if (result.error) setNotice(result.error.message); else await load(); }
    setBusy(false); setForm(null);
  }

  async function createBooklet() {
    if (!selectedAssessment) return;
    setBusy(true); setNotice('');
    if (preview) {
      const code = String.fromCharCode(65 + selectedBooklets.length);
      const id = crypto.randomUUID();
      setBooklets((current) => [...current, { id, assessment_id: selectedAssessment, network_id: networkId, code, title: `Caderno ${code}`, generation_strategy: 'manual', generation_seed: null, created_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      setSelectedBooklet(id);
    } else {
      const result = await supabase.rpc('create_assessment_booklet', { target_assessment: selectedAssessment, booklet_title: null, strategy: 'manual', deterministic_seed: null });
      setNotice(result.error ? result.error.message : 'Caderno criado.');
      if (!result.error && result.data) { setSelectedBooklet(result.data); await load(); }
    }
    setBusy(false);
  }

  async function addItem(itemId: string) {
    if (!selectedBooklet || selected?.status !== 'draft') return;
    setBusy(true); setNotice('');
    if (preview) {
      const candidate = candidateItems.find((item) => item.item_id === itemId);
      if (candidate && !bookletItems.some((item) => item.item_id === itemId)) setBookletItems((current) => [...current, { ...candidate, link_id: crypto.randomUUID(), item_id: candidate.item_id, position: current.length + 1, points: 10, version_number: 1 }]);
    } else {
      const result = await supabase.rpc('add_approved_item_to_booklet', { target_booklet: selectedBooklet, target_item: itemId, target_position: bookletItems.length + 1, item_points: 10 });
      setNotice(result.error ? `Não foi possível adicionar o item: ${result.error.message}` : 'Item adicionado ao caderno.');
      if (!result.error) { await load(); await loadBookletWorkspace(); }
    }
    setBusy(false);
  }

  async function moveItem(linkId: string, direction: -1 | 1) {
    const index = bookletItems.findIndex((item) => item.link_id === linkId);
    const nextIndex = index + direction;
    if (!selectedBooklet || index < 0 || nextIndex < 0 || nextIndex >= bookletItems.length || selected?.status !== 'draft') return;
    const ordered = [...bookletItems];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    setBusy(true); setNotice('');
    if (preview) setBookletItems(ordered.map((item, itemIndex) => ({ ...item, position: itemIndex + 1 })));
    else {
      const result = await phase3Supabase.rpc<void>('reorder_assessment_booklet_items', { target_booklet: selectedBooklet, ordered_links: ordered.map((item) => item.link_id) });
      setNotice(result.error ? `Não foi possível reordenar: ${result.error.message}` : 'Ordem do caderno atualizada.');
      if (!result.error) await loadBookletWorkspace();
    }
    setBusy(false);
  }

  async function removeItem(linkId: string) {
    if (!selectedBooklet || selected?.status !== 'draft') return;
    setBusy(true); setNotice('');
    if (preview) setBookletItems((current) => current.filter((item) => item.link_id !== linkId).map((item, index) => ({ ...item, position: index + 1 })));
    else {
      const result = await phase3Supabase.rpc<void>('remove_assessment_booklet_item', { target_link: linkId });
      setNotice(result.error ? `Não foi possível remover: ${result.error.message}` : 'Item removido do caderno.');
      if (!result.error) { await load(); await loadBookletWorkspace(); }
    }
    setBusy(false);
  }

  async function markReady() {
    if (!selectedAssessment) return; setBusy(true);
    if (preview) setAssessments((current) => current.map((item) => item.id === selectedAssessment ? { ...item, status: 'ready' } : item));
    else { const result = await supabase.rpc('transition_diagnostic_assessment', { target_assessment: selectedAssessment, target_action: 'ready' }); setNotice(result.error ? `Validação recusada: ${result.error.message}` : 'Avaliação validada e pronta.'); if (!result.error) await load(); }
    setBusy(false);
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget); const classroomIds = values.getAll('classrooms').map(String);
    if (preview) setNotice('Agendamento DEMO validado sem gravar dados reais.');
    else { const result = await supabase.rpc('schedule_diagnostic_assessment', { target_assessment: selectedAssessment, target_school: String(values.get('school_id')), target_classrooms: classroomIds, window_starts_at: new Date(String(values.get('starts_at'))).toISOString(), window_ends_at: new Date(String(values.get('ends_at'))).toISOString() }); setNotice(result.error ? `Agendamento recusado: ${result.error.message}` : 'Avaliação programada para as turmas selecionadas.'); if (!result.error) await load(); }
    setBusy(false); setForm(null);
  }

  return <section id="assessments" className="institutional-pedagogy institutional-assessments">
    <div className="institutional-panel-head"><div><span>AVALIAÇÃO DIAGNÓSTICA</span><h2>Ciclos, provas e aplicações</h2><p>Banco de Itens → Avaliação → Cadernos → Validação → Programação → Aplicação → Resultados</p></div><ShieldCheck /></div>
    <div className="pedagogy-tabs" role="tablist" aria-label="Avaliações">{([['cycles','Ciclos'],['assessments','Provas'],['booklets','Cadernos'],['calendar','Calendário'],['applications','Aplicações'],['print','Impressão']] as const).map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
    <div className="pedagogy-toolbar"><label className="institutional-field compact"><span>Rede</span><select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label><div className="assessment-actions">{view === 'cycles' && <button onClick={() => setForm('cycle')}><Plus /> Novo ciclo</button>}{view === 'assessments' && <button onClick={() => setForm('assessment')}><Plus /> Nova avaliação</button>}{view === 'booklets' && <button disabled={!selectedAssessment || selectedBooklets.length >= 5 || busy || selected?.status !== 'draft'} onClick={() => void createBooklet()}><BookCopy /> Novo caderno</button>}{view === 'calendar' && <button disabled={!selectedAssessment || !['ready','scheduled'].includes(selected?.status ?? '')} onClick={() => setForm('schedule')}><CalendarDays /> Programar</button>}{view === 'applications' && <button disabled={busy} onClick={() => void loadScheduledStudents()}><RefreshCw /> Atualizar</button>}</div></div>
    {notice && <output className="institutional-notice">{notice}</output>}

    {view === 'cycles' && <div className="assessment-card-grid">{cycles.map((cycle) => <article key={cycle.id}><CalendarDays /><div><span>{cycle.status}</span><h3>{cycle.name}</h3><p>{formatWindow(cycle.starts_at, cycle.ends_at)}</p><small>{assessments.filter((assessment) => assessment.cycle_id === cycle.id).length} avaliações</small></div></article>)}</div>}

    {view === 'assessments' && <div className="assessment-card-grid">{assessments.map((assessment) => <button className={selectedAssessment === assessment.id ? 'selected' : ''} key={assessment.id} onClick={() => setSelectedAssessment(assessment.id)}><ClipboardList /><div><span>{assessment.status}</span><h3>{assessment.title}</h3><p>{assessment.duration_minutes} min · {assessment.total_points} pontos</p></div></button>)}</div>}

    {view === 'booklets' && <div className="phase3-booklet-workspace">
      <div className="assessment-map-summary"><article><Layers3 /><span>Cadernos</span><strong>{mapSummary.booklets}/5</strong></article><article><BarChart3 /><span>Pontuação</span><strong>{mapSummary.points}</strong></article><article><Table2 /><span>Habilidades</span><strong>{mapSummary.skills}</strong></article><article><CheckCircle2 /><span>Validação</span><strong>{selected?.status === 'ready' ? 'Pronta' : selected?.status === 'draft' ? 'Rascunho' : selected?.status ?? 'Pendente'}</strong></article><button disabled={!selectedAssessment || busy || selected?.status !== 'draft'} onClick={() => void markReady()}><Rocket /> Validar prova</button></div>
      <div className="phase3-booklet-tabs" aria-label="Cadernos da avaliação">{selectedBooklets.map((booklet) => <button key={booklet.id} type="button" aria-pressed={selectedBooklet === booklet.id} className={selectedBooklet === booklet.id ? 'active' : ''} onClick={() => setSelectedBooklet(booklet.id)}><strong>{booklet.title}</strong><small>{booklet.generation_strategy === 'manual' ? 'Ordem manual' : 'Ordem determinística'}</small></button>)}{!selectedBooklets.length && <div className="institutional-empty"><BookCopy /><h3>Nenhum caderno</h3><p>Crie o Caderno A para começar a montagem.</p></div>}</div>
      {selectedBooklet && <div className="phase3-builder-grid">
        <section className="phase3-builder-panel"><header><div><span>ITENS DO CADERNO</span><h3>Ordem de aplicação</h3></div><strong>{bookletItems.length} itens</strong></header>{bookletItems.length ? <ol className="phase3-booklet-items">{bookletItems.map((item, index) => <li key={item.link_id}><div className="phase3-item-order"><strong>{index + 1}</strong><div><button aria-label={`Mover ${item.internal_title} para cima`} disabled={busy || index === 0 || selected?.status !== 'draft'} onClick={() => void moveItem(item.link_id, -1)}><ArrowUp /></button><button aria-label={`Mover ${item.internal_title} para baixo`} disabled={busy || index === bookletItems.length - 1 || selected?.status !== 'draft'} onClick={() => void moveItem(item.link_id, 1)}><ArrowDown /></button></div></div><div className="phase3-item-copy"><span>{item.skill_code} · {difficultyLabel(item.difficulty)} · v{item.version_number}</span><strong>{item.internal_title}</strong><p>{item.statement}</p><small>{Number(item.points)} pontos</small></div><button className="phase3-danger-button" aria-label={`Remover ${item.internal_title}`} disabled={busy || selected?.status !== 'draft'} onClick={() => void removeItem(item.link_id)}><Trash2 /> Remover</button></li>)}</ol> : <div className="institutional-empty compact"><BookCopy /><h3>Caderno vazio</h3><p>Adicione itens aprovados do painel ao lado.</p></div>}</section>
        <section className="phase3-builder-panel"><header><div><span>BANCO APROVADO</span><h3>Selecionar itens</h3></div></header><label className="phase3-search"><Search /><input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Buscar item aprovado" aria-label="Buscar itens aprovados" /></label><div className="phase3-candidate-list">{candidateItems.map((item) => { const added = bookletItems.some((current) => current.item_id === item.item_id); return <article key={item.item_id}><div><span>{item.skill_code} · {difficultyLabel(item.difficulty)}</span><strong>{item.internal_title}</strong><p>{item.statement}</p><small>{item.skill_description}</small></div><button disabled={busy || added || selected?.status !== 'draft'} onClick={() => void addItem(item.item_id)}>{added ? <><CheckCircle2 /> Adicionado</> : <><Plus /> Adicionar</>}</button></article>; })}{!candidateItems.length && <div className="institutional-empty compact"><Search /><h3>Nenhum item elegível</h3><p>Apenas itens aprovados do mesmo currículo, componente e série aparecem aqui.</p></div>}</div></section>
      </div>}
      <section className="phase3-map"><header><div><span>MAPA CURRICULAR REAL</span><h3>Distribuição por habilidade</h3></div><button disabled={busy} onClick={() => void loadBookletWorkspace()}><RefreshCw /> Atualizar</button></header>{curriculumMap.length ? <><div className="phase3-map-bars">{curriculumMap.map((row, index) => <div key={`${row.skill_code}-${row.difficulty}-${index}`}><div><strong>{row.skill_code}</strong><small>{row.item_count} item(ns) · {row.points} pts</small></div><div className="phase3-map-track" aria-label={`${row.skill_code}: ${Number(row.percentage)}%`}><span style={{ width: `${Math.min(100, Math.max(0, Number(row.percentage)))}%` }} /></div><b>{Number(row.percentage).toFixed(1)}%</b></div>)}</div><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Habilidade</th><th>Unidade temática</th><th>Objeto</th><th>Dificuldade</th><th>Itens</th><th>Pontos</th><th>%</th></tr></thead><tbody>{curriculumMap.map((row, index) => <tr key={`${row.skill_code}-table-${index}`}><td><strong>{row.skill_code}</strong></td><td>{row.thematic_unit ?? '—'}</td><td>{row.knowledge_object ?? '—'}</td><td>{difficultyLabel(row.difficulty)}</td><td>{row.item_count}</td><td>{row.points}</td><td>{Number(row.percentage).toFixed(1)}%</td></tr>)}</tbody></table></div></> : <div className="institutional-empty"><BarChart3 /><h3>Mapa ainda vazio</h3><p>Adicione itens aprovados aos cadernos para visualizar a cobertura curricular.</p></div>}</section>
    </div>}

    {view === 'calendar' && <CalendarWorkspace schedules={schedules} assessments={assessments} schools={schools} mode={calendarMode} anchor={calendarAnchor} onMode={setCalendarMode} onAnchor={setCalendarAnchor} />}

    {view === 'applications' && <section className="phase3-applications"><div className="phase3-application-summary"><article><School2 /><span>Turmas programadas</span><strong>{applicationSummary.classrooms}</strong></article><article><Users /><span>Alunos programados</span><strong>{applicationSummary.students}</strong></article><article><Clock3 /><span>Janelas</span><strong>{applicationSummary.schedules}</strong></article></div><label className="phase3-search"><Search /><input value={applicationSearch} onChange={(event) => setApplicationSearch(event.target.value)} placeholder="Buscar aluno, turma ou escola" aria-label="Buscar alunos programados" /></label><div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Aluno</th><th>Escola / Turma</th><th>Avaliação</th><th>Janela</th><th>Status</th></tr></thead><tbody>{filteredScheduledStudents.map((row) => <tr key={`${row.schedule_id}-${row.classroom_id}-${row.student_id ?? 'empty'}`}><td><strong>{row.student_name ?? 'Nenhum aluno matriculado'}</strong></td><td>{row.school_name}<small>{row.classroom_name}</small></td><td>{row.assessment_title}</td><td>{formatWindow(row.starts_at, row.ends_at)}</td><td><span className={`institutional-status-pill ${scheduleVisualStatus(row)}`}>{scheduleStatusLabel(row)}</span></td></tr>)}</tbody></table>{!filteredScheduledStudents.length && <div className="institutional-table-empty"><Users /><p>Nenhum aluno programado para a avaliação selecionada.</p></div>}</div><AssessmentApplicationMonitor assessmentId={selectedAssessment} preview={preview} onNotice={setNotice} /></section>}

    {view === 'print' && <section className="phase3-applications"><div className="pedagogy-toolbar"><label className="institutional-field compact"><span>Avaliação</span><select value={selectedAssessment} onChange={(event) => setSelectedAssessment(event.target.value)}>{assessments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="institutional-field compact"><span>Caderno</span><select value={selectedBooklet} onChange={(event) => setSelectedBooklet(event.target.value)}>{selectedBooklets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="institutional-field compact"><span>Turma</span><select value={printClassroom} onChange={(event) => setPrintClassroom(event.target.value)}>{printClassrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{printLoading && <p role="status">Preparando documentos…</p>}{!printLoading && printPayload && (profile.role === 'network_admin' || profile.role === 'manager') && <AssessmentPrintCenter payload={printPayload} authorization={{ actorId: profile.id, role: profile.role, schoolIds: schools.map((item) => item.id), canViewPedagogy: true }} />}{!selectedBooklet && <p>Selecione uma avaliação com caderno para imprimir.</p>}</section>}

    {form && <div className="institutional-modal-backdrop"><section className="institutional-modal" role="dialog" aria-modal="true"><div><span>AVALIAÇÕES</span><h2>{form === 'cycle' ? 'Novo ciclo avaliativo' : form === 'assessment' ? 'Nova avaliação' : 'Programar aplicação'}</h2></div>{form === 'cycle' && <form onSubmit={createCycle}><Field name="name" label="Nome" /><Field name="description" label="Descrição" required={false} /><Field name="starts_at" label="Início" type="datetime-local" /><Field name="ends_at" label="Fim" type="datetime-local" /><Actions onCancel={() => setForm(null)} busy={busy} /></form>}{form === 'assessment' && <form onSubmit={createAssessment}><Select name="cycle_id" label="Ciclo" options={cycles.map((item) => [item.id,item.name])} /><Select name="curriculum_id" label="Currículo" options={curricula.map((item) => [item.id,item.name])} /><Select name="subject_id" label="Componente" options={subjects.map((item) => [item.id,item.name])} /><Select name="year_id" label="Série" options={years.map((item) => [item.id,item.name])} /><Field name="title" label="Título" /><Field name="description" label="Descrição" required={false} /><Field name="instructions" label="Instruções" /><Field name="duration" label="Duração em minutos" type="number" /><label className="check-row"><input name="randomize_questions" type="checkbox" /> Randomizar questões</label><label className="check-row"><input name="randomize_options" type="checkbox" /> Randomizar alternativas</label><label className="check-row"><input name="allow_back_navigation" type="checkbox" defaultChecked /> Permitir voltar às questões anteriores</label><Actions onCancel={() => setForm(null)} busy={busy} /></form>}{form === 'schedule' && <form onSubmit={createSchedule}><Select name="school_id" label="Escola" options={schools.filter((school) => school.network_id === networkId).map((item) => [item.id,item.name])} /><fieldset><legend>Turmas</legend>{classrooms.filter((item) => item.network_id === networkId).map((item) => <label className="check-row" key={item.id}><input name="classrooms" value={item.id} type="checkbox" /> {item.name}</label>)}</fieldset><Field name="starts_at" label="Abertura" type="datetime-local" /><Field name="ends_at" label="Encerramento" type="datetime-local" /><Actions onCancel={() => setForm(null)} busy={busy} /></form>}</section></div>}
  </section>;
}

function CalendarWorkspace({ schedules, assessments, schools, mode, anchor, onMode, onAnchor }: { schedules: Schedule[]; assessments: Assessment[]; schools: School[]; mode: CalendarMode; anchor: Date; onMode: (mode: CalendarMode) => void; onAnchor: (date: Date) => void }) {
  const days = calendarDays(anchor, mode);
  function shift(direction: -1 | 1) {
    const next = new Date(anchor);
    if (mode === 'month') next.setMonth(next.getMonth() + direction);
    else if (mode === 'week') next.setDate(next.getDate() + 7 * direction);
    else next.setDate(next.getDate() + direction);
    onAnchor(next);
  }
  return <section className="phase3-calendar"><header className="phase3-calendar-toolbar"><div><button aria-label="Período anterior" onClick={() => shift(-1)}><ArrowLeft /></button><button onClick={() => onAnchor(new Date())}>Hoje</button><button aria-label="Próximo período" onClick={() => shift(1)}><ArrowRight /></button></div><strong>{calendarTitle(anchor, mode)}</strong><div>{(['month','week','day'] as const).map((calendarMode) => <button key={calendarMode} className={mode === calendarMode ? 'active' : ''} onClick={() => onMode(calendarMode)}>{calendarMode === 'month' ? 'Mês' : calendarMode === 'week' ? 'Semana' : 'Dia'}</button>)}</div></header><div className={`phase3-calendar-grid ${mode}`}>{days.map((day) => { const daySchedules = schedules.filter((schedule) => scheduleTouchesDay(schedule, day)); return <article key={day.toISOString()} className={mode === 'month' && day.getMonth() !== anchor.getMonth() ? 'muted' : ''}><header><span>{weekdayLabel(day, mode)}</span><strong>{day.getDate()}</strong></header><div>{daySchedules.map((schedule) => <div className="phase3-calendar-event" key={`${schedule.id}-${day.toISOString()}`}><strong>{assessments.find((assessment) => assessment.id === schedule.assessment_id)?.title ?? 'Avaliação'}</strong><span>{schools.find((school) => school.id === schedule.school_id)?.name ?? 'Escola'}</span><small>{timeLabel(schedule.starts_at)}–{timeLabel(schedule.ends_at)} · {schedule.status}</small></div>)}{!daySchedules.length && mode !== 'month' && <p>Nenhuma aplicação.</p>}</div></article>; })}</div></section>;
}

function calendarDays(anchor: Date, mode: CalendarMode) {
  const normalized = startOfDay(anchor);
  if (mode === 'day') return [normalized];
  if (mode === 'week') {
    const start = startOfWeekMonday(normalized);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const monthStart = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
  const start = startOfWeekMonday(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
function startOfDay(date: Date) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
function startOfWeekMonday(date: Date) { const result = startOfDay(date); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
function addDays(date: Date, amount: number) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; }
function scheduleTouchesDay(schedule: Schedule, day: Date) { const start = startOfDay(day).getTime(); const end = addDays(startOfDay(day), 1).getTime(); return new Date(schedule.starts_at).getTime() < end && new Date(schedule.ends_at).getTime() >= start; }
function calendarTitle(anchor: Date, mode: CalendarMode) {
  if (mode === 'month') return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);
  if (mode === 'day') return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(anchor);
  const start = startOfWeekMonday(anchor); const end = addDays(start, 6);
  return `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(start)} – ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(end)}`;
}
function weekdayLabel(day: Date, mode: CalendarMode) { return new Intl.DateTimeFormat('pt-BR', { weekday: mode === 'month' ? 'short' : 'long' }).format(day); }
function timeLabel(value: string) { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function difficultyLabel(value: string) { return ({ easy: 'Fácil', medium: 'Média', hard: 'Difícil' } as Record<string, string>)[value] ?? value; }
function scheduleVisualStatus(row: ScheduledStudentRow) { if (row.schedule_status === 'cancelled') return 'removed'; const now = Date.now(); if (new Date(row.ends_at).getTime() < now || row.schedule_status === 'closed') return 'completed'; if (new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now) return 'enrolled'; return 'suspended'; }
function scheduleStatusLabel(row: ScheduledStudentRow) { if (row.schedule_status === 'cancelled') return 'Cancelada'; const now = Date.now(); if (new Date(row.ends_at).getTime() < now || row.schedule_status === 'closed') return 'Janela encerrada'; if (new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now) return 'Janela aberta'; return 'Programado'; }
function Field({ name, label, type = 'text', required = true }: { name: string; label: string; type?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} required={required} /></label>; }
function Select({ name, label, options }: { name: string; label: string; options: string[][] }) { return <label>{label}<select name={name} required>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function Actions({ onCancel, busy }: { onCancel: () => void; busy: boolean }) { return <div className="institutional-modal-actions"><button type="button" onClick={onCancel}>Cancelar</button><button disabled={busy}>Salvar</button></div>; }
function formatWindow(start: string, end: string) { const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); return `${formatter.format(new Date(start))} a ${formatter.format(new Date(end))}`; }
