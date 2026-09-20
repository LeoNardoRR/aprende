-- Aprendê Fase 8: domínios operacionais do produto Desktop.
-- Migration aditiva; não altera dados ou migrations históricas.

insert into private.permissions(key, description) values
  ('privacy.manage', 'Administrar solicitações de privacidade no escopo autorizado'),
  ('support.agent', 'Atender chamados de suporte no escopo autorizado'),
  ('offline_import.manage', 'Importar respostas de avaliações no escopo autorizado')
on conflict (key) do nothing;

insert into private.role_permissions(role, permission_key) values
  ('network_admin', 'privacy.manage'), ('manager', 'privacy.manage'),
  ('network_admin', 'support.agent'), ('manager', 'support.agent'),
  ('network_admin', 'offline_import.manage'), ('manager', 'offline_import.manage')
on conflict do nothing;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy')),
  version text not null check (char_length(version) between 1 and 40),
  title text not null check (char_length(title) between 2 and 180),
  content text not null check (char_length(content) between 20 and 200000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  effective_at timestamptz not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id) on delete restrict,
  unique(document_type, version),
  unique(document_type, content_hash)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  context text not null default 'web_desktop' check (char_length(context) between 2 and 80),
  result text not null check (result in ('accepted', 'declined')),
  accepted_at timestamptz not null default now(),
  unique(document_id, user_id)
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  network_id uuid references public.networks(id) on delete restrict,
  request_type text not null check (request_type in ('export', 'correction', 'deletion')),
  status text not null default 'requested' check (status in ('requested', 'validating', 'authorized', 'rejected', 'executing', 'completed', 'cancelled')),
  details text check (details is null or char_length(details) <= 4000),
  resolution text check (resolution is null or char_length(resolution) <= 4000),
  handled_by uuid references public.profiles(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.support_departments (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(network_id, name)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  school_id uuid references public.schools(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (char_length(subject) between 4 and 180),
  description text not null check (char_length(description) between 10 and 8000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_requester', 'resolved', 'closed')),
  ticket_type text not null default 'question' check (ticket_type in ('question', 'incident', 'access', 'data', 'other')),
  department_id uuid references public.support_departments(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  visibility text not null check (visibility in ('public', 'internal')),
  body text not null check (char_length(body) between 1 and 8000),
  created_at timestamptz not null default now()
);

create table public.support_ticket_history (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  field_name text not null check (field_name in ('status', 'priority', 'assignee_id', 'department_id')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.offline_response_imports (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  assessment_id uuid not null references public.diagnostic_assessments(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'preview' check (status in ('preview', 'validated', 'committed', 'failed')),
  row_count integer not null default 0 check (row_count >= 0),
  valid_count integer not null default 0 check (valid_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  validation_errors jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique(network_id, assessment_id, content_hash)
);

create table public.offline_response_import_rows (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.offline_response_imports(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  student_id uuid references public.profiles(id) on delete restrict,
  assessment_item_id uuid references public.assessment_items(id) on delete restrict,
  answer jsonb,
  row_status text not null check (row_status in ('valid', 'duplicate', 'conflict', 'invalid')),
  error_code text,
  created_at timestamptz not null default now(),
  unique(import_id, row_number)
);

create index legal_acceptances_user_idx on public.legal_acceptances(user_id, accepted_at desc);
create index privacy_requests_requester_idx on public.privacy_requests(requester_id, created_at desc);
create index privacy_requests_scope_idx on public.privacy_requests(network_id, status, created_at desc);
create index support_departments_network_idx on public.support_departments(network_id, active);
create index support_tickets_requester_idx on public.support_tickets(requester_id, created_at desc);
create index support_tickets_queue_idx on public.support_tickets(network_id, school_id, status, priority, updated_at desc);
create index support_tickets_assignee_idx on public.support_tickets(assignee_id, status, updated_at desc);
create index support_messages_ticket_idx on public.support_messages(ticket_id, created_at);
create index support_history_ticket_idx on public.support_ticket_history(ticket_id, created_at);
create index offline_imports_scope_idx on public.offline_response_imports(network_id, assessment_id, created_at desc);
create index offline_import_rows_import_idx on public.offline_response_import_rows(import_id, row_status, row_number);
create index offline_import_rows_student_idx on public.offline_response_import_rows(student_id) where student_id is not null;
create index offline_import_rows_item_idx on public.offline_response_import_rows(assessment_item_id) where assessment_item_id is not null;

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.support_departments enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_ticket_history enable row level security;
alter table public.offline_response_imports enable row level security;
alter table public.offline_response_import_rows enable row level security;

create policy legal_documents_read on public.legal_documents for select to authenticated using (effective_at <= now());
create policy legal_documents_manage on public.legal_documents for all to authenticated
using (private.has_permission('privacy.manage')) with check (private.has_permission('privacy.manage'));
create policy legal_acceptances_own_read on public.legal_acceptances for select to authenticated using (user_id = (select auth.uid()));
create policy legal_acceptances_own_create on public.legal_acceptances for insert to authenticated with check (user_id = (select auth.uid()));
create policy privacy_requests_read on public.privacy_requests for select to authenticated
using (requester_id = (select auth.uid()) or private.has_permission('privacy.manage', network_id));
create policy privacy_requests_create on public.privacy_requests for insert to authenticated
with check (requester_id = (select auth.uid()));
create policy privacy_requests_manage on public.privacy_requests for update to authenticated
using (private.has_permission('privacy.manage', network_id)) with check (private.has_permission('privacy.manage', network_id));

create policy support_departments_read on public.support_departments for select to authenticated
using (private.can_view_institutional_scope(network_id) or private.has_permission('support.agent', network_id));
create policy support_departments_manage on public.support_departments for all to authenticated
using (private.has_permission('support.manage', network_id)) with check (private.has_permission('support.manage', network_id));
create policy support_tickets_read on public.support_tickets for select to authenticated
using (requester_id = (select auth.uid()) or assignee_id = (select auth.uid()) or private.has_permission('support.agent', network_id, school_id) or private.has_permission('support.manage', network_id, school_id));
create policy support_tickets_create on public.support_tickets for insert to authenticated
with check (requester_id = (select auth.uid()) and private.can_view_institutional_scope(network_id, school_id));
create policy support_tickets_manage on public.support_tickets for update to authenticated
using (private.has_permission('support.agent', network_id, school_id) or private.has_permission('support.manage', network_id, school_id))
with check (private.has_permission('support.agent', network_id, school_id) or private.has_permission('support.manage', network_id, school_id));
create policy support_messages_read on public.support_messages for select to authenticated using (exists (
  select 1 from public.support_tickets ticket where ticket.id = support_messages.ticket_id
  and (ticket.requester_id = (select auth.uid()) or ticket.assignee_id = (select auth.uid()) or private.has_permission('support.agent', ticket.network_id, ticket.school_id) or private.has_permission('support.manage', ticket.network_id, ticket.school_id))
  and (support_messages.visibility = 'public' or private.has_permission('support.agent', ticket.network_id, ticket.school_id) or private.has_permission('support.manage', ticket.network_id, ticket.school_id))
));
create policy support_messages_create on public.support_messages for insert to authenticated with check (author_id = (select auth.uid()) and exists (
  select 1 from public.support_tickets ticket where ticket.id = support_messages.ticket_id and (
    (support_messages.visibility = 'public' and ticket.requester_id = (select auth.uid())) or
    private.has_permission('support.agent', ticket.network_id, ticket.school_id) or private.has_permission('support.manage', ticket.network_id, ticket.school_id)
  )
));
create policy support_history_read on public.support_ticket_history for select to authenticated using (exists (
  select 1 from public.support_tickets ticket where ticket.id = support_ticket_history.ticket_id and
  (ticket.requester_id = (select auth.uid()) or private.has_permission('support.agent', ticket.network_id, ticket.school_id) or private.has_permission('support.manage', ticket.network_id, ticket.school_id))
));

create policy offline_imports_manage on public.offline_response_imports for all to authenticated
using (private.has_permission('offline_import.manage', network_id)) with check (private.has_permission('offline_import.manage', network_id) and created_by = (select auth.uid()));
create policy offline_import_rows_manage on public.offline_response_import_rows for all to authenticated using (exists (
  select 1 from public.offline_response_imports batch where batch.id = offline_response_import_rows.import_id and private.has_permission('offline_import.manage', batch.network_id)
)) with check (exists (
  select 1 from public.offline_response_imports batch where batch.id = offline_response_import_rows.import_id and private.has_permission('offline_import.manage', batch.network_id)
));

create function private.audit_support_ticket_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare field text;
begin
  foreach field in array array['status','priority','assignee_id','department_id'] loop
    if to_jsonb(old)->field is distinct from to_jsonb(new)->field then
      insert into public.support_ticket_history(ticket_id, actor_id, field_name, old_value, new_value)
      values (new.id, (select auth.uid()), field, to_jsonb(old)->>field, to_jsonb(new)->>field);
    end if;
  end loop;
  new.updated_at = now();
  if new.status = 'closed' and old.status <> 'closed' then new.closed_at = now(); end if;
  return new;
end $$;

revoke execute on function private.audit_support_ticket_change() from public, anon, authenticated;
create trigger support_ticket_audit before update on public.support_tickets for each row execute function private.audit_support_ticket_change();

revoke all on public.legal_documents, public.legal_acceptances, public.privacy_requests,
  public.support_departments, public.support_tickets, public.support_messages,
  public.support_ticket_history, public.offline_response_imports, public.offline_response_import_rows
from anon, authenticated;
grant select on public.legal_documents, public.support_departments to authenticated;
grant select, insert on public.legal_acceptances to authenticated;
grant select, insert, update on public.privacy_requests, public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select on public.support_ticket_history to authenticated;
grant select, insert, update, delete on public.support_departments, public.offline_response_imports, public.offline_response_import_rows to authenticated;
grant insert, update, delete on public.legal_documents to authenticated;
grant usage, select on sequence public.support_ticket_history_id_seq, public.offline_response_import_rows_id_seq to authenticated;
