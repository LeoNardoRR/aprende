# Fase 4 — Runtime de aplicação das avaliações

## Escopo e segurança operacional

- Branch de finalização: `codex/finaliza-fase4`.
- Base confirmada: `codex/fase4-aplicacao-avaliacoes` no commit `0415feda04f3f422e54c207a715c9e422b1d01db`.
- Produção não foi acessada, alterada, migrada ou publicada.
- A migration histórica `20260912231327_add_assessment_runtime.sql` continua com zero bytes.
- O hardening desta rodada está na migration aditiva `20260913170100_harden_phase4_response_concurrency.sql`.
- O frontend nunca recebe `service_role`; o E2E injeta essa credencial apenas no processo Node do runner para criar e remover fixtures locais.

## Arquitetura e fluxo

```text
Agendamento
  → emissão/rotação de token
  → tentativa única por aluno e agendamento
  → caderno e snapshots persistidos
  → respostas em autosave
  → submissão manual ou fechamento pelo prazo do servidor
  → correção objetiva
  → revisão discursiva, quando houver
  → graded
```

O professor ou gestor autorizado usa **Aplicações** para emitir o acesso. O backend cria uma única tentativa por `(schedule_id, student_id)`, distribui o caderno de forma determinística e congela questão, ordem das alternativas e pontuação. O token aleatório é exibido uma vez na sessão da interface; o banco guarda somente SHA-256, expiração, contador de falhas, bloqueio e revogação.

O aluno autenticado vê apenas aplicações compatíveis com sua matrícula ativa. Ao iniciar ou retomar, o backend devolve `server_now`, `deadline_at`, posição, caderno, snapshots sanitizados e respostas confirmadas. Gabarito, justificativa, distratores e feedback interno não fazem parte do payload durante a prova.

O cronômetro usa a diferença entre o horário do servidor e o instante de recebimento, sem confiar no relógio configurado no dispositivo. Toda leitura, escrita e retomada volta a aplicar o deadline. A rotina do `pg_cron` fecha tentativas expiradas; as RPCs também verificam o prazo, por isso ficar offline nunca amplia o tempo.

## Dados, estados e RPCs

As tabelas públicas da fase são:

- `assessment_attempts`: vínculo, token em hash, caderno, prazo, estado e pontuação agregada;
- `assessment_attempt_items`: snapshot imutável, posição e ordem das opções;
- `assessment_responses`: resposta, revisão, pontuação e revisão otimista;
- `assessment_attempt_events`: log operacional sem conteúdo integral da resposta.

`private.assessment_response_operations` guarda a idempotência do autosave e não é exposta pela Data API. Os estados suportados pela tentativa são `scheduled`, `available`, `in_progress`, `paused`, `submitted`, `auto_submitted`, `pending_review`, `graded`, `cancelled` e `invalidated`; o monitor traduz todos eles para rótulos explícitos.

As RPCs públicas são `issue_assessment_access_token`, `revoke_assessment_access_token`, `list_available_assessments`, `start_assessment_attempt`, `get_assessment_attempt`, `save_assessment_response`, `set_assessment_attempt_position`, `resume_assessment_attempt`, `submit_assessment_attempt`, `list_assessment_attempt_monitor`, `list_pending_essay_responses`, `review_essay_response`, `manage_assessment_attempt` e `list_assessment_attempt_events`.

Funções `SECURITY DEFINER` usam `search_path = ''`, validam `auth.uid()` e o escopo institucional dentro do corpo e têm grants mínimos. Os helpers privados necessários às policies são executáveis apenas por `authenticated`; `anon` não executa helpers nem RPCs da aplicação. RLS impede leitura cruzada entre alunos, escolas e redes. Escritas de tentativa, resposta, score ou revisão não são feitas diretamente pelo cliente.

## Autosave, IndexedDB e retomada

`lib/assessment-offline-queue.ts` concentra toda persistência local assíncrona. O store IndexedDB `pending-saves` mantém somente:

- `attemptId`;
- `attemptItemId`;
- `answer`;
- `markedForReview`;
- `idempotencyKey`;
- `queuedAt`;
- `expectedRevision`, metadado técnico não sensível necessário para impedir sobrescrita por uma aba antiga.

Não são persistidos token, gabarito, feedback interno ou dados institucionais desnecessários. Se IndexedDB estiver indisponível, a fila usa uma chave separada em `localStorage`; se esse armazenamento também falhar, conserva a resposta apenas em memória e mostra erro de sincronização. A fila da versão anterior é importada uma vez e sua chave antiga só é removida depois que cada entrada foi persistida em IndexedDB ou no fallback durável.

Cada mudança substitui a pendência anterior do mesmo item, recebe uma chave idempotente e usa debounce de 650 ms. O backend confirma `revision` e `saved_at`; somente depois dessa confirmação a entrada é removida. A interface distingue `idle`, `saving`, `saved`, `offline`, `pending` e `sync_error`, mostra a quantidade pendente, oferece **Tentar sincronizar novamente**, tenta no evento `online` e aplica backoff de 2 a 30 segundos. `beforeunload` é instalado somente enquanto existe fila pendente.

O overload público de `save_assessment_response` exige `expected_revision`. Duas abas que partem da mesma revisão podem enviar simultaneamente, mas apenas uma grava; a outra recebe conflito SQLSTATE `40001`. Repetir a mesma `idempotency_key` retorna o resultado original. Uma resposta antiga nunca substitui silenciosamente uma revisão confirmada mais nova.

## Submissão e timeout

A submissão manual espera a persistência local terminar, força o flush e consulta a fila novamente. Se qualquer operação falhar ou continuar pendente, `submit_assessment_attempt` não é chamada, a tentativa fica aberta e a tela informa que as respostas ainda precisam sincronizar.

Quando o prazo chega a zero, o frontend tenta o mesmo flush sem aguardar a rede indefinidamente. Respostas confirmadas continuam no banco; respostas apenas locais continuam na fila e são descritas como não confirmadas. O backend fecha a tentativa segundo o deadline real. Uma reconexão tardia pode consultar o estado final, mas a RPC de salvamento rejeita alterações pós-prazo. A interface nunca chama uma resposta local de salva sem confirmação do servidor.

`submit_assessment_attempt` é transacional e idempotente: chamadas repetidas retornam o mesmo estado, não recalculam uma pontuação divergente e não duplicam eventos `submitted` ou `pending_review`. Múltipla escolha e verdadeiro/falso são corrigidos pelo snapshot congelado. Discursivas passam a `pending_review`; professor com `assessment.apply` no mesmo escopo atribui score e comentário, e a tentativa vira `graded` quando não restam discursivas pendentes.

## Monitor e acessibilidade

O monitor busca uma página de 50 alunos por avaliação, inclusive programados sem tentativa, e atualiza o lote a cada 15 segundos. Mostra aluno, turma, caderno, progresso, início, última atividade, tempo e status; não transmite respostas completas ao vivo. Eventos e discursivas são carregados apenas sob demanda e no escopo autorizado.

O modo prova oferece labels, mapa com estado respondida/não respondida e marcada, `aria-current`, `aria-live` no salvamento, cronômetro com `role="timer"`, foco no enunciado ao navegar e botões Anterior/Próxima operáveis por teclado. A auditoria manual completa com leitores de tela permanece como trabalho de homologação, sem introduzir TTS nesta fase.

## Migrations da Fase 4

1. `20260913111359_add_assessment_application_runtime.sql`: modelo, RLS, tokens, snapshots, autosave, timer, submissão, correção, monitor, eventos e cron.
2. `20260913153000_complete_phase4_application_monitor.sql`: paginação de todos os alunos programados.
3. `20260913160000_fix_phase4_policy_helper_execution.sql`: grants mínimos dos helpers booleanos usados pelas policies.
4. `20260913170100_harden_phase4_response_concurrency.sql`: optimistic concurrency e remoção do endpoint antigo de cinco argumentos para `authenticated`.

## Testes e validação

`tests/phase4-integration.test.mjs` cobre token, hash, rotação, revogação, brute force, tentativa única, snapshots, ordem persistida, RLS cruzada, anon, idempotência, conflitos simultâneos, timeout, bloqueio pós-prazo/pós-submit, correção objetiva, revisão discursiva, eventos e paginação do monitor.

`tests/assessment-offline-queue.test.mjs` cobre a migração da fila antiga, remoção somente após persistência durável e fallback controlado. `tests/e2e/phase4-runtime.spec.ts` faz login real no Supabase descartável, inicia uma prova por token, salva online, interrompe o RPC de autosave, responde offline, bloqueia a submissão, recarrega, restaura o IndexedDB, reconecta, sincroniza, finaliza e confirma que a tentativa encerrada não oferece edição.

O workflow executa `npm ci`, instala Chromium, inicia Supabase local, reseta e lista migrations, executa dry-run, roda todos os testes sem skip, E2E, `deno check`, lint, typecheck, `build`, `build:pages`, advisors e `npm audit --audit-level=critical`. `set -o pipefail` impede falso verde na etapa canalizada por `tee`.

## Limitações e riscos restantes

- O monitor usa polling agrupado de 15 segundos. Realtime só deve ser adotado se uma medição demonstrar benefício.
- Ainda falta ensaio de carga com 12.849 alunos e 33 escolas.
- A auditoria WCAG completa com leitores de tela faz parte da homologação.
- Permanecem 11 vulnerabilidades npm conhecidas: 1 baixa, 2 moderadas e 8 altas. As correções sugeridas alteram versões de Vinext, Vite, React Server Components e Cloudflare fora das faixas atuais; não foi usado `npm audit fix --force` nesta estabilização.
- Analytics, proficiência, relatórios, estatística educacional, VAAR, fluência, recomposição e IA pedagógica continuam reservados para fases posteriores.

Produção não foi alterada.
