'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Headphones,
  History,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import type { InstitutionalProfile } from '@/components/institutional-admin';
import {
  canOperateSupport,
  filterSupportTickets,
  privacyStatusLabels,
  privacyTypeLabels,
  shortProtocol,
  supportPriorityLabels,
  supportStatusLabels,
} from '@/lib/phase8-operations';

type Network = Tables<'networks'>;
type School = Tables<'schools'>;
type Department = Tables<'support_departments'>;
type Ticket = Tables<'support_tickets'>;
type Message = Tables<'support_messages'>;
type TicketHistory = Tables<'support_ticket_history'>;
type PrivacyRequest = Tables<'privacy_requests'>;

const previewTicket: Ticket = {
  id: 'ticket-preview',
  network_id: 'network-preview',
  school_id: 'school-1',
  requester_id: 'preview-admin',
  subject: 'Acesso ao boletim da turma',
  description: 'O boletim não aparece para a equipe gestora da escola.',
  priority: 'high',
  status: 'in_progress',
  ticket_type: 'access',
  department_id: null,
  assignee_id: 'preview-admin',
  correlation_id: 'a82da690-5949-43d8-a006-2f70dd70c32f',
  created_at: '2026-09-20T13:00:00Z',
  updated_at: '2026-09-20T14:00:00Z',
  closed_at: null,
};

export function InstitutionalOperations({
  profile,
  networks,
  schools,
  preview = false,
}: {
  profile: InstitutionalProfile;
  networks: Network[];
  schools: School[];
  preview?: boolean;
}) {
  const canManage = canOperateSupport(profile.role);
  const [tickets, setTickets] = useState<Ticket[]>(
    preview ? [previewTicket] : [],
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    preview ? previewTicket.id : null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadQueues = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    const requests = [
      supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('support_departments')
        .select('*')
        .eq('active', true)
        .order('name'),
    ] as const;
    const [ticketsResult, departmentsResult] = await Promise.all(requests);
    setTickets(ticketsResult.data ?? []);
    setDepartments(departmentsResult.data ?? []);
    if (canManage) {
      const privacyResult = await supabase
        .from('privacy_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setPrivacyRequests(privacyResult.data ?? []);
      if (privacyResult.error)
        setNotice(`Fila LGPD: ${privacyResult.error.message}`);
    }
    const error = ticketsResult.error ?? departmentsResult.error;
    if (error)
      setNotice(`Não foi possível carregar o atendimento: ${error.message}`);
    setLoading(false);
  }, [canManage, preview]);

  const loadTicketDetails = useCallback(
    async (ticketId: string) => {
      if (preview) {
        setMessages([
          {
            id: 'message-preview',
            ticket_id: ticketId,
            author_id: 'preview-admin',
            visibility: 'public',
            body: 'Estamos verificando as permissões da escola.',
            created_at: '2026-09-20T14:00:00Z',
          },
          {
            id: 'note-preview',
            ticket_id: ticketId,
            author_id: 'preview-admin',
            visibility: 'internal',
            body: 'Validar vínculo institucional antes de responder.',
            created_at: '2026-09-20T14:05:00Z',
          },
        ]);
        setHistory([
          {
            id: 1,
            ticket_id: ticketId,
            actor_id: 'preview-admin',
            field_name: 'status',
            old_value: 'open',
            new_value: 'in_progress',
            created_at: '2026-09-20T14:00:00Z',
          },
        ]);
        return;
      }
      const [messagesResult, historyResult] = await Promise.all([
        supabase
          .from('support_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at'),
        supabase
          .from('support_ticket_history')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false }),
      ]);
      setMessages(messagesResult.data ?? []);
      setHistory(historyResult.data ?? []);
      const error = messagesResult.error ?? historyResult.error;
      if (error)
        setNotice(`Não foi possível carregar o histórico: ${error.message}`);
    },
    [preview],
  );

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);
  useEffect(() => {
    if (selectedTicketId) void loadTicketDetails(selectedTicketId);
    else {
      setMessages([]);
      setHistory([]);
    }
  }, [loadTicketDetails, selectedTicketId]);

  const filteredTickets = useMemo(
    () =>
      filterSupportTickets(tickets, {
        search,
        status: statusFilter,
        priority: priorityFilter,
      }),
    [priorityFilter, search, statusFilter, tickets],
  );
  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const values = new FormData(event.currentTarget);
    const payload = {
      network_id: String(values.get('network_id')),
      school_id: String(values.get('school_id') ?? '') || null,
      requester_id: profile.id,
      subject: String(values.get('subject') ?? '').trim(),
      description: String(values.get('description') ?? '').trim(),
      priority: String(values.get('priority') ?? 'normal'),
      ticket_type: String(values.get('ticket_type') ?? 'question'),
      department_id: String(values.get('department_id') ?? '') || null,
    };
    if (preview) {
      const ticket: Ticket = {
        ...payload,
        id: crypto.randomUUID(),
        status: 'open',
        assignee_id: null,
        correlation_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      };
      setTickets((current) => [ticket, ...current]);
      setSelectedTicketId(ticket.id);
      setCreateOpen(false);
      setNotice('Chamado criado na prévia.');
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(payload)
      .select()
      .single();
    if (error) setNotice(`Não foi possível criar o chamado: ${error.message}`);
    else {
      setCreateOpen(false);
      setSelectedTicketId(data.id);
      setNotice('Chamado criado com protocolo rastreável.');
      await loadQueues();
    }
    setBusy(false);
  }

  async function updateTicket(
    field: 'status' | 'priority' | 'department_id',
    value: string | null,
  ) {
    if (!selectedTicket || !canManage) return;
    setBusy(true);
    if (preview) {
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicket.id
            ? {
                ...ticket,
                [field]: value,
                updated_at: new Date().toISOString(),
              }
            : ticket,
        ),
      );
      setHistory((current) => [
        {
          id: Date.now(),
          ticket_id: selectedTicket.id,
          actor_id: profile.id,
          field_name: field,
          old_value: String(selectedTicket[field] ?? ''),
          new_value: value,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
      setNotice('Chamado atualizado na prévia.');
    } else {
      const changes =
        field === 'status'
          ? { status: value ?? 'open' }
          : field === 'priority'
            ? { priority: value ?? 'normal' }
            : { department_id: value };
      const { error } = await supabase
        .from('support_tickets')
        .update(changes)
        .eq('id', selectedTicket.id);
      if (error) setNotice(`Não foi possível atualizar: ${error.message}`);
      else {
        setNotice('Chamado atualizado e registrado no histórico.');
        await loadQueues();
        await loadTicketDetails(selectedTicket.id);
      }
    }
    setBusy(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const visibility = canManage
      ? String(values.get('visibility') ?? 'public')
      : 'public';
    const body = String(values.get('body') ?? '').trim();
    if (!body) return;
    setBusy(true);
    const payload = {
      ticket_id: selectedTicket.id,
      author_id: profile.id,
      visibility,
      body,
    };
    if (preview) {
      setMessages((current) => [
        ...current,
        {
          ...payload,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        },
      ]);
      form.reset();
      setNotice(
        visibility === 'internal'
          ? 'Nota interna registrada na prévia.'
          : 'Resposta enviada na prévia.',
      );
    } else {
      const { error } = await supabase.from('support_messages').insert(payload);
      if (error) setNotice(`Não foi possível enviar: ${error.message}`);
      else {
        form.reset();
        setNotice(
          visibility === 'internal'
            ? 'Nota interna registrada.'
            : 'Resposta pública enviada.',
        );
        await loadTicketDetails(selectedTicket.id);
      }
    }
    setBusy(false);
  }

  async function updatePrivacyRequest(
    request: PrivacyRequest,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canManage) return;
    const values = new FormData(event.currentTarget);
    const status = String(values.get('status'));
    const resolution = String(values.get('resolution') ?? '').trim() || null;
    setBusy(true);
    if (preview) {
      setPrivacyRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status,
                resolution,
                handled_by: profile.id,
                completed_at:
                  status === 'completed' ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
      setNotice('Solicitação LGPD atualizada na prévia.');
    } else {
      const { error } = await supabase
        .from('privacy_requests')
        .update({
          status,
          resolution,
          handled_by: profile.id,
          completed_at:
            status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', request.id);
      if (error)
        setNotice(`Não foi possível atualizar a solicitação: ${error.message}`);
      else {
        setNotice('Solicitação LGPD atualizada.');
        await loadQueues();
      }
    }
    setBusy(false);
  }

  return (
    <div className="institutional-operations">
      <section id="support" className="institutional-panel operations-panel">
        <div className="institutional-panel-head">
          <div>
            <span>ATENDIMENTO</span>
            <h2>Help Desk</h2>
            <p>Chamados, conversas e trilha auditável por escopo.</p>
          </div>
          <button
            className="operations-primary"
            type="button"
            disabled={!networks.length}
            onClick={() => setCreateOpen((value) => !value)}
          >
            <Plus /> Novo chamado
          </button>
        </div>
        {createOpen && (
          <form className="operations-create" onSubmit={createTicket}>
            <label>
              Rede
              <select name="network_id" required>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escola
              <select name="school_id">
                <option value="">Todas / não se aplica</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select name="ticket_type">
                <option value="question">Dúvida</option>
                <option value="incident">Incidente</option>
                <option value="access">Acesso</option>
                <option value="data">Dados</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label>
              Prioridade
              <select name="priority">
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label>
              Departamento
              <select name="department_id">
                <option value="">Triagem</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Assunto
              <input name="subject" required minLength={4} maxLength={180} />
            </label>
            <label className="wide">
              Descrição
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={8000}
              />
            </label>
            <div className="wide operations-form-actions">
              <button type="button" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={busy}>
                Criar chamado
              </button>
            </div>
          </form>
        )}

        <div className="operations-filters">
          <label>
            <Search />
            <input
              aria-label="Buscar chamados"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Assunto, descrição ou protocolo"
            />
          </label>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(supportStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prioridade"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">Todas as prioridades</option>
            {Object.entries(supportPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="operations-loading">
            <LoaderCircle className="spin" /> Carregando chamados…
          </p>
        ) : (
          <div className="operations-workspace">
            <div className="ticket-list" role="list" aria-label="Chamados">
              {filteredTickets.map((ticket) => (
                <button
                  type="button"
                  role="listitem"
                  key={ticket.id}
                  className={selectedTicketId === ticket.id ? 'selected' : ''}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <span className={`ticket-priority ${ticket.priority}`}>
                    {supportPriorityLabels[ticket.priority] ?? ticket.priority}
                  </span>
                  <strong>{ticket.subject}</strong>
                  <small>
                    #{shortProtocol(ticket.correlation_id)} ·{' '}
                    {formatDate(ticket.updated_at)}
                  </small>
                  <em>{supportStatusLabels[ticket.status] ?? ticket.status}</em>
                </button>
              ))}
              {!filteredTickets.length && (
                <p className="operations-empty">
                  Nenhum chamado corresponde aos filtros.
                </p>
              )}
            </div>
            <div className="ticket-detail">
              {selectedTicket ? (
                <>
                  <header>
                    <div>
                      <small>
                        PROTOCOLO #
                        {shortProtocol(selectedTicket.correlation_id)}
                      </small>
                      <h3>{selectedTicket.subject}</h3>
                      <p>{selectedTicket.description}</p>
                    </div>
                    <span>{supportStatusLabels[selectedTicket.status]}</span>
                  </header>
                  {canManage && (
                    <div className="ticket-controls">
                      <label>
                        Status
                        <select
                          disabled={busy}
                          value={selectedTicket.status}
                          onChange={(event) =>
                            void updateTicket('status', event.target.value)
                          }
                        >
                          {Object.entries(supportStatusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Prioridade
                        <select
                          disabled={busy}
                          value={selectedTicket.priority}
                          onChange={(event) =>
                            void updateTicket('priority', event.target.value)
                          }
                        >
                          {Object.entries(supportPriorityLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Departamento
                        <select
                          disabled={busy}
                          value={selectedTicket.department_id ?? ''}
                          onChange={(event) =>
                            void updateTicket(
                              'department_id',
                              event.target.value || null,
                            )
                          }
                        >
                          <option value="">Triagem</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <div className="ticket-timeline">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className={
                          message.visibility === 'internal' ? 'internal' : ''
                        }
                      >
                        <span>
                          {message.visibility === 'internal' ? (
                            <LockKeyhole />
                          ) : (
                            <MessageSquare />
                          )}
                        </span>
                        <div>
                          <strong>
                            {message.visibility === 'internal'
                              ? 'Nota interna'
                              : message.author_id === profile.id
                                ? 'Você'
                                : 'Resposta'}
                          </strong>
                          <p>{message.body}</p>
                          <small>{formatDate(message.created_at)}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  <form className="ticket-reply" onSubmit={sendMessage}>
                    {canManage && (
                      <label>
                        Visibilidade
                        <select name="visibility">
                          <option value="public">Resposta pública</option>
                          <option value="internal">Nota interna</option>
                        </select>
                      </label>
                    )}
                    <textarea
                      name="body"
                      required
                      maxLength={8000}
                      placeholder="Escreva uma resposta…"
                      aria-label="Mensagem do chamado"
                    />
                    <button type="submit" disabled={busy}>
                      Enviar
                    </button>
                  </form>
                  <details className="ticket-history">
                    <summary>
                      <History /> Histórico de alterações ({history.length})
                    </summary>
                    {history.map((entry) => (
                      <p key={entry.id}>
                        <Clock3 />{' '}
                        <span>
                          <strong>{fieldLabel(entry.field_name)}</strong>:{' '}
                          {entry.old_value || '—'} → {entry.new_value || '—'}
                          <small>{formatDate(entry.created_at)}</small>
                        </span>
                      </p>
                    ))}
                  </details>
                </>
              ) : (
                <div className="operations-empty detail">
                  <Headphones />
                  <strong>Selecione um chamado</strong>
                  <p>Veja a conversa, a prioridade e o histórico completo.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {canManage && (
        <section
          id="privacy-requests"
          className="institutional-panel operations-panel"
        >
          <div className="institutional-panel-head">
            <div>
              <span>PRIVACIDADE</span>
              <h2>Solicitações LGPD</h2>
              <p>Acompanhamento por rede, responsável e protocolo.</p>
            </div>
            <ShieldCheck />
          </div>
          <div className="privacy-admin-list">
            {privacyRequests.map((request) => (
              <form
                key={request.id}
                onSubmit={(event) => void updatePrivacyRequest(request, event)}
              >
                <header>
                  <div>
                    <strong>
                      {privacyTypeLabels[request.request_type] ??
                        request.request_type}
                    </strong>
                    <small>
                      {formatDate(request.created_at)} ·{' '}
                      {shortProtocol(request.correlation_id)}
                    </small>
                  </div>
                  <span data-status={request.status}>
                    {privacyStatusLabels[request.status] ?? request.status}
                  </span>
                </header>
                {request.details && <p>{request.details}</p>}
                <label>
                  Status
                  <select name="status" defaultValue={request.status}>
                    {Object.entries(privacyStatusLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="wide">
                  Resolução
                  <textarea
                    name="resolution"
                    maxLength={4000}
                    defaultValue={request.resolution ?? ''}
                    placeholder="Registre a análise, justificativa ou forma de entrega."
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Salvar andamento
                </button>
              </form>
            ))}
            {!privacyRequests.length && (
              <p className="operations-empty">
                Nenhuma solicitação LGPD visível no seu escopo.
              </p>
            )}
          </div>
        </section>
      )}
      {notice && (
        <output
          className="institutional-notice operations-notice"
          aria-live="polite"
        >
          {notice}
        </output>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function fieldLabel(field: string) {
  return (
    (
      {
        status: 'Status',
        priority: 'Prioridade',
        assignee_id: 'Responsável',
        department_id: 'Departamento',
      } as Record<string, string>
    )[field] ?? field
  );
}
