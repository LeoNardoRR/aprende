'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, BookCopy, CalendarDays, CheckCircle2, ClipboardList, Layers3, Plus, Rocket, ShieldCheck } from 'lucide-react';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type View = 'cycles' | 'assessments' | 'booklets' | 'calendar' | 'applications';
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

const previewCycles: Cycle[] = [{ id: 'cycle-demo', network_id: 'network-preview', name: 'Diagnóstica Inicial 2026 - DEMO', description: 'Ciclo demonstrativo', starts_at: '2026-09-14T08:00:00Z', ends_at: '2026-09-30T18:00:00Z', status: 'draft', created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' }];
const previewAssessments: Assessment[] = [{ id: 'assessment-demo', cycle_id: 'cycle-demo', network_id: 'network-preview', curriculum_id: 'curriculum-custom', subject_id: 'subject-demo', curriculum_school_year_id: 'year-demo', title: 'Matemática - 6º ano - DEMO', description: 'Avaliação demonstrativa', instructions: 'Leia cada questão e marque uma resposta.', total_points: 40, duration_minutes: 60, starts_at: null, ends_at: null, status: 'draft', randomize_questions: true, randomize_options: true, created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' }];

export function InstitutionalAssessments({ profile, networks, schools, classrooms, preview = false }: { profile: InstitutionalProfile; networks: Network[]; schools: School[]; classrooms: Classroom[]; preview?: boolean }) {
  const [view, setView] = useState<View>('cycles');
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [cycles, setCycles] = useState<Cycle[]>(preview ? previewCycles : []);
  const [assessments, setAssessments] = useState<Assessment[]>(preview ? previewAssessments : []);
  const [booklets, setBooklets] = useState<Booklet[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<CurriculumYear[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState(previewAssessments[0]?.id ?? '');
  const [form, setForm] = useState<'cycle' | 'assessment' | 'schedule' | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

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
    setCycles(cycleResult.data ?? []); setAssessments(assessmentResult.data ?? []); setBooklets(bookletResult.data ?? []);
    setSchedules(scheduleResult.data ?? []); setCurricula(curriculumResult.data ?? []);
    setSelectedAssessment((current) => current || assessmentResult.data?.[0]?.id || '');
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
  const selectedBooklets = booklets.filter((booklet) => booklet.assessment_id === selectedAssessment);
  const mapSummary = useMemo(() => ({ booklets: selectedBooklets.length, points: selected?.total_points ?? 0 }), [selected, selectedBooklets.length]);

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const payload = { network_id: networkId, name: String(values.get('name')).trim(), description: String(values.get('description')).trim() || null, starts_at: new Date(String(values.get('starts_at'))).toISOString(), ends_at: new Date(String(values.get('ends_at'))).toISOString(), created_by: profile.id };
    if (preview) setCycles((current) => [...current, { ...payload, id: crypto.randomUUID(), status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    else { const result = await supabase.from('assessment_cycles').insert(payload); if (result.error) setNotice(result.error.message); else await load(); }
    setBusy(false); setForm(null);
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const payload = { cycle_id: String(values.get('cycle_id')), network_id: networkId, curriculum_id: String(values.get('curriculum_id')), subject_id: String(values.get('subject_id')), curriculum_school_year_id: String(values.get('year_id')), title: String(values.get('title')).trim(), description: String(values.get('description')).trim() || null, instructions: String(values.get('instructions')).trim(), duration_minutes: Number(values.get('duration')), randomize_questions: values.get('randomize_questions') === 'on', randomize_options: values.get('randomize_options') === 'on', created_by: profile.id };
    if (preview) setAssessments((current) => [...current, { ...payload, id: crypto.randomUUID(), total_points: 0, starts_at: null, ends_at: null, status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    else { const result = await supabase.from('diagnostic_assessments').insert(payload); if (result.error) setNotice(result.error.message); else await load(); }
    setBusy(false); setForm(null);
  }

  async function createBooklet() {
    if (!selectedAssessment) return; setBusy(true);
    if (preview) setBooklets((current) => [...current, { id: crypto.randomUUID(), assessment_id: selectedAssessment, network_id: networkId, code: String.fromCharCode(65 + selectedBooklets.length), title: `Caderno ${String.fromCharCode(65 + selectedBooklets.length)}`, generation_strategy: 'manual', generation_seed: null, created_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    else { const result = await supabase.rpc('create_assessment_booklet', { target_assessment: selectedAssessment, booklet_title: null, strategy: 'manual', deterministic_seed: null }); setNotice(result.error ? result.error.message : 'Caderno criado. Adicione itens aprovados pelo Banco de Itens.'); if (!result.error) await load(); }
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
    <div className="pedagogy-tabs" role="tablist" aria-label="Avaliações">{([['cycles','Ciclos'],['assessments','Provas'],['booklets','Cadernos'],['calendar','Calendário'],['applications','Aplicações']] as const).map(([id,label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
    <div className="pedagogy-toolbar"><label className="institutional-field compact"><span>Rede</span><select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label><div className="assessment-actions">{view === 'cycles' && <button onClick={() => setForm('cycle')}><Plus /> Novo ciclo</button>}{view === 'assessments' && <button onClick={() => setForm('assessment')}><Plus /> Nova avaliação</button>}{view === 'booklets' && <button disabled={!selectedAssessment || selectedBooklets.length >= 5 || busy} onClick={() => void createBooklet()}><BookCopy /> Novo caderno</button>}{view === 'calendar' && <button disabled={!selectedAssessment || selected?.status !== 'ready'} onClick={() => setForm('schedule')}><CalendarDays /> Programar</button>}</div></div>
    {notice && <output className="institutional-notice">{notice}</output>}
    {view === 'cycles' && <div className="assessment-card-grid">{cycles.map((cycle) => <article key={cycle.id}><CalendarDays /><div><span>{cycle.status}</span><h3>{cycle.name}</h3><p>{formatWindow(cycle.starts_at, cycle.ends_at)}</p><small>{assessments.filter((assessment) => assessment.cycle_id === cycle.id).length} avaliações</small></div></article>)}</div>}
    {view === 'assessments' && <div className="assessment-card-grid">{assessments.map((assessment) => <button className={selectedAssessment === assessment.id ? 'selected' : ''} key={assessment.id} onClick={() => setSelectedAssessment(assessment.id)}><ClipboardList /><div><span>{assessment.status}</span><h3>{assessment.title}</h3><p>{assessment.duration_minutes} min · {assessment.total_points} pontos</p></div></button>)}</div>}
    {view === 'booklets' && <><div className="assessment-map-summary"><article><Layers3 /><span>Cadernos</span><strong>{mapSummary.booklets}/5</strong></article><article><BarChart3 /><span>Pontuação</span><strong>{mapSummary.points}</strong></article><article><CheckCircle2 /><span>Validação</span><strong>{selected?.status === 'ready' ? 'Pronta' : 'Pendente'}</strong></article><button disabled={!selectedAssessment || busy} onClick={() => void markReady()}><Rocket /> Validar prova</button></div><div className="booklet-row">{selectedBooklets.map((booklet) => <article key={booklet.id}><strong>{booklet.title}</strong><span>{booklet.generation_strategy === 'manual' ? 'Ordem manual' : 'Ordem determinística'}</span><small>{booklet.generation_seed ? `Seed ${booklet.generation_seed}` : 'Sem seed'}</small></article>)}{!selectedBooklets.length && <div className="institutional-empty"><BookCopy /><h3>Nenhum caderno</h3><p>Crie o Caderno A e adicione versões aprovadas dos itens.</p></div>}</div></>}
    {view === 'calendar' && <div className="assessment-calendar"><header><button>Mês</button><button>Semana</button><button>Dia</button></header>{schedules.map((schedule) => <article key={schedule.id}><CalendarDays /><div><strong>{assessments.find((assessment) => assessment.id === schedule.assessment_id)?.title ?? 'Avaliação'}</strong><span>{schools.find((school) => school.id === schedule.school_id)?.name ?? 'Escola'}</span><small>{formatWindow(schedule.starts_at, schedule.ends_at)}</small></div></article>)}{!schedules.length && <p>Nenhuma avaliação programada.</p>}</div>}
    {view === 'applications' && <div className="assessment-application-empty"><Rocket /><h3>Acompanhamento da aplicação</h3><p>A tabela de alunos programados será alimentada pelas tentativas reais da Fase 4.</p><div><span>Não iniciou <b>0</b></span><span>Em andamento <b>0</b></span><span>Concluído <b>0</b></span><span>Expirado <b>0</b></span></div></div>}
    {form && <div className="institutional-modal-backdrop"><section className="institutional-modal" role="dialog" aria-modal="true"><div><span>AVALIAÇÕES</span><h2>{form === 'cycle' ? 'Novo ciclo avaliativo' : form === 'assessment' ? 'Nova avaliação' : 'Programar aplicação'}</h2></div>{form === 'cycle' && <form onSubmit={createCycle}><Field name="name" label="Nome" /><Field name="description" label="Descrição" required={false} /><Field name="starts_at" label="Início" type="datetime-local" /><Field name="ends_at" label="Fim" type="datetime-local" /><Actions onCancel={() => setForm(null)} busy={busy} /></form>}{form === 'assessment' && <form onSubmit={createAssessment}><Select name="cycle_id" label="Ciclo" options={cycles.map((item) => [item.id,item.name])} /><Select name="curriculum_id" label="Currículo" options={curricula.map((item) => [item.id,item.name])} /><Select name="subject_id" label="Componente" options={subjects.map((item) => [item.id,item.name])} /><Select name="year_id" label="Série" options={years.map((item) => [item.id,item.name])} /><Field name="title" label="Título" /><Field name="description" label="Descrição" required={false} /><Field name="instructions" label="Instruções" /><Field name="duration" label="Duração em minutos" type="number" /><label className="check-row"><input name="randomize_questions" type="checkbox" /> Randomizar questões</label><label className="check-row"><input name="randomize_options" type="checkbox" /> Randomizar alternativas</label><Actions onCancel={() => setForm(null)} busy={busy} /></form>}{form === 'schedule' && <form onSubmit={createSchedule}><Select name="school_id" label="Escola" options={schools.filter((school) => school.network_id === networkId).map((item) => [item.id,item.name])} /><fieldset><legend>Turmas</legend>{classrooms.filter((item) => item.network_id === networkId).map((item) => <label className="check-row" key={item.id}><input name="classrooms" value={item.id} type="checkbox" /> {item.name}</label>)}</fieldset><Field name="starts_at" label="Abertura" type="datetime-local" /><Field name="ends_at" label="Encerramento" type="datetime-local" /><Actions onCancel={() => setForm(null)} busy={busy} /></form>}</section></div>}
  </section>;
}

function Field({ name, label, type = 'text', required = true }: { name: string; label: string; type?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} required={required} /></label>; }
function Select({ name, label, options }: { name: string; label: string; options: string[][] }) { return <label>{label}<select name={name} required>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function Actions({ onCancel, busy }: { onCancel: () => void; busy: boolean }) { return <div className="institutional-modal-actions"><button type="button" onClick={onCancel}>Cancelar</button><button disabled={busy}>Salvar</button></div>; }
function formatWindow(start: string, end: string) { const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); return `${formatter.format(new Date(start))} a ${formatter.format(new Date(end))}`; }
