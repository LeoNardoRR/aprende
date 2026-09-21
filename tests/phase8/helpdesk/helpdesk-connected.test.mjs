import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { root } from '../../../scripts/poc-matrix.mjs';

test('Help Desk isola escolas, notas internas e identidade do chamado', async (t) => {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Exige Supabase local descartável.');
    return;
  }
  const fixture = JSON.parse(await readFile(`${root}/artifacts/poc/seed-manifest.json`, 'utf8'));
  assert.equal(fixture.synthetic, true);
  async function login(email) {
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({
      email, password: process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026',
    });
    assert.ifError(signed.error);
    return client;
  }
  const [teacher, manager, outsider] = await Promise.all([
    login(fixture.users.teacher1), login(fixture.users.manager1), login(fixture.users.manager2),
  ]);
  const created = await teacher.from('support_tickets').insert({
    network_id: fixture.network_id,
    school_id: fixture.school_ids[0],
    requester_id: fixture.user_ids.teacher1,
    subject: 'Acesso ao relatório demonstrativo',
    description: 'O relatório da turma não está disponível neste cenário sintético.',
    ticket_type: 'access',
  }).select().single();
  assert.ifError(created.error);
  const ticket = created.data;
  const moved = await manager.from('support_tickets').update({ school_id: fixture.school_ids[1] }).eq('id', ticket.id);
  assert.ok(moved.error);
  const note = await manager.from('support_messages').insert({
    ticket_id: ticket.id,
    author_id: fixture.user_ids.manager1,
    visibility: 'internal',
    body: 'Conferir o vínculo antes de responder.',
  });
  assert.ifError(note.error);
  const teacherNotes = await teacher.from('support_messages').select('id').eq('ticket_id', ticket.id).eq('visibility', 'internal');
  assert.ifError(teacherNotes.error);
  assert.equal(teacherNotes.data.length, 0);
  const outsiderTickets = await outsider.from('support_tickets').select('id').eq('id', ticket.id);
  assert.ifError(outsiderTickets.error);
  assert.equal(outsiderTickets.data.length, 0);
});
