import type { Tables } from '@/lib/database.types';

export type SupportTicket = Tables<'support_tickets'>;
export type SupportMessage = Tables<'support_messages'>;
export type SupportHistory = Tables<'support_ticket_history'>;
export type PrivacyRequest = Tables<'privacy_requests'>;

export const supportStatusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_requester: 'Aguardando solicitante',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export const supportPriorityLabels: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const privacyTypeLabels: Record<string, string> = {
  export: 'Exportação dos dados',
  correction: 'Correção dos dados',
  deletion: 'Exclusão dos dados',
};

export const privacyStatusLabels: Record<string, string> = {
  requested: 'Solicitada',
  validating: 'Em validação',
  authorized: 'Autorizada',
  rejected: 'Rejeitada',
  executing: 'Em execução',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function canOperateSupport(role: string) {
  return role === 'network_admin' || role === 'manager';
}

export function filterSupportTickets(
  tickets: SupportTicket[],
  filters: { search: string; status: string; priority: string },
) {
  const search = filters.search.trim().toLocaleLowerCase('pt-BR');
  return tickets.filter(
    (ticket) =>
      (!filters.status || ticket.status === filters.status) &&
      (!filters.priority || ticket.priority === filters.priority) &&
      (!search ||
        ticket.subject.toLocaleLowerCase('pt-BR').includes(search) ||
        ticket.description.toLocaleLowerCase('pt-BR').includes(search) ||
        ticket.correlation_id.toLocaleLowerCase('pt-BR').includes(search)),
  );
}

export function shortProtocol(correlationId: string) {
  return correlationId.split('-')[0].toUpperCase();
}
