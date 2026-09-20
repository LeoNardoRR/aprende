'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, UsersRound } from 'lucide-react';
import type { Tables } from '@/lib/database.types';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import { downloadCsv } from '@/lib/import-data';
import { InstitutionalImport, type ImportReport } from './institutional-import';
type Enrollment = {
  id: string;
  student_id: string;
  nome: string;
  email: string;
  identificador: string | null;
  escola: string;
  serie: string;
  turma: string;
  ano_letivo: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  classroom_id: string;
  total_count: number;
};
const fields = [
  'nome',
  'email',
  'identificador',
  'escola',
  'serie',
  'turma',
  'ano_letivo',
  'status',
  'starts_on',
  'ends_on',
];
export function InstitutionalBulk({
  networks,
  schools,
  academicYears,
  schoolYears,
  classrooms,
  preview = false,
}: {
  networks: Tables<'networks'>[];
  schools: Tables<'schools'>[];
  academicYears: Tables<'academic_years'>[];
  schoolYears: Tables<'school_years'>[];
  classrooms: Tables<'classrooms'>[];
  preview?: boolean;
}) {
  const [network, setNetwork] = useState(networks[0]?.id ?? ''),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Enrollment[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [targetYear, setTargetYear] = useState(''),
    [targetGrade, setTargetGrade] = useState(''),
    [target, setTarget] = useState(''),
    [job, setJob] = useState(''),
    [promotion, setPromotion] = useState<{
      rows: unknown[];
      processed: number;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!network && networks[0]) setNetwork(networks[0].id);
  }, [network, networks]);
  const load = useCallback(async () => {
    if (preview || !network) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      setRows(
        await institutionalRpc<Enrollment[]>('enrollment_directory', {
          target_network: network,
          filters,
          page_size: 50,
          page_offset: page * 50,
        }),
      );
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }, [network, filters, page, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  function filter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
    setSelected([]);
    setPromotion(null);
    setConfirmed(false);
  }
  async function exportRows() {
    if (preview) {
      setNotice('Modo DEMO: sem dados reais para exportar.');
      return;
    }
    setBusy(true);
    try {
      const all: Enrollment[] = [];
      for (let offset = 0; ; offset += 200) {
        const part = await institutionalRpc<Enrollment[]>(
          'enrollment_directory',
          {
            target_network: network,
            filters,
            page_size: 200,
            page_offset: offset,
          },
        );
        all.push(...part);
        if (part.length < 200) break;
      }
      downloadCsv('matriculas.csv', all, fields);
      setNotice(`${all.length} matrículas autorizadas exportadas.`);
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function selectClass() {
    setBusy(true);
    try {
      const all = await institutionalRpc<Enrollment[]>('enrollment_directory', {
        target_network: network,
        filters: {
          school: filters.school,
          classroom: filters.classroom,
          status: 'enrolled',
        },
        page_size: 200,
      });
      if ((all[0]?.total_count ?? 0) > 200)
        throw new Error(
          'Turma com mais de 200 matrículas: promova em lotes selecionados.',
        );
      setSelected(all.map((row) => row.id));
      setPromotion(null);
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function promote(write: boolean) {
    setBusy(true);
    try {
      const id = write ? job : crypto.randomUUID();
      const result = await institutionalRpc<{
        rows: unknown[];
        processed: number;
      }>('promote_students', {
        job_id: id,
        source_classroom: filters.classroom,
        target_classroom: target,
        enrollment_ids: selected,
        confirm_write: write,
      });
      setJob(id);
      setPromotion(result);
      setConfirmed(false);
      if (write) {
        setNotice(
          `${result.processed} alunos promovidos; histórico preservado.`,
        );
        setSelected([]);
        await load();
      }
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  const destinations = classrooms.filter(
    (c) =>
      c.network_id === network &&
      c.school_id === filters.school &&
      c.academic_year_id === targetYear &&
      c.school_year_id === targetGrade &&
      c.classroom_status === 'active',
  );
  return (
    <section
      className="phase12-box institutional-bulk-panel"
      id="institutional-bulk"
    >
      <header className="institutional-section-card-head">
        <span>
          <UsersRound />
        </span>
        <div>
          <small>Gestão de matrículas</small>
          <h3>Operações em lote e exportação</h3>
          <p>
            Filtre, exporte e prepare movimentações com o histórico preservado.
          </p>
        </div>
      </header>
      {preview && (
        <p className="phase12-notice">
          Modo DEMO — operações reais desabilitadas.
        </p>
      )}
      <div className="phase12-grid institutional-bulk-filters">
        <label>
          Rede
          <select
            value={network}
            onChange={(e) => {
              setNetwork(e.target.value);
              setFilters({});
              setPage(0);
              setSelected([]);
              setPromotion(null);
            }}
          >
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Escola
          <select
            value={filters.school ?? ''}
            onChange={(e) => {
              setFilters({ school: e.target.value });
              setPage(0);
              setSelected([]);
              setPromotion(null);
            }}
          >
            <option value="">Todas</option>
            {schools
              .filter((s) => s.network_id === network)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ano letivo
          <select
            value={filters.year ?? ''}
            onChange={(e) => filter('year', e.target.value)}
          >
            <option value="">Todos</option>
            {academicYears
              .filter((y) => y.network_id === network)
              .map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Série
          <select
            value={filters.grade ?? ''}
            onChange={(e) => filter('grade', e.target.value)}
          >
            <option value="">Todas</option>
            {schoolYears
              .filter((g) => !filters.school || g.school_id === filters.school)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Turma de origem
          <select
            value={filters.classroom ?? ''}
            onChange={(e) => filter('classroom', e.target.value)}
          >
            <option value="">Todas</option>
            {classrooms
              .filter(
                (c) =>
                  c.network_id === network &&
                  (!filters.school || c.school_id === filters.school) &&
                  (!filters.year || c.academic_year_id === filters.year) &&
                  (!filters.grade || c.school_year_id === filters.grade),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filters.status ?? ''}
            onChange={(e) => filter('status', e.target.value)}
          >
            <option value="">Todos</option>
            {[
              'enrolled',
              'suspended',
              'transferred',
              'removed',
              'completed',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="institutional-export-action"
        disabled={busy || preview}
        onClick={() => void exportRows()}
      >
        <Download /> Exportar CSV com estes filtros
      </button>
      <div className="institutional-table-wrap">
        <table className="institutional-table">
          <thead>
            <tr>
              <th>Selecionar</th>
              <th>Aluno</th>
              <th>Escola / turma / ano</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${row.nome}`}
                    disabled={row.status !== 'enrolled' || !filters.classroom}
                    checked={selected.includes(row.id)}
                    onChange={(e) => {
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, row.id]
                          : ids.filter((id) => id !== row.id),
                      );
                      setPromotion(null);
                      setConfirmed(false);
                    }}
                  />
                </td>
                <td>
                  {row.nome}
                  <small>{row.email}</small>
                </td>
                <td>
                  {row.escola}
                  <small>
                    {row.turma} · {row.ano_letivo}
                  </small>
                </td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="institutional-expanded-empty compact">
          <UsersRound />
          <div>
            <strong>Nenhuma matrícula neste filtro</strong>
            <p>Ajuste os filtros para localizar estudantes.</p>
          </div>
        </div>
      )}
      <nav
        className="phase12-pager institutional-pagination"
        aria-label="Paginação de matrículas em lote"
      >
        <button
          disabled={busy || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page + 1} · {rows[0]?.total_count ?? 0} matrículas
        </span>
        <button
          disabled={
            busy ||
            rows.length < 50 ||
            (page + 1) * 50 >= (rows[0]?.total_count ?? 0)
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </nav>
      {filters.school && (
        <InstitutionalImport
          key={`${network}-${filters.school}`}
          title="Importar alunos"
          columns="nome, email, identificador (opcional), rede, escola, ano_letivo, serie, turma, action (opcional)"
          preview={preview}
          validate={(import_rows) =>
            institutionalRpc<ImportReport>('preview_student_import', {
              target_network: network,
              target_school: filters.school,
              import_rows,
            })
          }
          commit={(job_id, file_name, import_rows) =>
            institutionalRpc<ImportReport>('commit_student_import', {
              job_id,
              file_name,
              target_network: network,
              target_school: filters.school,
              import_rows,
            })
          }
          onDone={() => void load()}
        />
      )}
      {!filters.school && (
        <p>Selecione uma escola para importar ou promover alunos.</p>
      )}
      {filters.school && filters.classroom && (
        <section>
          <h3>Promoção para outro ano letivo</h3>
          <p>
            {selected.length} alunos selecionados. O registro de origem será
            concluído e preservado.
          </p>
          <button disabled={busy || preview} onClick={() => void selectClass()}>
            Selecionar turma inteira
          </button>
          <div className="phase12-grid">
            <label>
              Ano de destino
              <select
                value={targetYear}
                onChange={(e) => {
                  setTargetYear(e.target.value);
                  setTarget('');
                  setPromotion(null);
                }}
              >
                <option value="">Selecione</option>
                {academicYears
                  .filter(
                    (y) => y.network_id === network && y.status !== 'closed',
                  )
                  .map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Série de destino
              <select
                value={targetGrade}
                onChange={(e) => {
                  setTargetGrade(e.target.value);
                  setTarget('');
                  setPromotion(null);
                }}
              >
                <option value="">Selecione</option>
                {schoolYears
                  .filter((g) => g.school_id === filters.school)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Turma de destino
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setPromotion(null);
                }}
              >
                <option value="">Selecione</option>
                {destinations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            disabled={busy || !target || !selected.length || preview}
            onClick={() => void promote(false)}
          >
            Prévia da promoção
          </button>
          {promotion && selected.length > 0 && (
            <>
              <p>
                {promotion.rows.length} alunos validados para a turma{' '}
                {destinations.find((c) => c.id === target)?.name}.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                Confirmo a promoção e a conclusão das matrículas de origem.
              </label>
              <button
                disabled={busy || !confirmed}
                onClick={() => void promote(true)}
              >
                Confirmar promoção
              </button>
            </>
          )}
        </section>
      )}
      {busy && <p role="status">Carregando…</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
