'use client';
import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, MailPlus, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import { parseImport } from '@/lib/import-data';
type Invitation = {
  id: string;
  email: string;
  role: string;
  school_id: string | null;
  status: string;
  expires_at: string;
  total_count: number;
};
export function InstitutionalInvitations({
  network,
  schools,
  roles,
  preview = false,
}: {
  network: string;
  schools: { id: string; name: string }[];
  roles: Record<string, string>;
  preview?: boolean;
}) {
  const [email, setEmail] = useState(''),
    [role, setRole] = useState(Object.keys(roles)[0] ?? 'student'),
    [school, setSchool] = useState(''),
    [rows, setRows] = useState<Invitation[]>([]),
    [page, setPage] = useState(0),
    [batch, setBatch] = useState<
      { email: string; role: string; school_id: string }[]
    >([]),
    [results, setResults] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (preview || !network) return;
    try {
      setRows(
        await institutionalRpc<Invitation[]>(
          'institutional_invitation_directory',
          { target_network: network, page_size: 25, page_offset: page * 25 },
        ),
      );
    } catch (error) {
      setNotice(operationError(error));
    }
  }, [network, page, preview]);
  useEffect(() => {
    setPage(0);
    setBatch([]);
    setResults([]);
    setConfirmed(false);
  }, [network]);
  useEffect(() => {
    void load();
  }, [load]);
  async function send(
    entry: { email: string; role: string; school_id: string },
    action = 'invite',
    id?: string,
  ) {
    const response = await supabase.functions.invoke('institutional-invite', {
      body: { ...entry, network_id: network, action, invitation_id: id },
    });
    if (response.error || response.data?.error)
      throw new Error(
        response.data?.error ??
          'Envio indisponível. Confira o serviço de convites e tente reenviar.',
      );
  }
  async function individual() {
    setBusy(true);
    try {
      await send({ email, role, school_id: school });
      setNotice(
        'Solicitação de ativação enviada. O vínculo será aplicado após aceitação.',
      );
      setEmail('');
      await load();
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function change(row: Invitation, action: string) {
    if (
      action === 'revoke' &&
      !window.confirm(`Revogar convite de ${row.email}?`)
    )
      return;
    setBusy(true);
    try {
      if (action === 'revoke')
        await institutionalRpc('manage_institutional_invitation', {
          target_network: network,
          target_school: row.school_id,
          target_email: row.email,
          target_role: row.role,
          target_action: 'revoke',
          invitation_id: row.id,
        });
      else
        await send(
          { email: row.email, role: row.role, school_id: row.school_id ?? '' },
          action,
          row.id,
        );
      setNotice(
        action === 'revoke' ? 'Convite revogado.' : 'Reenvio solicitado.',
      );
      await load();
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function file(file?: File) {
    if (!file) return;
    try {
      const data = parseImport(await file.text(), 'csv');
      const seen = new Set<string>();
      const entries = data.map((r, index) => {
        const email = r.email?.toLowerCase();
        if (
          !email ||
          !/^\S+@\S+\.\S+$/.test(email) ||
          seen.has(email) ||
          !roles[r.papel] ||
          !schools.some((s) => s.id === r.escola)
        )
          throw new Error(
            `Linha ${index + 1}: e-mail, duplicidade, papel ou ID de escola inválido.`,
          );
        seen.add(email);
        return { email, role: r.papel, school_id: r.escola };
      });
      setBatch(entries);
      setResults([]);
      setConfirmed(false);
    } catch (error) {
      setNotice(operationError(error));
    }
  }
  async function sendBatch() {
    setBusy(true);
    const outcomes: string[] = [];
    for (const entry of batch) {
      try {
        await send(entry);
        outcomes.push(`${entry.email}: ativação solicitada`);
      } catch (error) {
        outcomes.push(`${entry.email}: ${operationError(error)}`);
      }
      setResults([...outcomes]);
    }
    setConfirmed(false);
    setBatch([]);
    setBusy(false);
    await load();
  }
  return (
    <section className="phase12-box institutional-invitations">
      <header>
        <div className="institutional-invitation-icon">
          <MailPlus />
        </div>
        <div>
          <span>Entrada segura de usuários</span>
          <h3>Convites e acesso inicial</h3>
          <p>
            O destinatário confirma o e-mail e define a própria senha. Convites
            expiram em sete dias.
          </p>
        </div>
      </header>
      {preview && (
        <p className="institutional-demo-note">
          Modo DEMO: envio desabilitado.
        </p>
      )}
      <form
        className="phase12-grid institutional-invitation-form"
        onSubmit={(e) => {
          e.preventDefault();
          void individual();
        }}
      >
        <label>
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Papel
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(roles).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Escola
          <select
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            required={['teacher', 'student'].includes(role)}
          >
            <option value="">Toda a rede (se autorizado)</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="institutional-primary-action"
          disabled={busy || preview || !network}
        >
          Enviar convite
        </button>
      </form>
      <div className="institutional-batch-upload">
        <FileSpreadsheet />
        <div>
          <strong>Convites em lote</strong>
          <small>Use um CSV com as colunas: email, papel e escola (ID).</small>
        </div>
        <label className="institutional-file-button">
          <Upload /> Selecionar CSV
          <input
            type="file"
            accept=".csv"
            disabled={busy || preview}
            onChange={(e) => void file(e.target.files?.[0])}
          />
        </label>
      </div>
      {!!batch.length && (
        <div className="institutional-batch-preview">
          <header>
            <strong>{batch.length} convites preparados</strong>
            <small>Revise os destinatários antes de confirmar.</small>
          </header>
          <ul>
            {batch.map((e) => (
              <li key={e.email}>
                {e.email} · {roles[e.role]} ·{' '}
                {schools.find((s) => s.id === e.school_id)?.name}
              </li>
            ))}
          </ul>
          <label className="institutional-confirm-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            Confirmo o envio de {batch.length} convites.
          </label>
          <button
            className="institutional-primary-action"
            disabled={busy || !confirmed || preview}
            onClick={() => void sendBatch()}
          >
            Enviar lote confirmado
          </button>
        </div>
      )}
      {!!results.length && (
        <div className="institutional-invitation-results" role="status">
          {results.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      )}
      <div className="institutional-table-wrap">
        <table className="institutional-table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status / expiração</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{roles[row.role] ?? row.role}</td>
                <td>
                  {row.status}
                  <small>
                    {new Date(row.expires_at).toLocaleString('pt-BR')}
                  </small>
                </td>
                <td>
                  {['pending', 'expired'].includes(row.status) && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => void change(row, 'resend')}
                      >
                        Reenviar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void change(row, 'revoke')}
                      >
                        Revogar convite
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="institutional-expanded-empty compact">
          <MailPlus />
          <div>
            <strong>Nenhum convite neste escopo</strong>
            <p>Os convites enviados aparecerão aqui.</p>
          </div>
        </div>
      )}
      <nav
        className="phase12-pager institutional-pagination"
        aria-label="Paginação de convites"
      >
        <button
          disabled={page === 0 || busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          disabled={busy || (page + 1) * 25 >= (rows[0]?.total_count ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </nav>
      {busy && (
        <p className="institutional-inline-notice" role="status">
          Processando…
        </p>
      )}
      {notice && (
        <p className="institutional-inline-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
