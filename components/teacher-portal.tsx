'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Plus,
  School,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; display_name: string; role: 'teacher' | 'student' };
type Classroom = { id: string; name: string; subject: string; join_code: string; created_at: string };
type Assignment = { id: string; classroom_id: string; title: string; subject: string; instructions: string; due_at: string | null; points: number; created_at: string };
type Membership = { classroom_id: string; user_id: string; profiles: { display_name: string } | null };
type Submission = { id: string; assignment_id: string; student_id: string; status: 'draft' | 'submitted'; score: number | null };

export function TeacherPortal({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function readProfile() {
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id,display_name,role').eq('id', session.user.id).single();
      if (!active) return;
      setProfile(data as Profile | null);
      setMessage(error?.message ?? '');
      setLoading(false);
    }
    readProfile();
    return () => { active = false; };
  }, [session]);

  if (loading) return <PortalShell onClose={onClose}><div className="portal-loading"><LoaderCircle className="spin"/><p>Preparando sua área...</p></div></PortalShell>;
  if (!session) return <PortalShell onClose={onClose}><TeacherAuth /></PortalShell>;
  if (!profile) return <PortalShell onClose={onClose}><PortalMessage title="Não foi possível abrir o perfil" text={message || 'Tente entrar novamente.'}/></PortalShell>;
  if (profile.role !== 'teacher') return <PortalShell onClose={onClose}><PortalMessage title="Esta conta é de aluno" text="Entre com um perfil de professor para acessar turmas, atividades e entregas." action={<button className="teacher-secondary" onClick={() => supabase.auth.signOut()}>Sair desta conta</button>}/></PortalShell>;
  return <TeacherDashboard profile={profile} onClose={onClose}/>;
}

function PortalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="teacher-portal"><header className="teacher-public-header"><a className="teacher-logo" href="./"><span><GraduationCap size={24}/></span><strong>Aprendê</strong></a><button className="teacher-back" onClick={onClose}><ArrowLeft size={17}/> Voltar ao modo aluno</button></header>{children}</div>;
}

function TeacherAuth() {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice('');
    const result = creating
      ? await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { display_name: form.name.trim() }, emailRedirectTo: window.location.href } })
      : await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (creating && !result.data.session) setNotice('Confira seu e-mail para confirmar a conta e depois entre aqui.');
  }
  return <main className="teacher-auth"><section className="teacher-auth-copy"><span className="teacher-kicker">MODO PROFESSOR</span><h1>Sua turma em um só lugar.</h1><p>Crie turmas e atividades, acompanhe quem entregou e organize o próximo passo de cada aluno.</p><div className="teacher-benefits"><span><Users/>Turmas conectadas</span><span><ClipboardCheck/>Entregas e notas</span><span><CalendarDays/>Prazos organizados</span></div></section><section className="teacher-auth-card"><div><span className="teacher-card-icon"><School/></span><h2>{creating ? 'Criar acesso' : 'Entrar como professor'}</h2><p>{creating ? 'Use o e-mail autorizado para criar seu perfil.' : 'Acesse o painel das suas turmas.'}</p></div><form onSubmit={submit}>{creating && <label>Seu nome<input required minLength={2} maxLength={80} value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Como os alunos verão você"/></label>}<label>E-mail<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="professor@exemplo.com"/></label><label>Senha<input required minLength={8} type="password" autoComplete={creating?'new-password':'current-password'} value={form.password} onChange={e => setForm({...form,password:e.target.value})} placeholder="No mínimo 8 caracteres"/></label>{notice && <p className="teacher-notice" role="status">{notice}</p>}<button className="teacher-primary" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : creating ? 'Criar conta de professor' : 'Entrar'}</button></form><button className="teacher-switch" onClick={() => { setCreating(!creating); setNotice(''); }}>{creating ? 'Já tenho uma conta' : 'Primeiro acesso? Criar conta'}</button></section></main>;
}

function TeacherDashboard({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [view, setView] = useState<'overview'|'activities'|'students'>('overview');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [showClassForm, setShowClassForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    const classResult = await supabase.from('classrooms').select('*').order('created_at');
    const nextClasses = (classResult.data ?? []) as Classroom[];
    setClasses(nextClasses);
    setSelected(current => current || nextClasses[0]?.id || '');
    if (nextClasses.length) {
      const ids = nextClasses.map(item => item.id);
      const [activityResult, memberResult] = await Promise.all([
        supabase.from('assignments').select('*').in('classroom_id', ids).order('created_at', { ascending: false }),
        supabase.from('memberships').select('classroom_id,user_id,profiles(display_name)').in('classroom_id', ids),
      ]);
      const nextAssignments = (activityResult.data ?? []) as Assignment[];
      setAssignments(nextAssignments);
      setMemberships((memberResult.data ?? []) as unknown as Membership[]);
      if (nextAssignments.length) {
        const submissionResult = await supabase.from('submissions').select('id,assignment_id,student_id,status,score').in('assignment_id', nextAssignments.map(item => item.id));
        setSubmissions((submissionResult.data ?? []) as Submission[]);
      } else setSubmissions([]);
    } else { setAssignments([]); setMemberships([]); setSubmissions([]); }
    setNotice(classResult.error?.message ?? '');
    setBusy(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const currentClass = classes.find(item => item.id === selected);
  const classActivities = assignments.filter(item => item.classroom_id === selected);
  const classStudents = memberships.filter(item => item.classroom_id === selected);
  const delivered = submissions.filter(item => classActivities.some(activity => activity.id === item.assignment_id) && item.status === 'submitted');
  const completion = classActivities.length && classStudents.length ? Math.round(delivered.length / (classActivities.length * classStudents.length) * 100) : 0;

  return <div className="teacher-app"><aside className="teacher-sidebar"><a className="teacher-logo" href="./"><span><GraduationCap size={24}/></span><strong>Aprendê</strong></a><div className="teacher-profile"><div>{profile.display_name.slice(0,1).toUpperCase()}</div><span><strong>{profile.display_name}</strong><small>Professor</small></span></div><nav><button className={view==='overview'?'active':''} onClick={()=>setView('overview')}><School/>Visão geral</button><button className={view==='activities'?'active':''} onClick={()=>setView('activities')}><BookOpen/>Atividades</button><button className={view==='students'?'active':''} onClick={()=>setView('students')}><Users/>Alunos</button></nav><button className="teacher-exit" onClick={onClose}><ArrowLeft/>Modo aluno</button><button className="teacher-exit" onClick={()=>supabase.auth.signOut()}><LogOut/>Sair</button></aside><main className="teacher-main"><header className="teacher-topbar"><div><span>PAINEL DO PROFESSOR</span><h1>{view === 'overview' ? 'Visão geral' : view === 'activities' ? 'Atividades' : 'Alunos'}</h1></div><div className="teacher-top-actions">{classes.length>0 && <select aria-label="Turma atual" value={selected} onChange={e=>setSelected(e.target.value)}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>}<button className="teacher-primary compact" onClick={()=>setShowClassForm(true)}><Plus/>Nova turma</button></div></header>{notice&&<p className="teacher-notice">{notice}</p>}{busy ? <div className="portal-loading"><LoaderCircle className="spin"/><p>Carregando suas turmas...</p></div> : !currentClass ? <EmptyTeacher onCreate={()=>setShowClassForm(true)}/> : <>{view==='overview'&&<><section className="teacher-welcome"><div><span>{currentClass.subject}</span><h2>{currentClass.name}</h2><p>Compartilhe o código para seus alunos entrarem na turma.</p></div><button onClick={()=>{navigator.clipboard.writeText(currentClass.join_code);setNotice('Código copiado.')}}><small>CÓDIGO DA TURMA</small><strong>{currentClass.join_code}</strong><Copy/></button></section><section className="teacher-stats"><Stat icon={<Users/>} value={classStudents.length} label="alunos na turma"/><Stat icon={<BookOpen/>} value={classActivities.length} label="atividades criadas"/><Stat icon={<CheckCircle2/>} value={`${completion}%`} label="entregas concluídas"/></section><section className="teacher-panel"><div className="teacher-panel-title"><div><span>ACOMPANHAMENTO</span><h2>Atividades recentes</h2></div><button className="teacher-primary compact" onClick={()=>setShowActivityForm(true)}><Plus/>Criar atividade</button></div><ActivityList activities={classActivities} submissions={submissions} students={classStudents.length}/></section></>}{view==='activities'&&<section className="teacher-panel"><div className="teacher-panel-title"><div><span>CONTEÚDO DA TURMA</span><h2>Atividades</h2></div><button className="teacher-primary compact" onClick={()=>setShowActivityForm(true)}><Plus/>Nova atividade</button></div><ActivityList activities={classActivities} submissions={submissions} students={classStudents.length}/></section>}{view==='students'&&<section className="teacher-panel"><div className="teacher-panel-title"><div><span>TURMA {currentClass.name.toUpperCase()}</span><h2>Alunos conectados</h2></div><strong className="teacher-count">{classStudents.length}</strong></div>{classStudents.length?<div className="teacher-student-list">{classStudents.map(member=><div key={member.user_id}><span>{member.profiles?.display_name?.slice(0,1).toUpperCase()||'A'}</span><strong>{member.profiles?.display_name||'Aluno'}</strong><small>{submissions.filter(item=>item.student_id===member.user_id&&item.status==='submitted').length} entregas</small></div>)}</div>:<p className="teacher-empty-line">Nenhum aluno entrou ainda. Compartilhe o código <strong>{currentClass.join_code}</strong>.</p>}</section>}</>}{showClassForm&&<ClassForm profile={profile} onClose={()=>setShowClassForm(false)} onSaved={refresh}/>} {showActivityForm&&currentClass&&<ActivityForm profile={profile} classroom={currentClass} onClose={()=>setShowActivityForm(false)} onSaved={refresh}/>}</main></div>;
}

function Stat({icon,value,label}:{icon:React.ReactNode;value:string|number;label:string}) { return <article><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>; }
function ActivityList({activities,submissions,students}:{activities:Assignment[];submissions:Submission[];students:number}) { if(!activities.length)return <p className="teacher-empty-line">Crie a primeira atividade para começar a acompanhar a turma.</p>; return <div className="teacher-activity-list">{activities.map(item=>{const sent=submissions.filter(s=>s.assignment_id===item.id&&s.status==='submitted').length;return <article key={item.id}><span className="teacher-activity-icon"><BookOpen/></span><div><small>{item.subject}</small><strong>{item.title}</strong><p>{item.due_at?`Entrega até ${new Date(item.due_at).toLocaleDateString('pt-BR')}`:'Sem prazo definido'} · {item.points} pontos</p></div><span className="teacher-delivery"><strong>{sent}/{students}</strong><small>entregas</small></span></article>})}</div>; }
function EmptyTeacher({onCreate}:{onCreate:()=>void}) { return <section className="teacher-empty"><span><School/></span><h2>Crie sua primeira turma</h2><p>Você receberá um código para conectar os alunos e publicar atividades.</p><button className="teacher-primary" onClick={onCreate}><Plus/>Criar turma</button></section>; }
function PortalMessage({title,text,action}:{title:string;text:string;action?:React.ReactNode}) { return <main className="teacher-message"><span><GraduationCap/></span><h1>{title}</h1><p>{text}</p>{action}</main>; }

function ClassForm({profile,onClose,onSaved}:{profile:Profile;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [form,setForm]=useState({name:'',subject:''}); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const {error}=await supabase.from('classrooms').insert({owner_id:profile.id,name:form.name.trim(),subject:form.subject.trim()});setBusy(false);if(error)setNotice(error.message);else{await onSaved();onClose();}}
  return <Modal title="Nova turma" onClose={onClose}><form className="teacher-form" onSubmit={submit}><label>Nome da turma<input required minLength={2} maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: 7º ano B"/></label><label>Componente curricular<input required minLength={2} maxLength={80} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Ex.: Matemática"/></label>{notice&&<p className="teacher-notice">{notice}</p>}<button className="teacher-primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:'Criar turma'}</button></form></Modal>;
}
function ActivityForm({profile,classroom,onClose,onSaved}:{profile:Profile;classroom:Classroom;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [form,setForm]=useState({title:'',subject:classroom.subject,instructions:'',due:'',points:'10'}); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const {error}=await supabase.from('assignments').insert({classroom_id:classroom.id,created_by:profile.id,title:form.title.trim(),subject:form.subject.trim(),instructions:form.instructions.trim(),due_at:form.due?new Date(`${form.due}T23:59:00`).toISOString():null,points:Number(form.points)});setBusy(false);if(error)setNotice(error.message);else{await onSaved();onClose();}}
  return <Modal title="Nova atividade" onClose={onClose}><form className="teacher-form" onSubmit={submit}><label>Título<input required minLength={2} maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Revisão de frações"/></label><label>Componente curricular<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Orientações<textarea maxLength={4000} rows={5} value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})} placeholder="Explique o que o aluno precisa fazer."/></label><div className="teacher-form-row"><label>Prazo<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label><label>Pontos<input required type="number" min="1" max="1000" value={form.points} onChange={e=>setForm({...form,points:e.target.value})}/></label></div>{notice&&<p className="teacher-notice">{notice}</p>}<button className="teacher-primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:'Publicar atividade'}</button></form></Modal>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) { return <div className="teacher-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="teacher-modal" role="dialog" aria-modal="true" aria-label={title}><div><h2>{title}</h2><button onClick={onClose} aria-label="Fechar">×</button></div>{children}</section></div>; }
