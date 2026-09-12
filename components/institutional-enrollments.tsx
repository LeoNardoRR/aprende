'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, History, PauseCircle, PlayCircle, Search, UserPlus, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type NetworkRow = Tables<'networks'>;
type SchoolRow = Tables<'schools'>;
type AcademicYearRow = Tables<'academic_years'>;
type ClassroomRow = Tables<'classrooms'>;
type MovementRow = Tables<'student_movements'>;
type EnrollmentRow = Database['public']['Functions']['list_student_enrollments']['Returns'][number];
type EnrollmentAction = 'transfer' | 'suspend' | 'reactivate' | 'remove' | 'complete';

const statusLabels: Record<string, string> = { enrolled: 'Matriculado', transferred: 'Transferido', suspended: 'Suspenso', removed: 'Removido', completed: 'Concluído' };
const movementLabels: Record<string, string> = { transfer: 'Transferência', suspension: 'Suspensão', reactivation: 'Reativação', removal: 'Remoção lógica', completion: 'Conclusão', promotion: 'Promoção' };
const previewEnrollments: EnrollmentRow[] = [{ enrollment_id: 'enrollment-1', student_id: 'student-1', student_name: 'Mariana Silva', student_email: 'mariana@aluno.exemplo', network_id: 'network-preview', school_id: 'school-1', school_name: 'EM Prof. Miguel Jalbut', academic_year_id: 'year-preview', academic_year_label: 'Ano letivo 2026', classroom_id: 'class-1', classroom_name: '6º A', enrollment_status: 'enrolled', starts_on: '2026-02-02', ends_on: null }];

export function InstitutionalEnrollments({ profile, networks, schools, academicYears, classrooms, preview = false }: { profile: InstitutionalProfile; networks: NetworkRow[]; schools: SchoolRow[]; academicYears: AcademicYearRow[]; classrooms: ClassroomRow[]; preview?: boolean }) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<EnrollmentRow[]>(preview ? previewEnrollments : []);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [selected, setSelected] = useState<EnrollmentRow | null>(null);
  const [action, setAction] = useState<EnrollmentAction | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = profile.role === 'network_admin' || profile.role === 'manager';

  useEffect(() => { if (!networkId && networks[0]) setNetworkId(networks[0].id); }, [networkId, networks]);
  const load = useCallback(async () => {
    if (preview || !networkId) return; setBusy(true);
    const { data, error } = await supabase.rpc('list_student_enrollments', { target_network: networkId, search_query: query, status_filter: status, page_size: 50, page_offset: 0 });
    setRows(data ?? []); setNotice(error ? `Não foi possível carregar as matrículas: ${error.message}` : ''); setBusy(false);
  }, [networkId, preview, query, status]);
  useEffect(() => { void load(); }, [load]);

  async function createEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setNotice('');
    const classroom = classrooms.find((item) => item.id === String(values.get('classroom_id')));
    if (!classroom?.network_id || !classroom.school_id || !classroom.academic_year_id) { setNotice('Selecione uma turma institucional ativa.'); setBusy(false); return; }
    if (preview) setNotice('Matrícula validada na prévia. No modo real ela será gravada com histórico protegido.');
    else {
      const { error } = await supabase.rpc('create_student_enrollment', { target_email: String(values.get('email') ?? '').trim(), target_network: classroom.network_id, target_school: classroom.school_id, target_academic_year: classroom.academic_year_id, target_classroom: classroom.id });
      setNotice(error ? `Não foi possível criar a matrícula: ${error.message}` : 'Matrícula criada com sucesso.'); if (!error) { event.currentTarget.reset(); await load(); }
    }
    setBusy(false);
  }

  async function showTimeline(row: EnrollmentRow) {
    setSelected(row); setAction(null);
    if (preview) { setMovements([{ id: 'movement-1', enrollment_id: row.enrollment_id, student_id: row.student_id, from_classroom_id: null, to_classroom_id: row.classroom_id, movement_type: 'reactivation', reason: 'Registro demonstrativo', effective_on: '2026-02-02', created_by: profile.id, created_at: '2026-02-02T12:00:00Z' }]); return; }
    const { data, error } = await supabase.from('student_movements').select('*').eq('enrollment_id', row.enrollment_id).order('effective_on', { ascending: false });
    setMovements(data ?? []); if (error) setNotice(`Não foi possível carregar o histórico: ${error.message}`);
  }

  async function applyAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !action) return; const values = new FormData(event.currentTarget); setBusy(true); setNotice('');
    const targetClassroom = String(values.get('target_classroom') ?? '') || null;
    if (preview) {
      const nextStatus = action === 'suspend' ? 'suspended' : action === 'remove' ? 'removed' : action === 'complete' ? 'completed' : 'enrolled';
      setRows((items) => items.map((item) => item.enrollment_id === selected.enrollment_id ? { ...item, enrollment_status: nextStatus, classroom_id: targetClassroom ?? item.classroom_id, classroom_name: classrooms.find((room) => room.id === targetClassroom)?.name ?? item.classroom_name } : item));
    } else {
      const { error } = await supabase.rpc('transition_student_enrollment', { target_enrollment: selected.enrollment_id, target_action: action, target_classroom: targetClassroom, action_reason: String(values.get('reason') ?? '').trim() || null });
      if (error) { setNotice(`Não foi possível atualizar a matrícula: ${error.message}`); setBusy(false); return; } await load();
    }
    setNotice(`${actionLabel(action)} registrada com histórico.`); setSelected(null); setAction(null); setBusy(false);
  }

  const networkClasses = classrooms.filter((room) => room.network_id === networkId && room.classroom_status === 'active');
  const targetClasses = selected ? networkClasses.filter((room) => room.school_id === selected.school_id && room.academic_year_id === selected.academic_year_id && room.id !== selected.classroom_id) : [];

  return <section id="enrollments" className="institutional-panel">
    <div className="institutional-panel-head"><div><span>VIDA ESCOLAR</span><h2>Matrículas e movimentações</h2></div><History /></div>
    <div className="institutional-directory-toolbar institutional-enrollment-toolbar"><label>Rede<select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label><form onSubmit={(event) => { event.preventDefault(); void load(); }}><label htmlFor="enrollment-search">Aluno ou e-mail</label><div><Search /><input id="enrollment-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar matrícula" /><button disabled={busy}>Buscar</button></div></form><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {canManage && <form className="institutional-link-form institutional-enrollment-form" onSubmit={createEnrollment}><div><UserPlus /><span><strong>Nova matrícula manual</strong><small>O aluno precisa possuir uma conta Aprendê.</small></span></div><label>E-mail do aluno<input name="email" type="email" required placeholder="aluno@exemplo.com" /></label><label>Turma<select name="classroom_id" required><option value="">Selecione</option>{networkClasses.map((room) => <option key={room.id} value={room.id}>{room.name} · {schools.find((school) => school.id === room.school_id)?.name} · {academicYears.find((year) => year.id === room.academic_year_id)?.label}</option>)}</select></label><button disabled={busy}>Matricular</button></form>}
    {notice && <output className="institutional-inline-notice">{notice}</output>}
    <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Aluno</th><th>Escola/Turma</th><th>Ano letivo</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.enrollment_id}><td><strong>{row.student_name}</strong><small>{row.student_email}</small></td><td>{row.school_name}<small>{row.classroom_name ?? 'Sem turma'}</small></td><td>{row.academic_year_label}</td><td><span className={`institutional-status-pill ${row.enrollment_status}`}>{statusLabels[row.enrollment_status] ?? row.enrollment_status}</span></td><td><div className="institutional-row-actions"><button className="institutional-row-action" onClick={() => void showTimeline(row)}><History />Histórico</button>{canManage && row.enrollment_status === 'enrolled' && <><button className="institutional-row-action" onClick={() => { setSelected(row); setAction('transfer'); }}><ArrowRightLeft />Transferir</button><button className="institutional-row-action" onClick={() => { setSelected(row); setAction('suspend'); }}><PauseCircle />Suspender</button><button className="institutional-row-action" onClick={() => { setSelected(row); setAction('complete'); }}><CheckCircle2 />Concluir</button></>}{canManage && row.enrollment_status === 'suspended' && <button className="institutional-row-action" onClick={() => { setSelected(row); setAction('reactivate'); }}><PlayCircle />Reativar</button>}{canManage && !['removed', 'completed'].includes(row.enrollment_status) && <button className="institutional-row-action danger" onClick={() => { setSelected(row); setAction('remove'); }}><UserX />Remover</button>}</div></td></tr>)}</tbody></table>{!rows.length && <div className="institutional-table-empty"><Search /><p>Nenhuma matrícula encontrada.</p></div>}</div>
    {selected && !action && <div className="institutional-subform institutional-timeline"><div><History /><span><strong>Histórico de {selected.student_name}</strong><small>Movimentações preservadas por data.</small></span><button onClick={() => setSelected(null)}>Fechar</button></div>{movements.length ? <ol>{movements.map((movement) => <li key={movement.id}><strong>{movementLabels[movement.movement_type] ?? movement.movement_type}</strong><span>{formatDate(movement.effective_on)}</span>{movement.reason && <small>{movement.reason}</small>}</li>)}</ol> : <p>Nenhuma movimentação registrada após a matrícula inicial.</p>}</div>}
    {selected && action && <div className="institutional-subform"><div>{actionIcon(action)}<span><strong>{actionLabel(action)} · {selected.student_name}</strong><small>A ação será registrada permanentemente no histórico.</small></span></div><form onSubmit={applyAction}>{action === 'transfer' && <label>Nova turma<select name="target_classroom" required><option value="">Selecione</option>{targetClasses.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>}<label>Motivo<input name="reason" maxLength={1000} placeholder="Descreva o motivo da movimentação" /></label><button type="button" onClick={() => { setSelected(null); setAction(null); }}>Cancelar</button><button disabled={busy}>Confirmar</button></form></div>}
  </section>;
}

function actionLabel(action: EnrollmentAction) { return ({ transfer: 'Transferência', suspend: 'Suspensão', reactivate: 'Reativação', remove: 'Remoção lógica', complete: 'Conclusão' } as const)[action]; }
function actionIcon(action: EnrollmentAction) { if (action === 'transfer') return <ArrowRightLeft />; if (action === 'suspend') return <PauseCircle />; if (action === 'reactivate') return <PlayCircle />; if (action === 'complete') return <CheckCircle2 />; return <UserX />; }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
