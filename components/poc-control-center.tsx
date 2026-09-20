'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, Filter, ShieldAlert } from 'lucide-react';
import matrix from '@/docs/poc/matriz-conformidade.json';

type Requirement = (typeof matrix.requirements)[number];
type Status = Requirement['status'];
type Severity = Requirement['severity'];

const statusLabels: Record<Status, string> = {
  ATENDIDO: 'Atendido',
  PARCIAL: 'Parcial',
  NAO_ATENDIDO: 'Não atendido',
  NAO_APLICAVEL: 'Não aplicável',
  DEPENDENCIA_EXTERNA: 'Dependência externa',
};

export function PocControlCenter() {
  const [status, setStatus] = useState<'ALL' | Status>('ALL');
  const [severity, setSeverity] = useState<'ALL' | Severity>('ALL');
  const requirements = matrix.requirements as Requirement[];
  const counts = useMemo(() => Object.fromEntries(Object.keys(statusLabels).map((key) => [key, requirements.filter((item) => item.status === key).length])) as Record<Status, number>, [requirements]);
  const filtered = requirements.filter((item) => (status === 'ALL' || item.status === status) && (severity === 'ALL' || item.severity === severity));
  const denominator = counts.ATENDIDO + counts.PARCIAL + counts.NAO_ATENDIDO;
  const conformity = denominator ? ((counts.ATENDIDO + counts.PARCIAL * 0.5) / denominator) * 100 : 0;
  const blockers = requirements.filter((item) => item.severity === 'P0' && item.status !== 'ATENDIDO').length;

  return <section id="poc" className="institutional-panel poc-control" aria-labelledby="poc-title">
    <header className="poc-head">
      <div><span><ClipboardCheck /> FASE 6 · FONTE ÚNICA</span><h2 id="poc-title">Control Center da PoC</h2><p>A classificação vem da matriz validada no repositório. Itens parciais e futuros permanecem visíveis.</p></div>
      <div className="poc-version"><ShieldAlert /><span>Base auditada</span><strong>{matrix.metadata.base_commit.slice(0, 8)}</strong></div>
    </header>
    <div className="poc-kpis">
      <article><ClipboardCheck /><span>Requisitos</span><strong>{requirements.length}</strong></article>
      <article className="success"><CheckCircle2 /><span>Atendidos</span><strong>{counts.ATENDIDO}</strong></article>
      <article className="warning"><AlertTriangle /><span>Parciais</span><strong>{counts.PARCIAL}</strong></article>
      <article className="danger"><ShieldAlert /><span>Bloqueadores P0</span><strong>{blockers}</strong></article>
      <article><span>Conformidade ponderada</span><strong>{conformity.toFixed(1).replace('.', ',')}%</strong><small>Dependências externas excluídas</small></article>
    </div>
    <div className="poc-filters" aria-label="Filtros da matriz de conformidade">
      <Filter aria-hidden="true" />
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | Status)}><option value="ALL">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Severidade<select value={severity} onChange={(event) => setSeverity(event.target.value as 'ALL' | Severity)}><option value="ALL">Todas</option>{['P0','P1','P2','P3'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <span>{filtered.length} resultado(s)</span>
    </div>
    <div className="poc-requirements">
      {filtered.map((item) => <details key={item.id} className={`poc-requirement status-${item.status.toLowerCase()}`}>
        <summary><span className={`poc-severity ${item.severity.toLowerCase()}`}>{item.severity}</span><strong>{item.id}</strong><span>{item.category}</span><b>{statusLabels[item.status]}</b></summary>
        <div className="poc-detail">
          <h3>{item.description}</h3>
          <dl><div><dt>Edital</dt><dd>{item.edital_reference}</dd></div><div><dt>Fase</dt><dd>{item.phase}</dd></div><div><dt>Perfil</dt><dd>{item.required_profile.join(', ') || 'Operação externa'}</dd></div><div><dt>Rota</dt><dd>{item.route || 'Sem rota demonstrável'}</dd></div></dl>
          {item.gap && <p className="poc-gap"><AlertTriangle /> <span><strong>Gap:</strong> {item.gap}</span></p>}
          <p><strong>Implementação:</strong> {item.implementation.join(', ') || 'Não implementada'}</p>
          <p><strong>Teste:</strong> {item.test.join(', ') || 'Não disponível'}</p>
          <p><strong>Evidência:</strong> {item.evidence.join(', ')}</p>
          {item.route && <a href={item.route}><ExternalLink /> Abrir cenário</a>}
        </div>
      </details>)}
    </div>
  </section>;
}
