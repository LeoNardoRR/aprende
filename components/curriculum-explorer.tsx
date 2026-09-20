'use client';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import { InstitutionalImport, type ImportReport } from './institutional-import';
type Reference = { id: string; name: string };
type Skill = {
  id: string;
  code: string;
  description: string;
  area: string;
  componente: string;
  ano: string;
  unidade: string;
  objeto: string;
  total_count: number;
};
export function CurriculumExplorer({
  network,
  curriculum,
  official,
  areas,
  subjects,
  years,
  units,
  objects,
  preview = false,
  onImported,
}: {
  network: string;
  curriculum: string;
  official: boolean;
  areas: Reference[];
  subjects: (Reference & { area_id: string })[];
  years: Reference[];
  units: (Reference & {
    subject_id: string;
    curriculum_school_year_id: string | null;
  })[];
  objects: (Reference & { thematic_unit_id: string })[];
  preview?: boolean;
  onImported: () => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Skill[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (preview) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      setRows(
        await institutionalRpc<Skill[]>('curriculum_skill_directory', {
          target_curriculum: curriculum,
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
  }, [curriculum, filters, page, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  const choices: Record<string, Reference[]> = {
    area: areas,
    subject: subjects.filter(
      (s) => !filters.area || s.area_id === filters.area,
    ),
    year: years,
    unit: units.filter(
      (u) =>
        (!filters.subject || u.subject_id === filters.subject) &&
        (!filters.year || u.curriculum_school_year_id === filters.year),
    ),
    object: objects.filter(
      (o) => !filters.unit || o.thematic_unit_id === filters.unit,
    ),
  };
  const keys = ['area', 'subject', 'year', 'unit', 'object'];
  return (
    <section className="phase12-box">
      <h3>Navegar pela estrutura curricular</h3>
      <div className="phase12-grid">
        {keys.map((key) => (
          <label key={key}>
            {
              {
                area: 'Área',
                subject: 'Componente',
                year: 'Ano',
                unit: 'Unidade temática',
                object: 'Objeto do conhecimento',
              }[key]
            }
            <select
              value={filters[key] ?? ''}
              onChange={(e) => {
                setFilters((current) => ({
                  ...Object.fromEntries(
                    Object.entries(current).filter(
                      ([k]) => keys.indexOf(k) < keys.indexOf(key),
                    ),
                  ),
                  [key]: e.target.value,
                }));
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              {choices[key].map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Buscar código ou descrição
          <input
            value={filters.search ?? ''}
            onChange={(e) => {
              setFilters((f) => ({ ...f, search: e.target.value }));
              setPage(0);
            }}
          />
        </label>
      </div>
      {busy && <p role="status">Carregando habilidades…</p>}
      {rows.map((row) => (
        <article key={row.id}>
          <h4>{row.code}</h4>
          <p>{row.description}</p>
          <small>
            {[row.area, row.componente, row.ano, row.unidade, row.objeto]
              .filter(Boolean)
              .join(' → ')}
          </small>
        </article>
      ))}
      {!rows.length && !busy && (
        <p>
          Nenhuma habilidade neste filtro. Conteúdo oficial não carregado deve
          ser fornecido por fonte validada.
        </p>
      )}
      <nav
        className="phase12-pager institutional-pagination"
        aria-label="Paginação de habilidades"
      >
        <button
          disabled={busy || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page + 1} · {rows[0]?.total_count ?? 0} habilidades
        </span>
        <button
          disabled={busy || (page + 1) * 50 >= (rows[0]?.total_count ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </nav>
      {!official ? (
        <InstitutionalImport
          title="Importar matriz curricular"
          columns="area, componente, ano_codigo, ano, unidade, objeto, codigo, descricao, action (opcional)"
          preview={preview}
          validate={(import_rows) =>
            institutionalRpc<ImportReport>('import_curriculum_rows', {
              job_id: crypto.randomUUID(),
              target_network: network,
              target_curriculum: curriculum,
              file_name: 'preview.csv',
              import_rows,
            })
          }
          commit={(job_id, file_name, import_rows) =>
            institutionalRpc<ImportReport>('import_curriculum_rows', {
              job_id,
              file_name,
              target_network: network,
              target_curriculum: curriculum,
              import_rows,
              confirm_write: true,
            })
          }
          onDone={() => {
            void load();
            onImported();
          }}
        />
      ) : (
        <p>
          BNCC/SAEB oficiais são somente leitura para a rede. A carga oficial
          usa o importador administrativo documentado, com fonte e versão
          verificadas.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
export type Coverage = {
  totals: Record<string, number>;
  groups: {
    componente: string;
    serie: string;
    difficulty: string;
    items: number;
    approved: number;
  }[];
  skills: {
    code: string;
    description: string;
    items: number;
    approved: number;
    total_count: number;
  }[];
  minimum_items: number;
};
export function ItemCoverage({
  network,
  curriculum,
  preview = false,
}: {
  network: string;
  curriculum: string;
  preview?: boolean;
}) {
  const [coverage, setCoverage] = useState<Coverage | null>(null),
    [page, setPage] = useState(0),
    [minimum, setMinimum] = useState(5),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (preview || !curriculum) {
      setCoverage(null);
      return;
    }
    setBusy(true);
    try {
      setCoverage(
        await institutionalRpc<Coverage>('item_bank_coverage', {
          target_network: network,
          target_curriculum: curriculum,
          minimum_items: minimum,
          page_size: 25,
          page_offset: page * 25,
        }),
      );
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }, [network, curriculum, preview, page, minimum]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="phase12-box item-coverage-card">
      <header className="institutional-section-card-head">
        <span>
          <BarChart3 />
        </span>
        <div>
          <small>Qualidade do acervo</small>
          <h3>Cobertura do Banco de Itens</h3>
          <p>
            Contagens do servidor para o currículo selecionado, considerando
            itens aprovados.
          </p>
        </div>
      </header>
      <div className="item-coverage-controls">
        <label>
          Meta mínima por habilidade
          <input
            type="number"
            min={1}
            max={1000}
            value={minimum}
            onChange={(e) => {
              setMinimum(Math.max(1, Number(e.target.value)));
              setPage(0);
            }}
          />
        </label>
        <button disabled={busy || preview} onClick={() => void load()}>
          Atualizar cobertura
        </button>
      </div>
      {coverage ? (
        <>
          <div className="phase12-grid item-coverage-metrics">
            {Object.entries(coverage.totals).map(([key, value]) => (
              <p key={key}>
                {{
                  total: 'Total',
                  draft: 'Rascunhos',
                  in_review: 'Em revisão',
                  reviewed: 'Revisados',
                  approved: 'Aprovados',
                  rejected: 'Rejeitados',
                  uncovered: 'Sem aprovados',
                  low_coverage: 'Baixa cobertura',
                }[key] ?? key}
                : <strong>{value}</strong>
              </p>
            ))}
          </div>
          <div className="institutional-table-wrap">
            <table className="institutional-table">
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Série</th>
                  <th>Dificuldade</th>
                  <th>Itens</th>
                  <th>Aprovados</th>
                </tr>
              </thead>
              <tbody>
                {coverage.groups.map((g, i) => (
                  <tr key={i}>
                    <td>{g.componente}</td>
                    <td>{g.serie}</td>
                    <td>{g.difficulty}</td>
                    <td>{g.items}</td>
                    <td>{g.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Habilidades e lacunas</h4>
          {coverage.skills.map((s) => (
            <p key={s.code}>
              <strong>{s.code}</strong> · {s.items} itens · {s.approved}{' '}
              aprovados
              <br />
              {s.description}
              <progress
                aria-label={`Cobertura de ${s.code}`}
                max={minimum}
                value={Math.min(s.approved, minimum)}
              />
            </p>
          ))}
          <nav
            className="phase12-pager institutional-pagination"
            aria-label="Paginação da cobertura por habilidade"
          >
            <button
              disabled={busy || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              disabled={
                busy ||
                (page + 1) * 25 >= (coverage.skills[0]?.total_count ?? 0)
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </nav>
        </>
      ) : (
        <p>
          {preview
            ? 'Modo DEMO — não representa cobertura real.'
            : 'Selecione um currículo para consultar.'}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
