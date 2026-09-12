'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, FolderCog, Link2, RotateCcw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type NetworkRow = Tables<'networks'>;
type SchoolRow = Tables<'schools'>;
type AcademicYearRow = Tables<'academic_years'>;
type SchoolYearRow = Tables<'school_years'>;
type ClassroomRow = Tables<'classrooms'> & { profiles?: { display_name: string } | { display_name: string }[] | null };
type LegacyRow = Database['public']['Functions']['list_legacy_classrooms']['Returns'][number];

const previewClassrooms: ClassroomRow[] = [{ id: 'class-1', owner_id: 'teacher-1', name: '6º A', subject: 'Matemática', join_code: 'MONTE6A', created_at: '2026-09-12T12:00:00Z', image_url: null, network_id: 'network-preview', school_id: 'school-1', academic_year_id: 'year-preview', school_year_id: 'grade-1', classroom_status: 'active', profiles: { display_name: 'Professor Gabriel' } }];
const previewLegacy: LegacyRow[] = [{ classroom_id: 'legacy-1', classroom_name: 'Turma sem vínculo', subject: 'Português', owner_id: 'teacher-2', owner_name: 'Professora Ana', owner_email: 'ana@exemplo.com' }];

export function InstitutionalClassrooms({ profile, networks, schools, academicYears, schoolYears, preview = false }: { profile: InstitutionalProfile; networks: NetworkRow[]; schools: SchoolRow[]; academicYears: AcademicYearRow[]; schoolYears: SchoolYearRow[]; preview?: boolean }) {
  const [classes, setClasses] = useState<ClassroomRow[]>(preview ? previewClassrooms : []);
  const [legacy, setLegacy] = useState<LegacyRow[]>(preview ? previewLegacy : []);
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [linking, setLinking] = useState<LegacyRow | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!networkId && networks[0]) setNetworkId(networks[0].id); }, [networkId, networks]);
  const load = useCallback(async () => {
    if (preview || !networkId) return;
    setBusy(true);
    const classResult = await supabase.from('classrooms').select('*,profiles(display_name)').eq('network_id', networkId).order('name');
    setClasses((classResult.data ?? []) as ClassroomRow[]);
    let legacyError: { message: string } | null = null;
    if (profile.role === 'network_admin') {
      const legacyResult = await supabase.rpc('list_legacy_classrooms', { target_network: networkId, search_query: '', page_size: 50 });
      setLegacy(legacyResult.data ?? []); legacyError = legacyResult.error;
    }
    const error = classResult.error ?? legacyError;
    setNotice(error ? `Não foi possível carregar as turmas: ${error.message}` : ''); setBusy(false);
  }, [networkId, preview, profile.role]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => classes.filter((item) => (!schoolFilter || item.school_id === schoolFilter) && (!yearFilter || item.academic_year_id === yearFilter) && (!gradeFilter || item.school_year_id === gradeFilter)), [classes, gradeFilter, schoolFilter, yearFilter]);
  const scopedSchools = schools.filter((school) => school.network_id === networkId);
  const scopedYears = academicYears.filter((year) => year.network_id === networkId);
  const scopedGrades = schoolYears.filter((grade) => !schoolFilter || grade.school_id === schoolFilter);

  async function changeStatus(classroom: ClassroomRow) {
    const next = classroom.classroom_status === 'active' ? 'archived' : 'active'; setBusy(true); setNotice('');
    if (preview) setClasses((items) => items.map((item) => item.id === classroom.id ? { ...item, classroom_status: next } : item));
    else { const { error } = await supabase.rpc('set_institutional_classroom_status', { target_classroom: classroom.id, target_status: next }); if (error) setNotice(`Não foi possível alterar a turma: ${error.message}`); else await load(); }
    setBusy(false);
  }

  async function linkClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!linking) return; const values = new FormData(event.currentTarget); setBusy(true); setNotice('');
    const payload = { target_classroom: linking.classroom_id, target_network: networkId, target_school: String(values.get('school_id')), target_academic_year: String(values.get('academic_year_id')), target_school_year: String(values.get('school_year_id')) };
    if (preview) { const schoolId = payload.target_school; const yearId = payload.target_academic_year; const gradeId = payload.target_school_year; setClasses((items) => [...items, { id: linking.classroom_id, owner_id: linking.owner_id, name: linking.classroom_name, subject: linking.subject, join_code: 'LEGACY', created_at: new Date().toISOString(), image_url: null, network_id: networkId, school_id: schoolId, academic_year_id: yearId, school_year_id: gradeId, classroom_status: 'active', profiles: { display_name: linking.owner_name } }]); setLegacy((items) => items.filter((item) => item.classroom_id !== linking.classroom_id)); }
    else { const { error } = await supabase.rpc('link_classroom_to_institution', payload); if (error) { setNotice(`Não foi possível vincular a turma: ${error.message}`); setBusy(false); return; } await load(); }
    setLinking(null); setNotice('Turma vinculada à estrutura institucional.'); setBusy(false);
  }

  return <section id="classrooms" className="institutional-panel">
    <div className="institutional-panel-head"><div><span>GESTÃO ACADÊMICA</span><h2>Turmas institucionais</h2></div><FolderCog /></div>
    <div className="institutional-filters"><label>Rede<select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label><label>Escola<select value={schoolFilter} onChange={(event) => { setSchoolFilter(event.target.value); setGradeFilter(''); }}><option value="">Todas</option>{scopedSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label>Ano letivo<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">Todos</option>{scopedYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label><label>Série<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="">Todas</option>{scopedGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label></div>
    {notice && <output className="institutional-inline-notice">{notice}</output>}
    <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Turma</th><th>Escola</th><th>Ano/Série</th><th>Professor</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{visible.map((item) => { const owner = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles; return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.subject}</small></td><td>{schools.find((school) => school.id === item.school_id)?.name ?? 'Sem escola'}</td><td>{academicYears.find((year) => year.id === item.academic_year_id)?.label ?? '-'}<small>{schoolYears.find((grade) => grade.id === item.school_year_id)?.name ?? '-'}</small></td><td>{owner?.display_name ?? 'Professor não identificado'}</td><td><span className={`institutional-status-pill ${item.classroom_status}`}>{item.classroom_status === 'active' ? 'Ativa' : 'Arquivada'}</span></td><td><button className="institutional-row-action" disabled={busy} onClick={() => void changeStatus(item)}>{item.classroom_status === 'active' ? <Archive /> : <RotateCcw />}{item.classroom_status === 'active' ? 'Arquivar' : 'Reativar'}</button></td></tr>; })}</tbody></table>{!visible.length && <div className="institutional-table-empty"><Search /><p>Nenhuma turma corresponde aos filtros.</p></div>}</div>
    {profile.role === 'network_admin' && legacy.length > 0 && <div className="institutional-legacy"><div><Link2 /><span><strong>Turmas antigas sem vínculo</strong><small>O histórico é preservado; apenas o escopo institucional será adicionado.</small></span></div>{legacy.map((item) => <article key={item.classroom_id}><span><strong>{item.classroom_name}</strong><small>{item.subject} · {item.owner_name}</small></span><button onClick={() => setLinking(item)}>Vincular turma</button></article>)}</div>}
    {linking && <div className="institutional-subform"><div><Link2 /><span><strong>Vincular {linking.classroom_name}</strong><small>Selecione um conjunto consistente de escola, ano e série.</small></span></div><form onSubmit={linkClassroom}><label>Escola<select name="school_id" required onChange={(event) => setSchoolFilter(event.target.value)} defaultValue=""><option value="" disabled>Selecione</option>{scopedSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label>Ano letivo<select name="academic_year_id" required><option value="">Selecione</option>{scopedYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label><label>Série<select name="school_year_id" required><option value="">Selecione</option>{scopedGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><button type="button" onClick={() => setLinking(null)}>Cancelar</button><button disabled={busy}>Confirmar vínculo</button></form></div>}
  </section>;
}
