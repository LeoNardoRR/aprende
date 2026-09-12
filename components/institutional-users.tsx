'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type NetworkRow = Tables<'networks'>;
type SchoolRow = Tables<'schools'>;
type DirectoryRow = Database['public']['Functions']['list_institutional_users']['Returns'][number];

const roleLabels: Record<string, string> = {
  network_admin: 'Administrador da rede', manager: 'Gestor', reviewer: 'Revisor',
  approver: 'Aprovador', teacher: 'Professor', student: 'Aluno',
};

const previewRows: DirectoryRow[] = [
  { membership_id: 'membership-1', user_id: 'user-1', email: 'gestao@montemor.sp.gov.br', display_name: 'Gestora Municipal', profile_role: 'manager', membership_role: 'manager', network_id: 'network-preview', network_name: 'Rede Municipal de Monte Mor', school_id: null, school_name: null, membership_status: 'active', created_at: '2026-09-12T12:00:00Z' },
  { membership_id: 'membership-2', user_id: 'user-2', email: 'professor@escola.sp.gov.br', display_name: 'Professor Gabriel', profile_role: 'teacher', membership_role: 'teacher', network_id: 'network-preview', network_name: 'Rede Municipal de Monte Mor', school_id: 'school-1', school_name: 'EM Prof. Miguel Jalbut', membership_status: 'active', created_at: '2026-09-12T12:00:00Z' },
];

export function InstitutionalUsers({ profile, networks, schools, preview = false }: { profile: InstitutionalProfile; networks: NetworkRow[]; schools: SchoolRow[]; preview?: boolean }) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<DirectoryRow[]>(preview ? previewRows : []);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = profile.role === 'network_admin' || profile.role === 'manager';

  useEffect(() => { if (!networkId && networks[0]) setNetworkId(networks[0].id); }, [networkId, networks]);

  const load = useCallback(async () => {
    if (preview || !networkId) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('list_institutional_users', { target_network: networkId, search_query: query, page_size: 50, page_offset: 0 });
    setRows(data ?? []);
    setNotice(error ? `Não foi possível carregar os vínculos: ${error.message}` : '');
    setBusy(false);
  }, [networkId, preview, query]);

  useEffect(() => { void load(); }, [load]);

  async function saveMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const role = String(values.get('role'));
    const schoolId = String(values.get('school_id') ?? '') || null;
    setBusy(true); setNotice('');
    if ((role === 'teacher' || role === 'student') && !schoolId) {
      setNotice('Professor e aluno precisam estar vinculados a uma escola.'); setBusy(false); return;
    }
    if (preview) {
      setNotice('Vínculo validado na prévia. No modo real ele será gravado pelo RPC protegido.');
      setBusy(false); return;
    }
    const { error } = await supabase.rpc('set_institutional_membership', {
      target_email: String(values.get('email') ?? '').trim(), target_network: networkId,
      target_school: schoolId, target_role: role, target_status: 'active',
    });
    setNotice(error ? `Não foi possível salvar o vínculo: ${error.message}` : 'Vínculo salvo com sucesso.');
    setBusy(false); if (!error) { event.currentTarget.reset(); await load(); }
  }

  async function changeStatus(row: DirectoryRow) {
    const next = row.membership_status === 'active' ? 'inactive' : 'active';
    setBusy(true); setNotice('');
    if (preview) setRows((items) => items.map((item) => item.membership_id === row.membership_id ? { ...item, membership_status: next } : item));
    else {
      const { error } = await supabase.rpc('set_institutional_membership_status', { target_membership: row.membership_id, target_status: next });
      if (error) setNotice(`Não foi possível alterar o vínculo: ${error.message}`); else await load();
    }
    setBusy(false);
  }

  const availableRoles = profile.role === 'network_admin'
    ? Object.keys(roleLabels)
    : ['reviewer', 'approver', 'teacher', 'student'];
  const scopedSchools = schools.filter((school) => school.network_id === networkId);

  return <section id="access" className="institutional-panel">
    <div className="institutional-panel-head"><div><span>CONTROLE DE ACESSO</span><h2>Usuários institucionais</h2></div><ShieldCheck /></div>
    <p className="institutional-help">Pesquise os vínculos ativos e revogados. Alterações de papel e status passam por funções protegidas no banco.</p>
    <div className="institutional-directory-toolbar">
      <label>Rede<select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label>
      <form onSubmit={(event) => { event.preventDefault(); void load(); }}><label htmlFor="institutional-user-search">Nome ou e-mail</label><div><Search /><input id="institutional-user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuário vinculado" /><button disabled={busy}>Buscar</button></div></form>
    </div>
    {canManage && networkId && <form className="institutional-link-form" onSubmit={saveMembership}>
      <div><UserPlus /><span><strong>Conceder ou alterar papel</strong><small>O e-mail deve possuir uma conta Aprendê confirmada.</small></span></div>
      <label>E-mail<input name="email" type="email" required placeholder="usuario@exemplo.com" /></label>
      <label>Papel<select name="role" required>{availableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
      <label>Escola<select name="school_id"><option value="">Toda a rede</option>{scopedSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      <button disabled={busy}>Salvar vínculo</button>
    </form>}
    {notice && <output className="institutional-inline-notice">{notice}</output>}
    <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Escopo</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.membership_id}><td><strong>{row.display_name}</strong><small>{row.email}</small></td><td>{roleLabels[row.membership_role] ?? row.membership_role}</td><td>{row.school_name ?? row.network_name}</td><td><span className={`institutional-status-pill ${row.membership_status}`}>{row.membership_status === 'active' ? 'Ativo' : 'Revogado'}</span></td><td>{canManage && <button className="institutional-row-action" disabled={busy} onClick={() => void changeStatus(row)} aria-label={`${row.membership_status === 'active' ? 'Revogar' : 'Reativar'} vínculo de ${row.display_name}`}><UserCog />{row.membership_status === 'active' ? 'Revogar' : 'Reativar'}</button>}</td></tr>)}</tbody></table>{!rows.length && <div className="institutional-table-empty"><Users /><p>Nenhum vínculo encontrado neste escopo.</p></div>}</div>
  </section>;
}
