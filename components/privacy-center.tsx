'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Database, Download, LoaderCircle } from 'lucide-react';
import { studentSupabase, supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import {
  privacyStatusLabels,
  privacyTypeLabels,
} from '@/lib/phase8-operations';

type LegalDocument = Tables<'legal_documents'>;
type LegalAcceptance = Tables<'legal_acceptances'>;
type PrivacyRequest = Tables<'privacy_requests'>;

const previewDocuments: LegalDocument[] = [
  {
    id: 'privacy-preview',
    document_type: 'privacy',
    version: '1.0',
    title: 'Política de privacidade do Aprendê',
    content:
      'Este documento explica como o Aprendê usa e protege os dados pessoais da comunidade escolar.',
    content_hash: '0'.repeat(64),
    effective_at: '2026-09-20T00:00:00Z',
    published_at: '2026-09-20T00:00:00Z',
    published_by: 'preview-admin',
  },
];

export function PrivacyCenter({
  role,
  preview = false,
}: {
  role: 'student' | 'teacher';
  preview?: boolean;
}) {
  const client = role === 'student' ? studentSupabase : supabase;
  const [userId, setUserId] = useState(preview ? 'preview-user' : '');
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>(
    preview ? previewDocuments : [],
  );
  const [acceptances, setAcceptances] = useState<LegalAcceptance[]>([]);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      setNotice('Sua sessão expirou. Entre novamente.');
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const [documentsResult, acceptancesResult, requestsResult] =
      await Promise.all([
        client
          .from('legal_documents')
          .select('*')
          .order('effective_at', { ascending: false }),
        client
          .from('legal_acceptances')
          .select('*')
          .eq('user_id', user.id)
          .order('accepted_at', { ascending: false }),
        client
          .from('privacy_requests')
          .select('*')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
    const firstError = [
      documentsResult,
      acceptancesResult,
      requestsResult,
    ].find((result) => result.error)?.error;
    if (firstError)
      setNotice(`Não foi possível carregar: ${firstError.message}`);
    setDocuments(documentsResult.data ?? []);
    setAcceptances(acceptancesResult.data ?? []);
    setRequests(requestsResult.data ?? []);

    const scopeResult =
      role === 'teacher'
        ? await client
            .from('classrooms')
            .select('network_id')
            .eq('owner_id', user.id)
            .not('network_id', 'is', null)
            .limit(1)
            .maybeSingle()
        : await client
            .from('student_enrollments')
            .select('network_id')
            .eq('student_id', user.id)
            .limit(1)
            .maybeSingle();
    setNetworkId(scopeResult.data?.network_id ?? null);
    setLoading(false);
  }, [client, preview, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptedDocumentIds = useMemo(
    () =>
      new Set(
        acceptances
          .filter((acceptance) => acceptance.result === 'accepted')
          .map((acceptance) => acceptance.document_id),
      ),
    [acceptances],
  );

  async function acceptDocument(documentId: string) {
    setBusy(true);
    setNotice('');
    if (preview) {
      setAcceptances((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          document_id: documentId,
          user_id: userId,
          context: 'web_desktop',
          result: 'accepted',
          accepted_at: new Date().toISOString(),
        },
      ]);
      setNotice('Aceite registrado na prévia.');
      setBusy(false);
      return;
    }
    const { error } = await client.from('legal_acceptances').insert({
      document_id: documentId,
      user_id: userId,
      context: 'web_desktop',
      result: 'accepted',
    });
    if (error)
      setNotice(`Não foi possível registrar o aceite: ${error.message}`);
    else {
      setNotice('Aceite registrado com data, versão e titular.');
      await load();
    }
    setBusy(false);
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const values = new FormData(event.currentTarget);
    const payload = {
      requester_id: userId,
      network_id: networkId,
      request_type: String(values.get('request_type')),
      details: String(values.get('details') ?? '').trim() || null,
    };
    if (preview) {
      setRequests((current) => [
        {
          ...payload,
          id: crypto.randomUUID(),
          correlation_id: crypto.randomUUID(),
          status: 'requested',
          resolution: null,
          handled_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: null,
        },
        ...current,
      ]);
      setNotice('Solicitação criada na prévia.');
      setRequestFormOpen(false);
      setBusy(false);
      return;
    }
    const { error } = await client.from('privacy_requests').insert(payload);
    if (error)
      setNotice(`Não foi possível abrir a solicitação: ${error.message}`);
    else {
      setRequestFormOpen(false);
      setNotice('Solicitação registrada. Acompanhe o andamento abaixo.');
      await load();
    }
    setBusy(false);
  }

  return (
    <section className="privacy-center" aria-labelledby="privacy-center-title">
      <header>
        <span className="privacy-center-icon">
          <Database size={18} />
        </span>
        <div>
          <h3 id="privacy-center-title">Privacidade e meus dados</h3>
          <p>
            Consulte termos, registre aceites e exerça seus direitos de titular.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="operations-loading">
          <LoaderCircle className="spin" /> Carregando privacidade…
        </p>
      ) : (
        <>
          <div className="privacy-documents">
            {documents.map((document) => {
              const accepted = acceptedDocumentIds.has(document.id);
              return (
                <article key={document.id}>
                  <button
                    type="button"
                    className="privacy-document-title"
                    aria-expanded={expandedDocument === document.id}
                    onClick={() =>
                      setExpandedDocument((current) =>
                        current === document.id ? null : document.id,
                      )
                    }
                  >
                    <span>
                      <strong>{document.title}</strong>
                      <small>Versão {document.version}</small>
                    </span>
                    {accepted ? <CheckCircle2 aria-label="Aceito" /> : 'Ler'}
                  </button>
                  {expandedDocument === document.id && (
                    <div className="privacy-document-content">
                      <p>{document.content}</p>
                      <small>
                        Vigente desde {formatDate(document.effective_at)}
                      </small>
                      {!accepted && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void acceptDocument(document.id)}
                        >
                          Li e aceito esta versão
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {!documents.length && <p>Nenhum documento legal vigente.</p>}
          </div>

          <div className="privacy-request-head">
            <div>
              <strong>Solicitações LGPD</strong>
              <small>Exportação, correção ou exclusão</small>
            </div>
            <button
              type="button"
              onClick={() => setRequestFormOpen((value) => !value)}
            >
              <Download size={15} /> Nova solicitação
            </button>
          </div>
          {requestFormOpen && (
            <form className="privacy-request-form" onSubmit={createRequest}>
              <label>
                Tipo
                <select name="request_type" defaultValue="export">
                  <option value="export">Exportar meus dados</option>
                  <option value="correction">Corrigir meus dados</option>
                  <option value="deletion">Excluir meus dados</option>
                </select>
              </label>
              <label>
                Detalhes (opcional)
                <textarea
                  name="details"
                  maxLength={4000}
                  placeholder="Explique o que você precisa."
                />
              </label>
              <div>
                <button type="button" onClick={() => setRequestFormOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? 'Enviando…' : 'Enviar solicitação'}
                </button>
              </div>
            </form>
          )}
          <div className="privacy-request-list">
            {requests.map((request) => (
              <article key={request.id}>
                <div>
                  <strong>
                    {privacyTypeLabels[request.request_type] ??
                      request.request_type}
                  </strong>
                  <small>{formatDate(request.created_at)}</small>
                </div>
                <span data-status={request.status}>
                  {privacyStatusLabels[request.status] ?? request.status}
                </span>
                {request.resolution && <p>{request.resolution}</p>}
              </article>
            ))}
            {!requests.length && <p>Você ainda não abriu solicitações.</p>}
          </div>
        </>
      )}
      {notice && (
        <output className="privacy-notice" aria-live="polite">
          {notice}
        </output>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}
