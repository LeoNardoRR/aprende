# Fase 7 — auditoria de fechamento

## Estado inicial (20/09/2026)

- Branch: `codex/fase7-recursos-pedagogicos`, HEAD auditado `753a2f1df0bb6eecf635a0717152d5cebd5ed3ec`, árvore limpa e sincronizada com `origin`.
- Base: `codex/fase6-poc-licitacao` em `c8f3f7b4b29534cd68d7404513cce1ca07823580` (merge-base confirmado). PR [#8](https://github.com/LeoNardoRR/aprende/pull/8) aberta, em rascunho, apta a merge; não foi mergeada.
- Alterações da Fase 7 até o HEAD inicial: 16 commits, 32 arquivos, 5 migrations aditivas. O workflow próprio executou migrations do zero e seed repetido em Supabase descartável no [run 35218838854](https://github.com/LeoNardoRR/aprende/actions/runs/35218838854).
- Baseline do CI: 95/95 testes gerais, 4/4 PoC, 11/11 Fase 7, 4/4 E2E; Deno, lint, typecheck e ambos os builds verdes. O ambiente local não tinha Docker disponível nessa execução; evidências conectadas vêm do CI descartável.
- Matriz da PoC: 21 requisitos, 4 atendidos, 12 parciais, 2 não atendidos, 3 dependências externas; conformidade ponderada de 55,6%. Nenhuma classificação muda só por este documento.

## Inventário e classificação antes de correções

| Domínio | Estado e evidência | Lacuna/risco | Classificação |
|---|---|---|---|
| Recomposição, jornadas, atribuição e progresso | Tabelas, RPCs com autorização, versão de jornada atribuída e testes conectados em `tests/phase7`; fluxo professor/aluno em `tests/e2e/phase7-pedagogy.spec.ts` | A configuração de resposta das etapas é consultada em tabela mutável, fora do snapshot publicado; reatribuições e retomada precisam de regressão mais forte | Implementado, com hardening interno pendente |
| Catálogo | RPC paginada `search_pedagogical_catalog` e teste de uma página | A tela usa `list_pedagogical_catalog`, que agrega o catálogo inteiro, sem limite; filtros de tipo/status/duração não estão expostos na interface | Parcial; corrigir nesta fase |
| Analytics → intervenção | A tela de analytics oferece ação contextual `Atribuir jornada`; E2E autentica professor e aluno | O teste não demonstra ainda recomendação humana, portfólio completo, reavaliação e evolução observada na mesma cadeia | Parcial; ampliar evidência |
| Portfólio | RPC protegida reúne jornadas, evidências, avaliações e fluência; teste nega aluno cruzado | A UI só mostra contagens, sem histórico detalhado | Parcial; corrigir nesta fase |
| Fluência | Atividade assistida, sessão, PCMin no banco, bucket privado, teste de escopo | Falta experiência completa, classificação homologada e reconhecimento de fala; política de retenção depende de decisão administrativa | Implementado parcialmente; metodologia/provedor externo |
| Equidade/VAAR | Grupos configuráveis, supressão mínima, RPC limitada à rede; teste de escopo | Fórmula oficial e dados socioeconômicos governados não existem | Infraestrutura parcial; dependência externa |
| IA assistiva | Solicitação persistida, bloqueio básico de PII e revisão humana; nenhum provedor configurado | Ausência de IA real e necessidade de reforçar minimização/auditoria | Parcial; provedor e política externos |
| Relatórios | PDF/DOCX/CSV do mesmo payload protegido; testes de exportação e escopo | RPC devolve todas as atribuições de uma vez; risco de memória/timeout institucional | Implementado em pequeno volume; corrigir escala |
| Gamificação | Pontos de participação separados do resultado pedagógico em RPC e UI | Não foi demonstrada integração com sistema de conquistas anterior | Parcial; evitar alegação de integração plena |
| Conteúdo oficial | Seed explicitamente sintético | 1.500 itens, 180 títulos e conteúdo homologado não foram fornecidos | Dependência externa, não fabricar |
| Fase 8 | Mobile nativo, Help Desk, aplicação impressa, LGPD operacional e deploy | P0 ainda presentes na matriz | Fora desta branch; manter gaps |

## Segurança e dependências: baseline

O artifact do run 35218838854 registra 163 achados de advisors: 146 INFO, 17 WARN e 0 ERROR. Os 17 WARN são 2 políticas com custo de `auth` por linha, 14 grupos de policies permissivas sobrepostas e 1 par de índices duplicados. Nenhum WARN é específico das novas tabelas da Fase 7; cada um precisa de decisão explícita, sem enfraquecer RLS. O `npm audit` do mesmo run registra 11 vulnerabilidades (1 low, 2 moderate, 8 high, 0 critical), envolvendo dependências diretas e transitivas. A triagem detalhada ficará em `docs/phase7-security-review.md`.

## Condições de saída

Somente evidência de CI conectado, isolamento negativo e benchmark sintético executado pode sustentar fechamento técnico. CI verde não demonstra acervo oficial, metodologia VAAR, provedor de IA nem prontidão integral para a licitação. Produção não foi alterada.

## Correções posteriores ao inventário

- `20260920120000_freeze_phase7_step_validation.sql` congela prompt, opções e gabarito por versão. `20260920123000_align_phase7_snapshot_cleanup.sql` mantém a limpeza de jornadas sintéticas sem permitir apagar versão ainda atribuída. O run 35524116324 descobriu a falha de FK no segundo seed; o run 35524328480 confirmou a correção e a repetição do seed.
- A tela existente de professor/gestor passou a usar a busca paginada em vez da RPC que agregava todo o catálogo. O benchmark percorreu as 63 páginas de 1.500 jornadas sem perdas ou duplicações.
- `20260920130000_enforce_phase7_editorial_transitions.sql` separa autor, revisor e aprovador e exige a ordem draft → review → approved → published; esta correção e seus testes negativos precisam constar de CI verde no HEAD final.
- A medição conectada do run 35524328480 demonstrou 12.849 identidades sintéticas em 33 escolas, com detalhes em `docs/phase7-performance.md`. A exportação institucional ainda é síncrona no navegador e permanece risco operacional.
- A atualização explícita de dependências reduziu o `npm audit` local de 11 para 0 no lockfile. O resultado não comprova compatibilidade até a validação final com `npm ci`, builds e E2E.

Mesmo após o hardening, a tela do estudante resume o portfólio em contagens e não exibe todos os detalhes históricos, nem há runtime completo para todos os tipos de objeto pedagógico. Esses são limites internos da Fase 7. Não declarar 100% técnico enquanto estiverem abertos.
