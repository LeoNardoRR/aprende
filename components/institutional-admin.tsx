'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Network,
  Plus,
  School,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';

export type InstitutionalRole = Exclude<
  Database['public']['Enums']['app_role'],
  'teacher' | 'student'
>;
type InstitutionalForm = 'network' | 'school' | 'year' | 'grade';

export type InstitutionalProfile = {
  id: string;
  display_name: string;
  role: InstitutionalRole;
  avatar_url: string | null;
};

type NetworkRow = Tables<'networks'>;
type SchoolRow = Tables<'schools'>;
type AcademicYearRow = Tables<'academic_years'>;
type SchoolYearRow = Tables<'school_years'>;
type MembershipRow = Tables<'institutional_memberships'>;

const roleLabels: Record<InstitutionalRole, string> = {
  network_admin: 'Administrador da rede',
  manager: 'Gestor',
  reviewer: 'Revisor',
  approver: 'Aprovador',
};

const previewNetworks: NetworkRow[] = [
  {
    id: 'network-preview',
    name: 'Rede Municipal de Monte Mor',
    municipality: 'Monte Mor',
    state_code: 'SP',
    created_by: 'preview-admin',
    created_at: '2026-09-12T12:00:00Z',
    updated_at: '2026-09-12T12:00:00Z',
  },
];

const previewSchools: SchoolRow[] = [
  { id: 'school-1', network_id: 'network-preview', name: 'EM Prof. Miguel Jalbut', code: 'EM-001', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
  { id: 'school-2', network_id: 'network-preview', name: 'EM San Remo', code: 'EM-002', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
];

const previewYears: AcademicYearRow[] = [
  { id: 'year-preview', network_id: 'network-preview', label: 'Ano letivo 2026', starts_on: '2026-02-02', ends_on: '2026-12-18', status: 'open', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
];

const previewSchoolYears: SchoolYearRow[] = [
  { id: 'grade-1', school_id: 'school-1', name: '6º ano', code: '6EF', sort_order: 6, created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
  { id: 'grade-2', school_id: 'school-1', name: '7º ano', code: '7EF', sort_order: 7, created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
];

export function InstitutionalAdmin({ profile, preview = false }: { profile: InstitutionalProfile; preview?: boolean }) {
  const [networks, setNetworks] = useState<NetworkRow[]>(preview ? previewNetworks : []);
  const [schools, setSchools] = useState<SchoolRow[]>(preview ? previewSchools : []);
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>(preview ? previewYears : []);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>(preview ? previewSchoolYears : []);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<InstitutionalForm | null>(null);

  const canConfigure = profile.role === 'network_admin' || profile.role === 'manager';

  const loadData = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    const results = await Promise.all([
      supabase.from('networks').select('*').order('name'),
      supabase.from('schools').select('*').order('name'),
      supabase.from('academic_years').select('*').order('starts_on', { ascending: false }),
      supabase.from('school_years').select('*').order('sort_order'),
      supabase.from('institutional_memberships').select('*').eq('status', 'active'),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) setNotice(`Não foi possível carregar toda a estrutura: ${firstError.message}`);
    setNetworks(results[0].data ?? []);
    setSchools(results[1].data ?? []);
    setAcademicYears(results[2].data ?? []);
    setSchoolYears(results[3].data ?? []);
    setMemberships(results[4].data ?? []);
    setLoading(false);
  }, [preview]);

  useEffect(() => { void loadData(); }, [loadData]);

  const openYear = academicYears.find((year) => year.status === 'open');
  const summary = useMemo(() => [
    { label: 'Redes', value: networks.length, icon: Network },
    { label: 'Escolas', value: schools.length, icon: School },
    { label: 'Anos letivos', value: academicYears.length, icon: CalendarRange },
    { label: 'Usuários vinculados', value: memberships.length, icon: Users },
  ], [academicYears.length, memberships.length, networks.length, schools.length]);

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setNotice('');
    let error: { message: string } | null = null;

    if (form === 'network') {
      const payload = { name: String(values.get('name') ?? '').trim(), municipality: String(values.get('municipality') ?? '').trim() || null, state_code: String(values.get('state_code') ?? '').trim().toUpperCase() || null, created_by: profile.id };
      if (preview) setNetworks((items) => [...items, { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      else ({ error } = await supabase.from('networks').insert(payload));
    }
    if (form === 'school') {
      const payload = { network_id: String(values.get('network_id')), name: String(values.get('name') ?? '').trim(), code: String(values.get('code') ?? '').trim().toUpperCase() };
      if (preview) setSchools((items) => [...items, { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      else ({ error } = await supabase.from('schools').insert(payload));
    }
    if (form === 'year') {
      const payload = { network_id: String(values.get('network_id')), label: String(values.get('label') ?? '').trim(), starts_on: String(values.get('starts_on')), ends_on: String(values.get('ends_on')), status: String(values.get('status') ?? 'planned') };
      if (preview) setAcademicYears((items) => [...items, { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      else ({ error } = await supabase.from('academic_years').insert(payload));
    }
    if (form === 'grade') {
      const payload = { school_id: String(values.get('school_id')), name: String(values.get('name') ?? '').trim(), code: String(values.get('code') ?? '').trim().toUpperCase(), sort_order: Number(values.get('sort_order') ?? 0) };
      if (preview) setSchoolYears((items) => [...items, { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      else ({ error } = await supabase.from('school_years').insert(payload));
    }

    if (error) {
      setNotice(`Não foi possível salvar: ${error.message}`);
      return;
    }
    setNotice('Estrutura salva com sucesso.');
    setForm(null);
    await loadData();
  }

  return (
    <div className="institutional-app">
      <aside className="institutional-sidebar">
        <div className="institutional-brand"><span><BrandLogo variant="teacher" /></span><strong>Aprendê</strong></div>
        <nav aria-label="Administração institucional">
          <a href="#overview" className="active"><Building2 /> Visão geral</a>
          <a href="#schools"><School /> Escolas</a>
          <a href="#years"><CalendarRange /> Anos e séries</a>
          <a href="#access"><ShieldCheck /> Acessos</a>
        </nav>
        <button type="button" onClick={() => void supabase.auth.signOut()}><LogOut /> Sair</button>
      </aside>
      <main className="institutional-main">
        <header className="institutional-header">
          <div><span>GESTÃO MUNICIPAL</span><h1>Olá, {profile.display_name}</h1><p>{roleLabels[profile.role]} · estrutura institucional da plataforma</p></div>
          <div className="institutional-role"><ShieldCheck /><span>Escopo protegido por RLS</span></div>
        </header>

        {notice && <output className="institutional-notice">{notice}</output>}
        {loading ? <div className="institutional-loading"><LoaderCircle className="spin" /> Carregando estrutura...</div> : (
          <>
            <section id="overview" className="institutional-stats">
              {summary.map(({ label, value, icon: Icon }) => <article key={label}><Icon /><span>{label}</span><strong>{value}</strong></article>)}
            </section>

            <section className="institutional-panel institutional-status">
              <div><span>ANO LETIVO ATUAL</span><h2>{openYear?.label ?? 'Nenhum ano letivo aberto'}</h2><p>{openYear ? `${formatDate(openYear.starts_on)} a ${formatDate(openYear.ends_on)}` : 'Cadastre e abra um período para organizar turmas e matrículas.'}</p></div>
              <CheckCircle2 />
            </section>

            <section id="schools" className="institutional-panel">
              <div className="institutional-panel-head"><div><span>ESTRUTURA</span><h2>Redes e escolas</h2></div>{canConfigure && <div className="institutional-actions"><button onClick={() => setForm('network')}><Plus /> Rede</button><button onClick={() => setForm('school')} disabled={!networks.length}><Plus /> Escola</button></div>}</div>
              <div className="institutional-school-grid">
                {networks.map((network) => <article key={network.id}><div className="institutional-network-title"><Network /><div><strong>{network.name}</strong><small>{[network.municipality, network.state_code].filter(Boolean).join(' - ') || 'Município não informado'}</small></div></div><div className="institutional-school-list">{schools.filter((school) => school.network_id === network.id).map((school) => <span key={school.id}><School /><b>{school.name}</b><small>{school.code}</small></span>)}{!schools.some((school) => school.network_id === network.id) && <em>Nenhuma escola cadastrada.</em>}</div></article>)}
                {!networks.length && <div className="institutional-empty"><Network /><h3>Comece pela rede de ensino</h3><p>Crie a rede municipal para então vincular escolas, anos letivos e usuários.</p></div>}
              </div>
            </section>

            <section id="years" className="institutional-panel">
              <div className="institutional-panel-head"><div><span>ORGANIZAÇÃO ACADÊMICA</span><h2>Anos letivos e séries</h2></div>{canConfigure && <div className="institutional-actions"><button onClick={() => setForm('year')} disabled={!networks.length}><Plus /> Ano letivo</button><button onClick={() => setForm('grade')} disabled={!schools.length}><Plus /> Série</button></div>}</div>
              <div className="institutional-year-grid">
                {academicYears.map((year) => <article key={year.id}><CalendarRange /><div><strong>{year.label}</strong><span className={`institutional-badge ${year.status}`}>{year.status === 'open' ? 'Aberto' : year.status === 'closed' ? 'Encerrado' : 'Planejado'}</span><small>{formatDate(year.starts_on)} a {formatDate(year.ends_on)}</small></div></article>)}
                {schoolYears.map((grade) => <article key={grade.id}><GraduationCap /><div><strong>{grade.name}</strong><span className="institutional-badge">{grade.code}</span><small>{schools.find((school) => school.id === grade.school_id)?.name ?? 'Escola'}</small></div></article>)}
              </div>
            </section>

            <section id="access" className="institutional-panel">
              <div className="institutional-panel-head"><div><span>CONTROLE DE ACESSO</span><h2>Perfis institucionais</h2></div><ShieldCheck /></div>
              <p className="institutional-help">Os acessos são limitados por rede e escola. Administrador, gestor, revisor e aprovador recebem somente as permissões previstas para seu papel e vínculo ativo.</p>
              <div className="institutional-role-grid">{Object.entries(roleLabels).map(([role, label]) => <article key={role}><strong>{label}</strong><span>{memberships.filter((membership) => membership.role === role).length} vínculo(s) ativo(s)</span></article>)}</div>
            </section>
          </>
        )}
      </main>
      {form && <div className="institutional-modal-backdrop" role="presentation"><section className="institutional-modal" role="dialog" aria-modal="true" aria-labelledby="institutional-form-title"><div><span>NOVO CADASTRO</span><h2 id="institutional-form-title">{formTitle(form)}</h2></div><form onSubmit={createRecord}>{(form === 'school' || form === 'year') && <SelectField name="network_id" label="Rede" options={networks.map((network) => ({ value: network.id, label: network.name }))} />}{form === 'grade' && <SelectField name="school_id" label="Escola" options={schools.map((school) => ({ value: school.id, label: school.name }))} />}{form === 'network' && <><TextField name="name" label="Nome da rede" /><TextField name="municipality" label="Município" /><TextField name="state_code" label="UF" maxLength={2} /></>}{form === 'school' && <><TextField name="name" label="Nome da escola" /><TextField name="code" label="Código da escola" /></>}{form === 'year' && <><TextField name="label" label="Identificação" placeholder="Ano letivo 2027" /><TextField name="starts_on" label="Início" type="date" /><TextField name="ends_on" label="Término" type="date" /><SelectField name="status" label="Situação" options={[{ value: 'planned', label: 'Planejado' }, { value: 'open', label: 'Aberto' }, { value: 'closed', label: 'Encerrado' }]} /></>}{form === 'grade' && <><TextField name="name" label="Nome da série" placeholder="6º ano" /><TextField name="code" label="Código" placeholder="6EF" /><TextField name="sort_order" label="Ordem" type="number" /></>}<div className="institutional-modal-actions"><button type="button" onClick={() => setForm(null)}>Cancelar</button><button type="submit">Salvar cadastro</button></div></form></section></div>}
    </div>
  );
}

function TextField({ name, label, type = 'text', ...props }: { name: string; label: string; type?: string; placeholder?: string; maxLength?: number }) {
  return <label>{label}<input name={name} type={type} required={name !== 'municipality' && name !== 'state_code'} {...props} /></label>;
}

function SelectField({ name, label, options }: { name: string; label: string; options: { value: string; label: string }[] }) {
  return <label>{label}<select name={name} required>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function formTitle(form: InstitutionalForm) {
  return ({ network: 'Rede de ensino', school: 'Escola', year: 'Ano letivo', grade: 'Série ou etapa' } as const)[form];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
