'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react';
import { InstitutionalInvitations } from './institutional-invitations';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type NetworkRow = Tables<'networks'>;
type SchoolRow = Tables<'schools'>;
type DirectoryRow =
  Database['public']['Functions']['list_institutional_users']['Returns'][number];

const roleLabels: Record<string, string> = {
  network_admin: 'Administrador da rede',
  manager: 'Gestor',
  reviewer: 'Revisor',
  approver: 'Aprovador',
  teacher: 'Professor',
  student: 'Aluno',
};

const previewRows: DirectoryRow[] = [
  {
    membership_id: 'membership-1',
    user_id: 'user-1',
    email: 'gestao@montemor.sp.gov.br',
    display_name: 'Gestora Municipal',
    profile_role: 'manager',
    membership_role: 'manager',
    network_id: 'network-preview',
    network_name: 'Rede Municipal de Monte Mor',
    school_id: null,
    school_name: null,
    membership_status: 'active',
    created_at: '2026-09-12T12:00:00Z',
  },
  {
    membership_id: 'membership-2',
    user_id: 'user-2',
    email: 'professor@escola.sp.gov.br',
    display_name: 'Professor Gabriel',
    profile_role: 'teacher',
    membership_role: 'teacher',
    network_id: 'network-preview',
    network_name: 'Rede Municipal de Monte Mor',
    school_id: 'school-1',
    school_name: 'EM Prof. Miguel Jalbut',
    membership_status: 'active',
    created_at: '2026-09-12T12:00:00Z',
  },
];

export function InstitutionalUsers({
  profile,
  networks,
  schools,
  preview = false,
}: {
  profile: InstitutionalProfile;
  networks: NetworkRow[];
  schools: SchoolRow[];
  preview?: boolean;
}) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<DirectoryRow[]>(preview ? previewRows : []);
  const [filters, setFilters] = useState({ role: '', status: '', school: '' });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [history, setHistory] = useState<
    | {
        action: string;
        metadata: Record<string, string>;
        created_at: string;
        actor: string;
      }[]
    | null
  >(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage =
    profile.role === 'network_admin' || profile.role === 'manager';

  useEffect(() => {
    if (!networkId && networks[0]) setNetworkId(networks[0].id);
  }, [networkId, networks]);

  const load = useCallback(async () => {
    if (preview || !networkId) return;
    setBusy(true);
    try {
      const data = await institutionalRpc<
        {
          id: string;
          user_id: string;
          email: string;
          display_name: string;
          role: string;
          status: string;
          school_id: string | null;
          created_at: string;
          total_count: number;
        }[]
      >('institutional_user_directory', {
        target_network: networkId,
        filters: { ...filters, search: query },
        page_size: 25,
        page_offset: page * 25,
      });
      setTotal(data[0]?.total_count ?? 0);
      setRows(
        data.map((row) => ({
          membership_id: row.id,
          user_id: row.user_id,
          email: row.email,
          display_name: row.display_name,
          profile_role: row.role as DirectoryRow['profile_role'],
          membership_role: row.role,
          network_id: networkId,
          network_name: networks.find((n) => n.id === networkId)?.name ?? '',
          school_id: row.school_id,
          school_name:
            schools.find((s) => s.id === row.school_id)?.name ?? null,
          membership_status: row.status,
          created_at: row.created_at,
        })),
      );
    } catch (error) {
      setNotice(operationError(error));
    }
    setBusy(false);
  }, [networkId, preview, query, filters, page, networks, schools]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(event.currentTarget);
    const role = String(values.get('role'));
    const schoolId = String(values.get('school_id') ?? '') || null;
    setBusy(true);
    setNotice('');
    if ((role === 'teacher' || role === 'student') && !schoolId) {
      setNotice('Professor e aluno precisam estar vinculados a uma escola.');
      setBusy(false);
      return;
    }
    if (preview) {
      setNotice(
        'Vínculo validado na prévia. No modo real ele será gravado pelo RPC protegido.',
      );
      setBusy(false);
      return;
    }
    const { error } = await supabase.rpc('set_institutional_membership', {
      target_email: String(values.get('email') ?? '').trim(),
      target_network: networkId,
      target_school: schoolId,
      target_role: role,
      target_status: 'active',
    });
    setNotice(
      error
        ? `Não foi possível salvar o vínculo: ${error.message}`
        : 'Vínculo salvo com sucesso.',
    );
    setBusy(false);
    if (!error) {
      formElement.reset();
      await load();
    }
  }

  async function changeStatus(row: DirectoryRow) {
    if (
      row.membership_status === 'active' &&
      !window.confirm(`Revogar o vínculo de ${row.display_name}?`)
    )
      return;
    const next = row.membership_status === 'active' ? 'inactive' : 'active';
    setBusy(true);
    setNotice('');
    if (preview)
      setRows((items) =>
        items.map((item) =>
          item.membership_id === row.membership_id
            ? { ...item, membership_status: next }
            : item,
        ),
      );
    else {
      const { error } = await supabase.rpc(
        'set_institutional_membership_status',
        { target_membership: row.membership_id, target_status: next },
      );
      if (error)
        setNotice(`Não foi possível alterar o vínculo: ${error.message}`);
      else await load();
    }
    setBusy(false);
  }

  async function showHistory(row: DirectoryRow) {
    try {
      setHistory(
        preview
          ? []
          : await institutionalRpc('institutional_access_history', {
              target_network: networkId,
              target_membership: row.membership_id,
            }),
      );
    } catch (error) {
      setNotice(operationError(error));
    }
  }
  const availableRoles =
    profile.role === 'network_admin'
      ? Object.keys(roleLabels)
      : ['reviewer', 'approver', 'teacher', 'student'];
  const scopedSchools = schools.filter(
    (school) => school.network_id === networkId,
  );

  return (
    <section id="access" className="institutional-panel">
      <div className="institutional-panel-head">
        <div>
          <span>CONTROLE DE ACESSO</span>
          <h2>Usuários institucionais</h2>
        </div>
        <ShieldCheck />
      </div>
      <p className="institutional-help">
        Pesquise os vínculos ativos e revogados. Alterações de papel e status
        passam por funções protegidas no banco.
      </p>
      <div className="institutional-directory-toolbar">
        <label>
          Rede
          <select
            value={networkId}
            onChange={(event) => {
              setNetworkId(event.target.value);
              setPage(0);
            }}
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label htmlFor="institutional-user-search">Nome ou e-mail</label>
          <div>
            <Search />
            <input
              id="institutional-user-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Buscar usuário vinculado"
            />
            <button disabled={busy}>Buscar</button>
          </div>
        </form>
      </div>
      <div className="phase12-box phase12-grid">
        {(['role', 'status', 'school'] as const).map((key) => (
          <label key={key}>
            {key === 'role' ? 'Papel' : key === 'status' ? 'Status' : 'Escola'}
            <select
              value={filters[key]}
              onChange={(e) => {
                setFilters((f) => ({ ...f, [key]: e.target.value }));
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              {(key === 'role'
                ? Object.entries(roleLabels)
                : key === 'status'
                  ? [
                      ['active', 'Ativo'],
                      ['inactive', 'Revogado'],
                    ]
                  : scopedSchools.map((s) => [s.id, s.name])
              ).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {canManage && networkId && (
        <form className="institutional-link-form" onSubmit={saveMembership}>
          <div>
            <UserPlus />
            <span>
              <strong>Conceder ou alterar papel</strong>
              <small>O e-mail deve possuir uma conta Aprendê confirmada.</small>
            </span>
          </div>
          <label>
            E-mail
            <input
              name="email"
              type="email"
              required
              placeholder="usuario@exemplo.com"
            />
          </label>
          <label>
            Papel
            <select name="role" required>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Escola
            <select name="school_id">
              <option value="">Toda a rede</option>
              {scopedSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy}>Salvar vínculo</button>
        </form>
      )}
      {notice && (
        <output className="institutional-inline-notice">{notice}</output>
      )}
      <div className="institutional-table-wrap">
        <table className="institutional-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Escopo</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.membership_id}>
                <td>
                  <strong>{row.display_name}</strong>
                  <small>{row.email}</small>
                </td>
                <td>
                  {roleLabels[row.membership_role] ?? row.membership_role}
                </td>
                <td>{row.school_name ?? row.network_name}</td>
                <td>
                  <span
                    className={`institutional-status-pill ${row.membership_status}`}
                  >
                    {row.membership_status === 'active' ? 'Ativo' : 'Revogado'}
                  </span>
                </td>
                <td>
                  <button onClick={() => void showHistory(row)}>
                    Histórico
                  </button>
                  {canManage && (
                    <button
                      className="institutional-row-action"
                      disabled={busy}
                      onClick={() => void changeStatus(row)}
                      aria-label={`${row.membership_status === 'active' ? 'Revogar' : 'Reativar'} vínculo de ${row.display_name}`}
                    >
                      <UserCog />
                      {row.membership_status === 'active'
                        ? 'Revogar'
                        : 'Reativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="institutional-table-empty">
            <Users />
            <p>Nenhum vínculo encontrado neste escopo.</p>
          </div>
        )}
      </div>
      <div className="phase12-pager">
        <button
          disabled={busy || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page + 1} · {total} vínculos
        </span>
        <button
          disabled={busy || (page + 1) * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
      {history && (
        <section className="phase12-box">
          <h3>Histórico do vínculo</h3>
          <button onClick={() => setHistory(null)}>Fechar histórico</button>
          {history.length ? (
            history.map((h, i) => (
              <p key={i}>
                {new Date(h.created_at).toLocaleString('pt-BR')} ·{' '}
                {h.actor ?? 'Sistema'} · {h.action} · {h.metadata.role} ·{' '}
                {h.metadata.status}
              </p>
            ))
          ) : (
            <p>
              Sem alterações registradas após a implantação desta auditoria.
            </p>
          )}
        </section>
      )}
      {canManage && (
        <InstitutionalInvitations
          network={networkId}
          schools={scopedSchools}
          roles={Object.fromEntries(
            availableRoles.map((role) => [role, roleLabels[role]]),
          )}
          preview={preview}
        />
      )}
    </section>
  );
}
