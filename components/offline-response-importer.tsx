'use client';

import { useState } from 'react';
import {
  createOfflineImportPreview,
  offlineImportIssueLabel,
  parseOfflineResponseFile,
  setOfflineImportDecision,
  type OfflineImportAudit,
  type OfflineImportCatalog,
  type OfflineImportDecision,
  type OfflineImportPreview,
} from '@/lib/offline-response-import';

export function OfflineResponseImporter({
  catalog,
  commit,
}: {
  catalog: OfflineImportCatalog;
  commit: (preview: OfflineImportPreview) => Promise<{
    status: 'imported' | 'already_imported';
    audit: OfflineImportAudit;
  }>;
}) {
  const [preview, setPreview] = useState<OfflineImportPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    setNotice('');
    setPreview(null);
    setConfirmed(false);
    try {
      const content = file.name.toLocaleLowerCase('pt-BR').endsWith('.xlsx')
        ? await file.arrayBuffer()
        : await file.text();
      const rows = await parseOfflineResponseFile(content, file.name);
      setPreview(await createOfflineImportPreview(file.name, rows, catalog));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  function decide(line: number, decision: OfflineImportDecision) {
    if (!preview) return;
    try {
      setPreview(setOfflineImportDecision(preview, line, decision));
      setConfirmed(false);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Decisão inválida.');
    }
  }

  async function confirmImport() {
    if (!preview || !confirmed) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await commit(preview);
      setNotice(
        result.status === 'already_imported'
          ? `Este arquivo já foi importado no lote ${result.audit.batchId}. Nenhuma resposta foi duplicada.`
          : `Lote ${result.audit.batchId} concluído: ${result.audit.created} criadas, ${result.audit.updated} atualizadas, ${result.audit.skipped} ignoradas e ${result.audit.rejected} rejeitadas.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível concluir a importação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="phase12-box" aria-labelledby="offline-import-title">
      <h3 id="offline-import-title">Importar respostas offline</h3>
      <p>
        Envie CSV ou XLSX com avaliação, aluno, questão e resposta. O arquivo será validado antes
        de qualquer gravação.
      </p>
      <label>
        Arquivo de respostas
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(event) => void load(event.target.files?.[0])}
        />
      </label>
      {preview && (
        <>
          <p>
            {preview.filename} · {preview.total} linhas · {preview.valid} válidas ·{' '}
            {preview.invalid} inválidas · {preview.conflicts} conflitos
          </p>
          <div className="institutional-table-wrap">
            <table className="institutional-table">
              <caption>Prévia da importação sem gravação</caption>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Aluno</th>
                  <th>Questão</th>
                  <th>Resposta</th>
                  <th>Validação</th>
                  <th>Decisão</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row.line}-${row.studentId}-${row.questionId}`}>
                    <td>{row.line}</td>
                    <td>{row.studentId || 'Não informado'}</td>
                    <td>{row.questionId || 'Não informada'}</td>
                    <td>{row.answer || 'Não informada'}</td>
                    <td>
                      {row.issues.length
                        ? row.issues.map(offlineImportIssueLabel).join('; ')
                        : 'Válida'}
                    </td>
                    <td>
                      <select
                        aria-label={`Decisão da linha ${row.line}`}
                        value={row.decision}
                        disabled={busy || !row.valid}
                        onChange={(event) =>
                          decide(row.line, event.target.value as OfflineImportDecision)
                        }
                      >
                        <option value="CREATE" disabled={row.conflict}>
                          Criar
                        </option>
                        <option value="UPDATE">Atualizar</option>
                        <option value="SKIP">Ignorar</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{' '}
            Confirmo as decisões exibidas nesta prévia.
          </label>
          <button type="button" disabled={busy || !confirmed} onClick={() => void confirmImport()}>
            {busy ? 'Importando…' : 'Confirmar importação'}
          </button>
        </>
      )}
      {busy && <p role="status">Processando arquivo…</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
