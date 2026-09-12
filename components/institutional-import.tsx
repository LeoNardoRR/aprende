'use client';
import { useState } from 'react';
import { parseImport, type ImportRow } from '@/lib/import-data';
import { operationError } from '@/lib/institutional-tools';
export type ImportReport = {
  rows: {
    line: number;
    email?: string;
    codigo?: string;
    action: string;
    valid: boolean;
    errors: string[];
    result?: string;
  }[];
  total: number;
  valid?: number;
  invalid: number;
  processed?: number;
  created?: number;
  updated?: number;
  ignored?: number;
};
export function InstitutionalImport({
  title,
  columns,
  preview = false,
  validate,
  commit,
  onDone,
}: {
  title: string;
  columns: string;
  preview?: boolean;
  validate: (rows: ImportRow[]) => Promise<ImportReport>;
  commit: (
    id: string,
    name: string,
    rows: ImportRow[],
  ) => Promise<ImportReport>;
  onDone?: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]),
    [name, setName] = useState(''),
    [job, setJob] = useState(''),
    [report, setReport] = useState<ImportReport | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [done, setDone] = useState(false);
  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    setNotice('');
    setReport(null);
    setDone(false);
    setConfirmed(false);
    setRows([]);
    try {
      const format = file.name.endsWith('.json') ? 'json' : 'csv';
      const parsed = parseImport(await file.text(), format).map((row) => ({
        ...row,
        action: row.action || 'CREATE',
      }));
      setRows(parsed);
      setName(file.name);
      setJob(crypto.randomUUID());
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function run(write: boolean) {
    setBusy(true);
    setNotice('');
    try {
      if (preview) {
        setNotice('Modo DEMO: nenhuma validação ou gravação de dados reais.');
        return;
      }
      const result = write
        ? await commit(job, name, rows)
        : await validate(rows);
      setReport(result);
      if (write) {
        setDone(true);
        setNotice('Lote processado. Confira o relatório por linha.');
        onDone?.();
      }
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="phase12-box">
      <h3>{title}</h3>
      <p>
        CSV ou JSON, até 200 linhas por lote. Colunas: {columns}. CREATE cria,
        UPDATE atualiza e SKIP ignora explicitamente.
      </p>
      <label>
        Arquivo
        <input
          type="file"
          accept=".csv,.json"
          disabled={busy}
          onChange={(event) => void load(event.target.files?.[0])}
        />
      </label>
      {!!rows.length && (
        <>
          <p>
            {name} · {rows.length} linhas
          </p>
          <div className="institutional-table-wrap">
            <table className="institutional-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Dados</th>
                  <th>Decisão</th>
                  <th>Validação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      {Object.entries(row)
                        .filter(([key]) => key !== 'action')
                        .map(([key, value]) => (
                          <small key={key}>
                            {key}: {value}
                          </small>
                        ))}
                    </td>
                    <td>
                      <select
                        aria-label={`Decisão da linha ${index + 1}`}
                        value={row.action}
                        disabled={busy || done}
                        onChange={(event) => {
                          setRows((current) =>
                            current.map((value, i) =>
                              i === index
                                ? { ...value, action: event.target.value }
                                : value,
                            ),
                          );
                          setReport(null);
                          setConfirmed(false);
                          setJob(crypto.randomUUID());
                        }}
                      >
                        {['CREATE', 'UPDATE', 'SKIP'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {report?.rows[index]
                        ? report.rows[index].errors.length
                          ? report.rows[index].errors.join('; ')
                          : (report.rows[index].result ?? 'Válida')
                        : 'A validar'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={busy || done} onClick={() => void run(false)}>
            Validar sem gravar
          </button>
          {report && (
            <>
              <p>
                Válidas: {report.total - report.invalid} · Inválidas:{' '}
                {report.invalid}
                {done &&
                  ` · Processadas: ${report.processed ?? (report.created ?? 0) + (report.updated ?? 0)} · Ignoradas: ${report.ignored ?? report.rows.filter((r) => r.action === 'SKIP').length}`}
              </p>
              {!done && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{' '}
                    Confirmo as decisões e a gravação das linhas válidas deste
                    lote.
                  </label>
                  <button
                    disabled={busy || !confirmed || preview}
                    onClick={() => void run(true)}
                  >
                    Confirmar importação
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      {busy && <p role="status">Processando…</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
