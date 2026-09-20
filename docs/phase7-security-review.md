# Fase 7 — revisão de segurança e dependências

## Escopo e evidência

Auditoria do artifact `phase7-validation-evidence` do [Actions 35218838854](https://github.com/LeoNardoRR/aprende/actions/runs/35218838854), sobre Supabase descartável: 163 findings (146 INFO, 17 WARN, 0 ERROR). `npm audit` foi repetido localmente em 20/09/2026 e manteve 11 vulnerabilidades (1 low, 2 moderate, 8 high, 0 critical). Nenhuma inspeção ou alteração tocou produção.

As tabelas novas da Fase 7 habilitam RLS; `anon` não tem grant de leitura/escrita nem execução das RPCs protegidas. A escrita por `authenticated` foi revogada das tabelas públicas e passa por RPCs `SECURITY DEFINER` com `search_path` vazio e verificação explícita de rede/escola/turma/aluno. O bucket de recursos e o de áudios são privados. `private.journey_step_validation` e `private.journey_version_step_validation` guardam gabaritos sem policy de leitura para o cliente. `RLS Enabled No Policy` nessas tabelas privadas é intencional: acesso só por funções protegidas. Os testes conectados verificam tentativas de aluno, professor sem escopo e anônimo; isso não substitui uma auditoria de pentest.

## Decisão para cada WARN anterior

| Finding | Classificação | Decisão |
|---|---|---|
| `auth_rls_initplan` em `networks.networks_create_institutional` | Dívida de desempenho das Fases 1–6 | Reescrever a avaliação estável de `auth` em migration própria após medir plano; não mudar a autorização para silenciar advisor. |
| `auth_rls_initplan` em `institutional_batch_jobs.batch_jobs_read` | Dívida de desempenho das Fases 1–6 | Medir leitura do lote e otimizar com regressão de escopo. |
| `multiple_permissive_policies` em `academic_years` SELECT | Dívida de RLS herdada | Revisar a união de `manage` e `read` mantendo todos os testes negativos. |
| `multiple_permissive_policies` em `assignments` INSERT | Dívida de RLS herdada | Consolidar somente após comparar os dois fluxos de criação. |
| `multiple_permissive_policies` em `assignments` SELECT | Dívida de RLS herdada | Verificar leitura professor/aluno/instituição antes de consolidar. |
| `multiple_permissive_policies` em `classrooms` SELECT | Dívida de RLS herdada | Rever os escopos escolar e de rede com teste de outra escola. |
| `multiple_permissive_policies` em `classrooms` UPDATE | Dívida de RLS herdada | Exige regressão da edição de turmas legadas e institucionais. |
| `multiple_permissive_policies` em `curriculum_areas` SELECT | Dívida de RLS herdada | Unificar `manage/read` quando houver prova dos escopos. |
| `multiple_permissive_policies` em `curriculum_knowledge_objects` SELECT | Dívida de RLS herdada | Mesma revisão curricular, sem afrouxar acesso. |
| `multiple_permissive_policies` em `curriculum_school_years` SELECT | Dívida de RLS herdada | Mesma revisão curricular. |
| `multiple_permissive_policies` em `curriculum_skills` SELECT | Dívida de RLS herdada | Mesma revisão curricular; habilidade é usada pela Fase 7. |
| `multiple_permissive_policies` em `curriculum_subjects` SELECT | Dívida de RLS herdada | Mesma revisão curricular. |
| `multiple_permissive_policies` em `curriculum_thematic_units` SELECT | Dívida de RLS herdada | Mesma revisão curricular. |
| `multiple_permissive_policies` em `profiles` SELECT | Dívida de RLS com privacidade | Priorizar revisão de PII e teste de outra rede antes de produção. |
| `multiple_permissive_policies` em `school_years` SELECT | Dívida de RLS herdada | Revisar escopo escolar e catálogo. |
| `multiple_permissive_policies` em `student_movements` SELECT | Dívida de RLS com PII | Priorizar revisão da leitura de histórico do estudante. |
| `duplicate_index` em `assessment_items` | Dívida de desempenho da Fase 2 | Remover um dos índices só após comparar definição, uso e plano. |

As 128 advertências INFO de FKs sem índice não autorizam criar índices em massa: o benchmark de Fase 7 usa `EXPLAIN ANALYZE` para justificar os índices de consultas críticas. Os 11 índices sem uso podem estar ociosos somente pelo tamanho pequeno da base descartável. Os 14 WARN de policies sobrepostas não foram classificados como falso positivo nem como risco resolvido: as policies são combinadas por OR e exigem revisão de autorização própria.

## `npm audit` por pacote (20/09/2026)

| Pacote | Tipo | Severidade | Exposição provável e ação |
|---|---|---|---|
| `react-server-dom-webpack` | Direta | High | DoS de Server Functions; atualizar para `19.3.0` compatível e reexecutar E2E/build. |
| `vinext` | Direta | High | Herda `image-size`; atualizar beta.5 → beta.10 somente com regressão de runtime/build. |
| `vite` | Direta | High | Bypass/abertura de arquivo em Windows no servidor de desenvolvimento; atualizar para `8.3.0` e validar builds. |
| `@cloudflare/vite-plugin` | Direta | Moderate | Herda `miniflare`, `wrangler` e `ws`; o audit atual aponta `1.56.0`, requer regressão de build/worker. |
| `wrangler` | Direta | Moderate | Herdado também pelo plugin; atualização deve permanecer alinhada ao plugin. |
| `image-size` | Transitiva de `vinext` | High | Parsers de imagem podem bloquear o processo; corrigir por atualização de `vinext`. |
| `miniflare` | Transitiva do plugin/`wrangler` | High | Ambiente local/worker, com herança de `sharp`, `undici` e `ws`; corrigir pelo plugin. |
| `sharp` | Transitiva do plugin | High | Processamento de imagem/libvips; corrigir pela árvore do plugin. |
| `undici` | Transitiva do plugin | High | HTTP/WebSocket/proxy; corrigir pela árvore do plugin. |
| `ws` | Transitiva do plugin | High | Exaustão de memória/uso de memória não inicializada; corrigir pela árvore do plugin. |
| `esbuild` | Transitiva de `wrangler` | Low | Leitura arbitrária no servidor de desenvolvimento Windows; corrigir pela árvore do plugin. |

Foram preparados upgrades explícitos de `react`, `react-dom`, `react-server-dom-webpack`, `vinext`, `vite`, `@cloudflare/vite-plugin`, `@vitejs/plugin-rsc`, `wrangler` e `@cloudflare/workers-types`; os pares exigidos por peer dependency foram atualizados juntos, sem `--force` ou `--legacy-peer-deps`. O `npm audit` no lockfile novo registrou **0 vulnerabilidades** em 20/09/2026. Essa é evidência de dependências resolvidas; a compatibilidade funcional só será considerada aprovada quando a suíte conectada, E2E e os dois builds ficarem verdes no mesmo HEAD.
