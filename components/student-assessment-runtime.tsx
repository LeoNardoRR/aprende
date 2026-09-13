'use client';

import katex from 'katex';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, CloudOff,
  Flag, LoaderCircle, LockKeyhole, RefreshCw, Send, ShieldCheck,
} from 'lucide-react';
import { studentSupabase } from '@/lib/supabase';
import {
  acknowledgeAssessmentSave, answeredQuestionCount, createServerClock,
  enqueueAssessmentSave, formatAssessmentTime, normalizeAssessmentAnswer,
  overlayPendingResponses, remainingServerSeconds,
  saveStateLabel, type AssessmentAnswer, type AssessmentItemType,
  type PendingAssessmentSave, type RuntimeResponses, type SaveState,
  type ServerClock,
} from '@/lib/assessment-runtime';
import {
  loadPendingAssessmentSaves, migrateLegacyAssessmentQueue,
  removePendingAssessmentSave, replacePendingAssessmentSave,
} from '@/lib/assessment-offline-queue';

type RpcError = { message: string };
type RpcResponse<T> = { data: T | null; error: RpcError | null };
const runtimeApi = studentSupabase as unknown as {
  rpc<T>(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse<T>>;
};

type AvailableAssessment = {
  attempt_id: string;
  schedule_id: string;
  assessment_id: string;
  assessment_title: string;
  subject_name: string;
  classroom_name: string;
  booklet_code: string;
  attempt_status: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  question_count: number;
  token_required: boolean;
};

type RuntimeOption = { id: string; label: string; content: string };
type RuntimeItem = {
  id: string;
  position: number;
  max_points: number;
  content: {
    id: string;
    statement: string;
    support_text?: string | null;
    item_type: AssessmentItemType;
    formula?: string | null;
    image_paths?: string[];
    options: RuntimeOption[];
  };
};
type AttemptPayload = {
  attempt: {
    id: string;
    assessment_title: string;
    instructions: string;
    booklet_code: string;
    status: string;
    submission_kind: string | null;
    current_position: number;
    allow_back_navigation: boolean;
    started_at: string;
    deadline_at: string;
    server_now: string;
    score: number | null;
    max_score: number;
  };
  items: RuntimeItem[];
  responses: RuntimeResponses;
};

const finalStatuses = new Set(['pending_review', 'graded', 'submitted', 'auto_submitted', 'cancelled', 'invalidated']);
const pendingSubmitMessage = 'Estamos sincronizando suas respostas antes de finalizar. Verifique sua conexão e tente novamente.';

export function StudentAssessmentRuntime() {
  const [available, setAvailable] = useState<AvailableAssessment[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [runtime, setRuntime] = useState<AttemptPayload | null>(null);
  const [responses, setResponses] = useState<RuntimeResponses>({});
  const [queue, setQueue] = useState<PendingAssessmentSave[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(1);
  const [clock, setClock] = useState<ServerClock | null>(null);
  const [seconds, setSeconds] = useState(0);
  const queueRef = useRef<PendingAssessmentSave[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitRef = useRef(false);
  const persistenceRef = useRef<Promise<unknown>>(Promise.resolve());
  const retryDelayRef = useRef(2_000);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const setQueueSnapshot = useCallback((next: PendingAssessmentSave[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const loadAvailable = useCallback(async () => {
    const result = await runtimeApi.rpc<AvailableAssessment[]>('list_available_assessments');
    if (result.error) setNotice(`Não foi possível carregar avaliações: ${result.error.message}`);
    else setAvailable(result.data ?? []);
  }, []);

  useEffect(() => { void loadAvailable(); }, [loadAvailable]);

  const applyRuntime = useCallback(async (payload: AttemptPayload) => {
    await migrateLegacyAssessmentQueue(payload.attempt.id);
    const localQueue = await loadPendingAssessmentSaves(payload.attempt.id);
    setQueueSnapshot(localQueue);
    setRuntime(payload);
    setResponses(overlayPendingResponses(payload.responses ?? {}, localQueue, payload.attempt.id));
    setPosition(Math.min(Math.max(payload.attempt.current_position || 1, 1), payload.items.length || 1));
    if (payload.attempt.deadline_at && payload.attempt.server_now) {
      const nextClock = createServerClock(payload.attempt.deadline_at, payload.attempt.server_now);
      setClock(nextClock);
      setSeconds(remainingServerSeconds(nextClock));
    }
  }, [setQueueSnapshot]);

  const loadAttempt = useCallback(async (attemptId: string, resume = false) => {
    setLoading(true); setNotice('');
    const result = await runtimeApi.rpc<AttemptPayload>(
      resume ? 'resume_assessment_attempt' : 'get_assessment_attempt',
      { target_attempt: attemptId },
    );
    if (result.error || !result.data) {
      setLoading(false);
      setNotice(result.error?.message ?? 'Tentativa indisponível.');
      return;
    }
    await applyRuntime(result.data);
    setLoading(false);
  }, [applyRuntime]);

  async function accessAssessment(assessment: AvailableAssessment) {
    if (assessment.attempt_status === 'in_progress' || assessment.attempt_status === 'paused') {
      await loadAttempt(assessment.attempt_id, true);
      return;
    }
    if (finalStatuses.has(assessment.attempt_status)) {
      await loadAttempt(assessment.attempt_id);
      return;
    }
    const token = tokens[assessment.attempt_id]?.trim() ?? '';
    if (!token) { setNotice('Digite o token entregue pela escola.'); return; }
    setLoading(true); setNotice('');
    const result = await runtimeApi.rpc<{ ok: boolean; attempt_id?: string; error?: string }>('start_assessment_attempt', {
      target_schedule: assessment.schedule_id, access_token: token, origin: 'token',
    });
    setLoading(false);
    if (result.error || !result.data?.ok || !result.data.attempt_id) {
      setNotice(result.data?.error ?? result.error?.message ?? 'Token inválido ou indisponível.');
      return;
    }
    setTokens((current) => ({ ...current, [assessment.attempt_id]: '' }));
    await loadAttempt(result.data.attempt_id);
  }

  const flushQueue = useCallback(async () => {
    await persistenceRef.current;
    if (!runtime || !queueRef.current.length) return true;
    if (!navigator.onLine) { setSaveState('offline'); return false; }
    setSaveState('saving');
    const entries = queueRef.current;
    for (const entry of entries) {
      const result = await runtimeApi.rpc<{ revision: number; saved_at: string }>('save_assessment_response', {
        target_attempt: entry.attemptId,
        target_attempt_item: entry.attemptItemId,
        response_payload: entry.answer,
        mark_for_review: entry.markedForReview,
        idempotency_key: entry.idempotencyKey,
        expected_revision: entry.expectedRevision,
      });
      if (result.error) {
        setSaveState(navigator.onLine ? 'sync_error' : 'offline');
        return false;
      }
      await removePendingAssessmentSave(entry.attemptId, entry.idempotencyKey);
      setQueueSnapshot(acknowledgeAssessmentSave(queueRef.current, entry.idempotencyKey));
      setResponses((current) => ({
        ...current,
        [entry.attemptItemId]: {
          ...current[entry.attemptItemId],
          answer: entry.answer,
          marked_for_review: entry.markedForReview,
          revision: result.data?.revision ?? current[entry.attemptItemId]?.revision,
          saved_at: result.data?.saved_at ?? current[entry.attemptItemId]?.saved_at,
        },
      }));
    }
    retryDelayRef.current = 2_000;
    setSaveState('saved');
    return true;
  }, [runtime, setQueueSnapshot]);

  useEffect(() => {
    const reconnect = () => { if (queueRef.current.length) void flushQueue(); };
    const disconnect = () => setSaveState('offline');
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', disconnect);
    return () => {
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', disconnect);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (saveState !== 'sync_error' || !queue.length || !navigator.onLine) return;
    const delay = retryDelayRef.current;
    const retry = window.setTimeout(() => {
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
      void flushQueue();
    }, delay);
    return () => window.clearTimeout(retry);
  }, [flushQueue, queue.length, saveState]);

  useEffect(() => {
    if (!queue.length) return;
    const warnOnExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnOnExit);
    return () => window.removeEventListener('beforeunload', warnOnExit);
  }, [queue.length]);

  useEffect(() => {
    if (!clock || !runtime || finalStatuses.has(runtime.attempt.status)) return;
    const timer = window.setInterval(() => setSeconds(remainingServerSeconds(clock)), 1000);
    return () => window.clearInterval(timer);
  }, [clock, runtime]);

  useEffect(() => { questionHeadingRef.current?.focus(); }, [position]);

  const finish = useCallback(async (automatic = false) => {
    if (!runtime || autoSubmitRef.current) return;
    let timeoutNotice = '';
    const unanswered = runtime.items.length - answeredQuestionCount(runtime.items.map((item) => item.id), responses);
    if (!automatic && !window.confirm(unanswered ? `Há ${unanswered} questão(ões) sem resposta. Deseja finalizar mesmo assim?` : 'Finalizar e enviar a avaliação?')) return;
    autoSubmitRef.current = true;
    const synchronized = await flushQueue();
    const pendingCount = queueRef.current.length;
    if (!automatic && (!synchronized || pendingCount > 0)) {
      autoSubmitRef.current = false;
      setNotice(pendingSubmitMessage);
      return;
    }
    if (automatic && pendingCount > 0) {
      timeoutNotice = `O prazo do servidor terminou. ${pendingCount} resposta(s) local(is) não foram confirmadas e permanecem neste dispositivo. O backend encerrará a tentativa sem ampliar o tempo.`;
      setNotice(timeoutNotice);
    }
    const result = await runtimeApi.rpc('submit_assessment_attempt', { target_attempt: runtime.attempt.id });
    autoSubmitRef.current = false;
    if (result.error) {
      if (automatic && !navigator.onLine) return;
      setNotice(result.error.message);
      return;
    }
    await loadAttempt(runtime.attempt.id);
    await loadAvailable();
    if (timeoutNotice) {
      setNotice(`${timeoutNotice} A tentativa foi encerrada pelo prazo do servidor.`);
    }
  }, [flushQueue, loadAttempt, loadAvailable, responses, runtime]);

  useEffect(() => {
    if (runtime && seconds === 0 && clock && !finalStatuses.has(runtime.attempt.status)) void finish(true);
  }, [clock, finish, runtime, seconds]);

  useEffect(() => {
    const closeExpiredOnReconnect = () => {
      if (runtime && clock && remainingServerSeconds(clock) === 0 && !finalStatuses.has(runtime.attempt.status)) void finish(true);
    };
    window.addEventListener('online', closeExpiredOnReconnect);
    return () => window.removeEventListener('online', closeExpiredOnReconnect);
  }, [clock, finish, runtime]);

  function queueAnswer(item: RuntimeItem, answer: AssessmentAnswer, markedForReview: boolean) {
    if (!runtime || finalStatuses.has(runtime.attempt.status)) return;
    const entry: PendingAssessmentSave = {
      idempotencyKey: crypto.randomUUID(), attemptId: runtime.attempt.id,
      attemptItemId: item.id, answer, markedForReview, queuedAt: new Date().toISOString(),
      expectedRevision: responses[item.id]?.revision ?? 0,
    };
    const next = enqueueAssessmentSave(queueRef.current, entry);
    setQueueSnapshot(next);
    persistenceRef.current = persistenceRef.current.then(async () => {
      const target = await replacePendingAssessmentSave(entry);
      if (target === 'memory') setSaveState('sync_error');
    });
    setResponses((current) => ({ ...current, [item.id]: { ...current[item.id], answer, marked_for_review: markedForReview } }));
    setSaveState(navigator.onLine ? 'pending' : 'offline');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flushQueue(), 650);
  }

  async function navigate(nextPosition: number) {
    if (!runtime || nextPosition < 1 || nextPosition > runtime.items.length) return;
    const result = await runtimeApi.rpc<number>('set_assessment_attempt_position', { target_attempt: runtime.attempt.id, target_position: nextPosition });
    if (result.error) { setNotice(result.error.message); return; }
    setPosition(nextPosition);
  }

  if (!runtime) return <section className="assessment-entry" aria-labelledby="assessment-entry-title">
    <header><span><ShieldCheck /> AVALIAÇÕES DIAGNÓSTICAS</span><h2 id="assessment-entry-title">Minhas aplicações</h2><p>Use o token entregue pela escola. Cada token funciona somente para sua matrícula e agendamento.</p></header>
    {notice && <output className="assessment-runtime-notice">{notice}</output>}
    <div className="assessment-entry-list">{available.map((assessment) => <article key={assessment.attempt_id}>
      <div><small>{assessment.subject_name} · {assessment.classroom_name}</small><h3>{assessment.assessment_title}</h3><p>{assessment.question_count} questões · {assessment.duration_minutes} min · Caderno {assessment.booklet_code}</p><span>{formatWindow(assessment.starts_at, assessment.ends_at)}</span></div>
      {!finalStatuses.has(assessment.attempt_status) && !['in_progress','paused'].includes(assessment.attempt_status) && <label><LockKeyhole /><input value={tokens[assessment.attempt_id] ?? ''} onChange={(event) => setTokens((current) => ({ ...current, [assessment.attempt_id]: event.target.value.toUpperCase() }))} placeholder="TOKEN DE ACESSO" autoComplete="one-time-code" aria-label={`Token para ${assessment.assessment_title}`} /></label>}
      <button disabled={loading} onClick={() => void accessAssessment(assessment)}>{loading ? <LoaderCircle className="spin" /> : assessment.attempt_status === 'in_progress' || assessment.attempt_status === 'paused' ? <RefreshCw /> : finalStatuses.has(assessment.attempt_status) ? <ClipboardCheck /> : <ArrowRight />} {assessment.attempt_status === 'in_progress' || assessment.attempt_status === 'paused' ? 'Retomar' : finalStatuses.has(assessment.attempt_status) ? 'Ver envio' : 'Acessar'}</button>
    </article>)}</div>
    {!available.length && <div className="assessment-runtime-empty"><ClipboardCheck /><strong>Nenhuma avaliação liberada</strong><p>A avaliação aparece aqui depois que a escola emite seu acesso.</p></div>}
    <button className="assessment-refresh" onClick={() => void loadAvailable()}><RefreshCw /> Atualizar avaliações</button>
  </section>;

  if (finalStatuses.has(runtime.attempt.status)) return <section className="assessment-finished">
    <CheckCircle2 /><span>AVALIAÇÃO ENVIADA</span><h2>{runtime.attempt.assessment_title}</h2><p>{runtime.attempt.status === 'pending_review' ? 'Suas respostas objetivas foram corrigidas. A questão discursiva aguarda revisão do professor.' : runtime.attempt.status === 'graded' ? 'A correção foi concluída.' : 'A tentativa está encerrada.'}</p>
    {notice && <output className="assessment-runtime-notice" aria-live="polite">{notice}</output>}
    {runtime.attempt.status === 'graded' && <strong>{Number(runtime.attempt.score ?? 0).toLocaleString('pt-BR')} de {Number(runtime.attempt.max_score).toLocaleString('pt-BR')} pontos</strong>}
    <button onClick={() => { setRuntime(null); void loadAvailable(); }}><ArrowLeft /> Voltar às avaliações</button>
  </section>;

  const item = runtime.items.find((candidate) => candidate.position === position) ?? runtime.items[0];
  const response = responses[item.id] ?? { answer: {}, marked_for_review: false };
  const answered = answeredQuestionCount(runtime.items.map((candidate) => candidate.id), responses);
  const formula = item.content.formula ? katex.renderToString(item.content.formula, { throwOnError: false, output: 'html' }) : '';

  return <section className="assessment-runtime" aria-labelledby="assessment-runtime-title">
    <header><div><span>AVALIAÇÃO EM ANDAMENTO · CADERNO {runtime.attempt.booklet_code}</span><h2 id="assessment-runtime-title">{runtime.attempt.assessment_title}</h2></div><div className={seconds < 300 ? 'urgent' : ''} role="timer" aria-label={`${formatAssessmentTime(seconds)} restantes, tempo controlado pelo servidor`}><Clock3 /><strong aria-hidden="true">{formatAssessmentTime(seconds)}</strong><small>tempo do servidor</small></div></header>
    {notice && <output className="assessment-runtime-notice">{notice}</output>}
    <div className="assessment-progress"><span style={{ width: `${(answered / Math.max(runtime.items.length, 1)) * 100}%` }} /><small>{answered} de {runtime.items.length} respondidas</small></div>
    <div className="assessment-question-layout">
      <nav aria-label="Mapa de questões">{runtime.items.map((candidate) => { const answeredQuestion = Boolean(responses[candidate.id]?.answer?.option_id || responses[candidate.id]?.answer?.text?.trim()); const marked = Boolean(responses[candidate.id]?.marked_for_review); return <button key={candidate.id} className={`${candidate.position === position ? 'current' : ''} ${answeredQuestion ? 'answered' : ''} ${marked ? 'marked' : ''}`} disabled={!runtime.attempt.allow_back_navigation && candidate.position < position} onClick={() => void navigate(candidate.position)} aria-current={candidate.position === position ? 'step' : undefined} aria-label={`Questão ${candidate.position}, ${answeredQuestion ? 'respondida' : 'não respondida'}${marked ? ', marcada para revisão' : ''}`}>{candidate.position}</button>; })}</nav>
      <article className="assessment-question"><div className="assessment-question-head"><span>Questão {item.position} de {runtime.items.length}</span><strong>{Number(item.max_points)} pontos</strong></div>{item.content.support_text && <p className="assessment-support">{item.content.support_text}</p>}<h3 ref={questionHeadingRef} tabIndex={-1}>{item.content.statement}</h3>{formula && <div className="assessment-formula" dangerouslySetInnerHTML={{ __html: formula }} />}{item.content.image_paths?.map((path) => <AssessmentImage key={path} path={path} />)}
        {item.content.item_type === 'essay' ? <label className="assessment-essay"><span>Sua resposta</span><textarea value={response.answer.text ?? ''} onChange={(event) => queueAnswer(item, normalizeAssessmentAnswer('essay', event.target.value), response.marked_for_review)} maxLength={20_000} placeholder="Digite sua resposta..." /></label> : <fieldset className="assessment-options"><legend>Selecione uma alternativa</legend>{item.content.options.map((option) => <label key={option.id} className={response.answer.option_id === option.id ? 'selected' : ''}><input type="radio" name={`answer-${item.id}`} checked={response.answer.option_id === option.id} onChange={() => queueAnswer(item, normalizeAssessmentAnswer(item.content.item_type, option.id), response.marked_for_review)} /><b>{option.label}</b><span>{option.content}</span></label>)}</fieldset>}
        <label className="assessment-mark"><input type="checkbox" checked={response.marked_for_review} onChange={(event) => queueAnswer(item, response.answer, event.target.checked)} /><Flag /> Marcar para revisar</label>
      </article>
    </div>
    <footer><div className={`assessment-save-state ${saveState}`} aria-live="polite">{saveState === 'offline' ? <CloudOff /> : saveState === 'sync_error' ? <CircleAlert /> : saveState === 'saving' ? <LoaderCircle className="spin" /> : <CheckCircle2 />}<span>{saveStateLabel(saveState, queue.length)}{queue.length > 0 ? ` · ${queue.length} resposta(s) aguardando sincronização` : ''}</span>{queue.length > 0 && <button type="button" onClick={() => void flushQueue()}>Tentar sincronizar novamente</button>}</div><div><button disabled={position === 1 || !runtime.attempt.allow_back_navigation} onClick={() => void navigate(position - 1)}><ArrowLeft /> Anterior</button>{position < runtime.items.length ? <button onClick={() => void navigate(position + 1)}>Próxima <ArrowRight /></button> : <button className="assessment-submit" onClick={() => void finish(false)}><Send /> {queue.length > 0 ? 'Sincronizar e finalizar' : 'Finalizar prova'}</button>}</div></footer>
  </section>;
}

function AssessmentImage({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    void studentSupabase.storage.from('assessment-item-images').createSignedUrl(path, 900).then((result) => {
      if (active && !result.error) setUrl(result.data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  return url ? <img className="assessment-item-image" src={url} alt="Imagem da questão" /> : null;
}

function formatWindow(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(start))} a ${formatter.format(new Date(end))}`;
}
