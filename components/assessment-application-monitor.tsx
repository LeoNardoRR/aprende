'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Check, ChevronLeft, ChevronRight, ClipboardCopy, Eye, KeyRound,
  LoaderCircle, RefreshCw, RotateCcw, ShieldAlert, Square, UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type RpcError = { message: string };
type RpcResponse<T> = { data: T | null; error: RpcError | null };
const runtimeApi = supabase as unknown as {
  rpc<T>(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse<T>>;
};

type MonitorRow = {
  attempt_id: string | null;
  schedule_id: string;
  student_id: string;
  student_name: string;
  classroom_id: string;
  classroom_name: string;
  booklet_code: string | null;
  attempt_status: string;
  submission_kind: string | null;
  answered_count: number;
  question_count: number;
  progress_percent: number | null;
  started_at: string | null;
  last_activity_at: string | null;
  deadline_at: string | null;
  seconds_remaining: number | null;
  total_count: number;
};

const PAGE_SIZE = 50;

type EssayRow = {
  response_id: string;
  attempt_id: string;
  student_name: string;
  classroom_name: string;
  question_position: number;
  statement: string;
  response_text: string;
  max_points: number;
  points_awarded: number | null;
  reviewer_comment: string | null;
  review_status: string;
};

type EventRow = {
  event_id: number;
  event_type: string;
  actor_name: string | null;
  reason: string | null;
  created_at: string;
};

export function AssessmentApplicationMonitor({
  assessmentId,
  preview,
  onNotice,
}: {
  assessmentId: string;
  preview: boolean;
  onNotice: (message: string) => void;
}) {
  const [attempts, setAttempts] = useState<MonitorRow[]>([]);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Record<string, EventRow[]>>({});
  const [busy, setBusy] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (preview || !assessmentId) return;
    const [monitorResult, essayResult] = await Promise.all([
      runtimeApi.rpc<MonitorRow[]>('list_assessment_attempt_monitor', { target_assessment: assessmentId, page_size: PAGE_SIZE, page_offset: page * PAGE_SIZE }),
      runtimeApi.rpc<EssayRow[]>('list_pending_essay_responses', { target_assessment: assessmentId, page_size: 100, page_offset: 0 }),
    ]);
    const error = monitorResult.error ?? essayResult.error;
    if (error) onNotice(`Não foi possível carregar o acompanhamento: ${error.message}`);
    setAttempts(monitorResult.data ?? []);
    setEssays(essayResult.data ?? []);
  }, [assessmentId, onNotice, page, preview]);

  useEffect(() => { setPage(0); }, [assessmentId]);

  useEffect(() => {
    void load();
    if (preview || !assessmentId) return;
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [assessmentId, load, preview]);

  async function issueToken(scheduleId: string, studentId: string) {
    const key = `${scheduleId}-${studentId}`;
    setBusy(key);
    const result = await runtimeApi.rpc<Array<{ attempt_id: string; access_token: string; expires_at: string; booklet_code: string }>>('issue_assessment_access_token', {
      target_schedule: scheduleId, target_student: studentId, valid_minutes: 120,
    });
    setBusy('');
    if (result.error || !result.data?.[0]) { onNotice(result.error?.message ?? 'Não foi possível emitir o token.'); return; }
    setIssuedTokens((current) => ({ ...current, [studentId]: result.data![0].access_token }));
    onNotice(`Token do caderno ${result.data[0].booklet_code} emitido. Ele será exibido somente nesta sessão.`);
    await load();
  }

  async function revokeToken(attemptId: string, studentId: string) {
    const reason = window.prompt('Motivo da revogação do token:')?.trim();
    if (!reason) return;
    setBusy(attemptId);
    const result = await runtimeApi.rpc('revoke_assessment_access_token', { target_attempt: attemptId, action_reason: reason });
    setBusy('');
    if (result.error) onNotice(result.error.message);
    else {
      setIssuedTokens((current) => { const next = { ...current }; delete next[studentId]; return next; });
      onNotice('Token revogado.');
      await load();
    }
  }

  async function manageAttempt(attemptId: string, action: 'cancel' | 'close' | 'invalidate' | 'reopen') {
    const labels = { cancel: 'cancelamento', close: 'encerramento', invalidate: 'invalidação', reopen: 'reabertura' };
    const reason = action === 'close'
      ? (window.confirm('Encerrar esta prova agora e corrigir as respostas já salvas?') ? 'Encerramento manual durante a aplicação' : '')
      : window.prompt(`Motivo do ${labels[action]} da tentativa:`)?.trim();
    if (!reason) return;
    setBusy(attemptId);
    const result = await runtimeApi.rpc('manage_assessment_attempt', { target_attempt: attemptId, target_action: action, action_reason: reason });
    setBusy('');
    if (result.error) onNotice(result.error.message);
    else { onNotice(`Ação de ${labels[action]} registrada no histórico.`); await load(); }
  }

  async function reviewEssay(response: EssayRow) {
    const points = Number(grades[response.response_id] ?? response.points_awarded ?? response.max_points);
    if (!Number.isFinite(points) || points < 0 || points > Number(response.max_points)) {
      onNotice(`Informe uma nota entre 0 e ${response.max_points}.`); return;
    }
    setBusy(response.response_id);
    const result = await runtimeApi.rpc('review_essay_response', {
      target_response: response.response_id, awarded_points: points,
      review_comment: comments[response.response_id]?.trim() || null,
    });
    setBusy('');
    if (result.error) onNotice(result.error.message); else { onNotice('Resposta discursiva corrigida.'); await load(); }
  }

  async function toggleEvents(attemptId: string) {
    if (events[attemptId]) { setEvents((current) => { const next = { ...current }; delete next[attemptId]; return next; }); return; }
    const result = await runtimeApi.rpc<EventRow[]>('list_assessment_attempt_events', { target_attempt: attemptId });
    if (result.error) onNotice(result.error.message);
    else setEvents((current) => ({ ...current, [attemptId]: result.data ?? [] }));
  }

  if (!assessmentId) return <div className="phase4-monitor-empty">Selecione uma avaliação para acompanhar a aplicação.</div>;

  const total = Number(attempts[0]?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <section className="phase4-monitor" aria-labelledby="phase4-monitor-title">
    <header><div><span>MONITORAMENTO EM TEMPO REAL</span><h3 id="phase4-monitor-title">Acompanhamento da aplicação</h3><p>Atualização agrupada a cada 15 segundos por avaliação.</p></div><button onClick={() => void load()}><RefreshCw /> Atualizar agora</button></header>
    <div className="institutional-table-wrap"><table className="institutional-table"><thead><tr><th>Aluno</th><th>Caderno</th><th>Progresso</th><th>Início / atividade</th><th>Tempo</th><th>Status</th><th>Ações</th></tr></thead><tbody>{attempts.map((attempt) => {
      const token = issuedTokens[attempt.student_id];
      const key = `${attempt.schedule_id}-${attempt.student_id}`;
      return <tr key={key}><td><strong>{attempt.student_name}</strong><small>{attempt.classroom_name}</small>{token && <code className="phase4-token">{token}<button aria-label="Copiar token" onClick={() => void navigator.clipboard.writeText(token)}><ClipboardCopy /></button></code>}</td><td>{attempt.booklet_code ? `Caderno ${attempt.booklet_code}` : '—'}</td><td>{attempt.attempt_id ? <><strong>{attempt.answered_count}/{attempt.question_count}</strong><small>{Number(attempt.progress_percent ?? 0).toFixed(0)}%</small></> : 'Não iniciada'}</td><td>{attempt.started_at ? <><span>{formatDate(attempt.started_at)}</span><small>{attempt.last_activity_at ? `Última: ${formatDate(attempt.last_activity_at)}` : 'Sem atividade'}</small></> : '—'}</td><td>{attempt.seconds_remaining == null ? '—' : formatSeconds(attempt.seconds_remaining)}</td><td><span className={`institutional-status-pill ${statusTone(attempt.attempt_status)}`}>{statusLabel(attempt)}</span></td><td><div className="phase4-actions"><button disabled={busy === key} onClick={() => void issueToken(attempt.schedule_id, attempt.student_id)}>{busy === key ? <LoaderCircle className="spin" /> : <KeyRound />} {attempt.attempt_id ? 'Novo token' : 'Emitir token'}</button>{attempt.attempt_id && <><button disabled={busy === attempt.attempt_id || !['scheduled','available'].includes(attempt.attempt_status)} onClick={() => void revokeToken(attempt.attempt_id!, attempt.student_id)}><Ban /> Revogar</button><button onClick={() => void toggleEvents(attempt.attempt_id!)}><Eye /> Eventos</button>{['scheduled','available','in_progress','paused'].includes(attempt.attempt_status) && <button className="danger" onClick={() => void manageAttempt(attempt.attempt_id!, 'cancel')}><Ban /> Cancelar</button>}{['in_progress','paused'].includes(attempt.attempt_status) && <button onClick={() => void manageAttempt(attempt.attempt_id!, 'close')}><Square /> Encerrar</button>}{['submitted','auto_submitted','pending_review','graded'].includes(attempt.attempt_status) && <button className="danger" onClick={() => void manageAttempt(attempt.attempt_id!, 'invalidate')}><ShieldAlert /> Invalidar</button>}{['cancelled','invalidated'].includes(attempt.attempt_status) && <button onClick={() => void manageAttempt(attempt.attempt_id!, 'reopen')}><RotateCcw /> Reabrir</button>}</>}</div>{attempt.attempt_id && events[attempt.attempt_id] && <ol className="phase4-events">{events[attempt.attempt_id].map((event) => <li key={event.event_id}><strong>{eventLabel(event.event_type)}</strong><span>{formatDate(event.created_at)}{event.actor_name ? ` · ${event.actor_name}` : ''}</span>{event.reason && <small>{event.reason}</small>}</li>)}</ol>}</td></tr>;
    })}</tbody></table>{!attempts.length && <div className="institutional-table-empty"><UserCheck /><p>Nenhum aluno matriculado foi programado nesta avaliação.</p></div>}</div>
    {total > PAGE_SIZE && <nav className="phase4-pagination" aria-label="Paginação do acompanhamento"><button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft /> Anterior</button><span>Página {page + 1} de {pageCount} · {total} alunos</span><button disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Próxima <ChevronRight /></button></nav>}

    <section className="phase4-review"><header><div><span>CORREÇÃO HUMANA</span><h3>Respostas discursivas</h3></div><strong>{essays.filter((essay) => essay.review_status === 'pending').length} pendentes</strong></header>{essays.length ? <div className="phase4-essay-list">{essays.map((essay) => <article key={essay.response_id}><div><small>{essay.student_name} · {essay.classroom_name} · Questão {essay.question_position}</small><h4>{essay.statement}</h4><p>{essay.response_text || 'Sem resposta.'}</p></div><label>Nota<input type="number" min="0" max={essay.max_points} step="0.1" value={grades[essay.response_id] ?? essay.points_awarded ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [essay.response_id]: event.target.value }))} /><span>de {essay.max_points}</span></label><label>Comentário<textarea value={comments[essay.response_id] ?? essay.reviewer_comment ?? ''} onChange={(event) => setComments((current) => ({ ...current, [essay.response_id]: event.target.value }))} /></label><button disabled={busy === essay.response_id || essay.review_status === 'reviewed'} onClick={() => void reviewEssay(essay)}>{essay.review_status === 'reviewed' ? <Check /> : <ClipboardCopy />} {essay.review_status === 'reviewed' ? 'Corrigida' : 'Salvar correção'}</button></article>)}</div> : <div className="phase4-monitor-empty"><Check /> Nenhuma resposta discursiva pendente.</div>}</section>
  </section>;
}

function statusLabel(row: MonitorRow) {
  if (row.attempt_status === 'in_progress' && row.last_activity_at && Date.now() - new Date(row.last_activity_at).getTime() > 3 * 60_000) return 'Sem atividade recente';
  if (row.submission_kind === 'auto_submitted') return row.attempt_status === 'pending_review' ? 'Autoenvio · correção pendente' : 'Enviado automaticamente';
  return ({ scheduled: 'Não iniciado', available: 'Disponível', in_progress: 'Em andamento', paused: 'Pausado', submitted: 'Enviado', auto_submitted: 'Auto enviado', pending_review: 'Pendente de revisão', graded: 'Corrigido', cancelled: 'Cancelado', invalidated: 'Invalidado' } as Record<string, string>)[row.attempt_status] ?? row.attempt_status;
}
function statusTone(status?: string) { return ['graded','submitted','auto_submitted'].includes(status ?? '') ? 'completed' : status === 'in_progress' ? 'enrolled' : ['cancelled','invalidated'].includes(status ?? '') ? 'removed' : 'suspended'; }
function eventLabel(event: string) { return ({ attempt_created: 'Tentativa criada', token_rotated: 'Token emitido', token_revoked: 'Token revogado', started: 'Iniciada', resumed: 'Retomada', answer_saved: 'Resposta salva', submitted: 'Enviada', auto_submitted: 'Envio automático', pending_review: 'Aguardando correção', graded: 'Corrigida', cancelled: 'Cancelada', invalidated: 'Invalidada', reopened: 'Reaberta' } as Record<string, string>)[event] ?? event; }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function formatSeconds(value: number) { const safe = Math.max(0, value); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }
