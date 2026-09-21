import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  canOperateSupport,
  filterSupportTickets,
  shortProtocol,
} from '../../../lib/phase8-operations.ts';

const root = new URL('../../../', import.meta.url);

test('help desk filters tickets without leaking role decisions into the UI', () => {
  const tickets = [
    {
      subject: 'Erro no boletim',
      description: 'Gestor sem acesso',
      correlation_id: 'abc12345-0000',
      status: 'open',
      priority: 'urgent',
    },
    {
      subject: 'Dúvida de cadastro',
      description: 'Como cadastrar turma?',
      correlation_id: 'def67890-0000',
      status: 'resolved',
      priority: 'normal',
    },
  ];
  assert.equal(
    filterSupportTickets(tickets, {
      search: 'boletim',
      status: 'open',
      priority: 'urgent',
    }).length,
    1,
  );
  assert.equal(canOperateSupport('manager'), true);
  assert.equal(canOperateSupport('reviewer'), false);
  assert.equal(shortProtocol('abc12345-0000'), 'ABC12345');
});

test('institutional help desk exposes the complete operational workflow', async () => {
  const source = await readFile(
    new URL('components/institutional-operations.tsx', root),
    'utf8',
  );
  for (const contract of [
    "from('support_tickets')",
    "from('support_messages')",
    "from('support_ticket_history')",
    "visibility === 'internal'",
    'filterSupportTickets',
    'updateTicket',
    'createTicket',
  ])
    assert.match(source, new RegExp(contract.replace(/[()]/g, '\\$&')));
});
