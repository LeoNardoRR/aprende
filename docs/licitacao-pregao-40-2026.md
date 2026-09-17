# Matriz de conformidade - Pregão Eletrônico nº 40/2026

**Projeto:** Aprendê (`LeoNardoRR/aprende`)
**Versão-base auditada:** `4a96e2b` (`master`)
**Estabilização das Fases 1–3:** branch `codex/estabiliza-pre-fase4`
**Runtime de aplicação da Fase 4:** branch `codex/finaliza-fase4`
**Analytics e relatórios da Fase 5:** branch `codex/fase5-analytics-relatorios`
**Auditoria e preparação da PoC da Fase 6:** branch `codex/fase6-poc-licitacao`, base `89b336ab3dc89af02323ff5f8635beae3b869550`
**Data da auditoria:** 13/09/2026
**Fonte usada nesta rodada:** requisitos funcionais fornecidos na solicitação e o edital retificado anexado em `93578c201e504a12a59cfb9149717ea8Edital+Retificado+PregAo+EletrOnico+n++402026.pdf`. A leitura confirmou que a PoC oficial está nas páginas 67–77 e cobre aproximadamente 70% do Termo de Referência.

## Regra de leitura

Os estados abaixo descrevem o que foi confirmado no código e nos testes atuais. Uma estrutura parecida não é considerada implementação do requisito. Conteúdo pedagógico, operação externa, contas de loja e configuração institucional ficam marcados como dependência quando ainda não há evidência no repositório.

A matriz executável e mais conservadora da Fase 6 está em [`docs/poc/matriz-conformidade.json`](poc/matriz-conformidade.json). Ela é a fonte do Control Center interno, valida caminhos e impede classificar como atendido um requisito sem implementação, teste e evidência. A conformidade ponderada inicial é **47,2%**; há requisitos P0 das Fases 7/8, portanto o produto ainda não está pronto para a PoC integral.

| ID | Requisito | Fonte | Status | Tela | Backend | Teste | Observações |
|---:|---|---|---|---|---|---|---|
| 1 | Rede → escolas → anos/séries → turmas → profissionais → alunos | Escopo 1 | ✅ ATENDE | Administração institucional, diretório e importação | Rede, escola, ano, série, turma, memberships e matrículas escopadas | Integração cobre hierarquia, diretório, importação, movimentações e isolamento | Fluxo institucional das Fases 1–3 demonstrado em banco descartável |
| 2 | Papéis network_admin, manager, reviewer, approver, teacher e student com RBAC | Escopo 2 | ✅ ATENDE | Entrada e administração institucional por papel | Permissões, memberships, RLS, ativação, desativação e revogação | Integração autenticada cobre operações permitidas e negadas | Concessão de `network_admin` permanece restrita ao administrador de rede |
| 3 | Matrícula, importação CSV, promoção, transferência, suspensão e remoção lógica | Escopo 3 | ✅ ATENDE | Preview, importação e diretório exportável | Importação CREATE/UPDATE/SKIP, conflitos, idempotência e histórico | Integração cobre promoção, transferência, suspensão, reativação, conclusão e remoção | Dados DEMO são criados somente durante o teste descartável |
| 4 | BNCC, SAEB, currículo, habilidades e vínculo avaliativo | Escopo 4 | 🟡 PARCIAL | Gestão e importação curricular | Estrutura de áreas, componentes, anos, unidades, objetos e habilidades | Importação atômica, idempotência, identidade natural e escopo | Software implementado; conteúdo oficial BNCC/SAEB continua como dependência externa |
| 5 | Banco de itens com workflow e versões imutáveis | Escopo 5 | 🟡 PARCIAL | Banco paginado, filtros e editor pedagógico | Autoria, revisão, aprovação, rejeição, imagens privadas e snapshots | Workflow, 1.500 linhas DEMO, paginação integral e imutabilidade | Plataforma demonstrada; o acervo real de 1.500 itens depende de conteúdo autorizado |
| 6 | Construtor de provas, cadernos e mapa por habilidade | Escopo 6 | ✅ ATENDE | Ciclos, provas, cadernos A–E e mapa curricular | Até cinco cadernos, itens aprovados congelados, pontos, reorder e deduplicação | Integração da Fase 3 cobre criação, remoção, ordem, duplicação e mapa | O runtime da Fase 4 consome os cadernos aprovados sem alterar o construtor |
| 7 | Calendário e janela de aplicação de avaliações | Escopo 7 | ✅ ATENDE | Calendário, aplicações programadas e acompanhamento | Janelas, turmas, estudantes e tentativas com escopo de rede/escola | Integração cobre programação, acesso na janela e isolamento | O backend limita início e retomada à janela válida |
| 8 | Execução de prova com token, autosave, retomada, tempo e randomização | Escopo 8 | ✅ ATENDE | Runtime focado do aluno e monitor institucional | Token com hash/expiração/revogação, tentativa idempotente, snapshots, relógio do servidor, IndexedDB, autosave e correção | Integração e Playwright cobrem concorrência, reload offline, RLS, autoenvio e correção discursiva | Ordem, caderno e fila offline permanecem persistidos |
| 9 | Analytics por aluno, turma, escola e rede com estatística | Escopo 9 | ✅ ATENDE | Dashboard reutilizado por aluno, professor, escola e rede | Views privadas e RPC agregada com estatística, currículo, psicometria e paginação | Valores matemáticos conhecidos, integração por escopo e E2E conectado | Resultado pendente de discursiva permanece provisório e sem percentual definitivo |
| 10 | Dashboard municipal com filtros e alunos em risco | Escopo 10 | 🟡 PARCIAL | Dashboard de rede com filtros e drill-down | Filtros combináveis e isolamento por rede/escola/turma | Integração valida totais e acesso cruzado | Indicadores existem; modelo institucional de risco e supressão de grupos pequenos ainda depende de definição oficial |
| 11 | Relatórios PDF/DOCX individuais, sintéticos e analíticos | Escopo 11 | ✅ ATENDE | Ações PDF, DOCX, CSV e lote ZIP no dashboard | Payload único, job idempotente, worker e bucket privado | Testes validam assinaturas dos arquivos e E2E baixa PDF | Lotes são processados fora do navegador, com progresso e retry |
| 12 | Escala de proficiência configurável | Escopo 12 | ✅ ATENDE | Distribuição e evolução por nível | Escalas versionadas, cortes 0–100 e vínculo histórico imutável | Integração cobre classificação, distribuição e bloqueio de alteração histórica | Quatro níveis mínimos obrigatórios; versões futuras não mudam resultados consolidados |
| 13 | Equidade/VAAR com dados protegidos | Escopo 13 | 🟡 PARCIAL | Agregação por grupos e supressão de amostra pequena | RPC restrita à rede e grupos configuráveis | Testes determinísticos e negativos de escopo | Faltam fórmula VAAR, dados governados, gap, risco, mapa e relatórios próprios |
| 14 | Fluência leitora | Escopo 14 | 🟡 PARCIAL | Atividade assistida, áudio privado e PCMin | Registro revisável no servidor | Testes do cálculo e isolamento | Faltam modo autônomo, perfis homologados e consolidação visual por escopo |
| 15 | Recomposição, catálogo, fases e gamificação | Escopo 15 | 🟡 PARCIAL | Jornadas, catálogo, atribuição, progresso, portfólio e relatórios | RPCs escopadas, pontos separados e versões | Testes unitários, conectados e E2E | Tipos interativos completos e acervo real de 180 títulos continuam ausentes |
| 16 | IA pedagógica com revisão humana e auditoria | Escopo 16 | 🟡 PARCIAL | Fila auditável de sugestões | Bloqueio básico de PII e decisão humana obrigatória | Teste negativo de PII e autorização de revisor | Falta integração real com provedor e fluxos completos de geração/correção |
| 17 | Provas impressas, gabarito e importação offline | Escopo 17 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Pendente |
| 18 | Acessibilidade e auditoria WCAG | Escopo 18 | 🟡 PARCIAL | Interfaces responsivas e labels existentes | Sem módulo específico | Sem auditoria automatizada completa | Requer auditoria por tela e teclado/leitor |
| 19 | Segurança, LGPD, logs e consentimento versionado | Escopo 19 | 🟡 PARCIAL | Confirmações de conta e configurações | RLS, grants, storage e exclusão de conta existem | Regressão de RLS | Audit log, termos, CAPTCHA/rate limit e governança pendentes |
| 20 | Help desk | Escopo 20 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Pendente |
| 21 | Aplicativos iOS e Android | Escopo 21 | 🟡 PARCIAL | PWA responsivo | Wrapper nativo não existe | Build web/PWA | Capacitor ou equivalente depende de configuração e contas |
| 22 | Versão visível do sistema | Escopo 22 | ✅ ATENDE | Rodapé institucional | Versão técnica v0.1.0 visível | Cobertura visual no portal institucional | Manter sincronizada com a versão publicada |
| 23 | Escala de 12.849 alunos/33 escolas | Escopo 23 | 🟡 PARCIAL | Dashboards e detalhes usam paginação server-side | Índices cobrem escopo, avaliação, estudante, habilidade e jobs | CI mede agregação de 12.849 tentativas e pagina resultados a 200 | O ensaio cobre volume analítico equivalente; ainda falta homologação multi-escola com infraestrutura de produção |
| 24 | Migrations sem alterar histórico aplicado | Escopo 24 | ✅ ATENDE | Não aplicável | Histórico reconciliado e versionado | CI reinicia Supabase local | Push remoto/produção deve continuar via migration |
| 25 | Cobertura de RBAC, RLS, importação, provas e analytics | Escopo 25 | ✅ ATENDE | Não aplicável | Suíte cobre RBAC, RLS, importação, construção, aplicação e analytics | Fase 5 acrescenta matemática determinística, isolamento por papel, relatórios, E2E e carga | Workflow rejeita skips e falhas em qualquer etapa |
| 26 | Rota restrita `/poc` demonstrando a PoC | Escopo 26 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Depende do conteúdo oficial da PoC |
| 27 | Matriz de conformidade versionada | Escopo 27 | ✅ ATENDE | Este documento | Não aplicável | Revisão manual nesta rodada | Atualizar a cada fase |
| 28 | Implementação em fases funcionais | Escopo 28 | 🟡 PARCIAL | Não aplicável | Fases 1–5 implementadas em branches separadas | Suítes por fase e validação conjunta | Fases 6–8 permanecem fora desta branch |
| 29 | Preservar recursos, RLS e CI/CD | Escopo 29 | ✅ ATENDE | Portais preservados | Migration corretiva aditiva; RLS e grants revistos | Advisors locais e regressões verdes | Produção não foi alterada |
| 30 | Validação obrigatória por fase | Escopo 30 | ✅ ATENDE | Não aplicável | CI inicia Supabase descartável, reseta e verifica migrations | Testes sem skip, lint, typecheck, build e build:pages verdes | Workflow também executa advisors e `npm audit` |
| 31 | Relatório final com aderência, riscos e dependências | Escopo 31 | 🟡 PARCIAL | Não aplicável | Não aplicável | Não aplicável | Este é o relatório inicial; o final depende das fases restantes |

## Checklist rastreável da PoC oficial

Esta tabela condensa os itens de demonstração do **Anexo VI, Item 1**, nas páginas 67–76 do edital. O status considera o `master` e a estabilização das Fases 1–3; ele não presume conteúdo pedagógico que ainda não foi fornecido.

| Item da PoC | Exigência oficial agrupada | Página | Status | Evidência atual / lacuna |
|---|---|---:|---|---|
| 1.1 | Nuvem para 1º–9º ano, acesso individual, versão visível, login de docentes/alunos, troca de senha inicial, token de prova, CPF/RA/RG, CAPTCHA, perfis revisor/aprovador/gestor, rede/escola/ano/turma, cartas-senha e movimentações | 67–68 | 🟡 PARCIAL | Papéis, hierarquia, convites, ativação, diretório, importação, movimentações e token de prova estão implementados e testados; versão visível, CAPTCHA e cartas-senha ainda faltam |
| 1.2 | Matrizes BNCC/SAEB/próprias, áreas, componentes, anos, unidades, objetos, habilidades/códigos e filtro curricular na prova | 68 | 🟡 PARCIAL | Estrutura, importação e filtros curriculares existem; conteúdo oficial BNCC/SAEB não foi inventado e depende de fonte autorizada |
| 1.3 | Importação/atualização CSV em lote, conflitos assistidos, credenciais, rejeições, promoção e exportação | 69 | 🟡 PARCIAL | Preview, CREATE/UPDATE/SKIP, conflitos, idempotência, promoção e exportação estão testados; emissão de cartas-senha permanece pendente |
| 1.4 | Banco com 1.500 itens, avaliações de Português/Matemática, tabela de autoria/revisão/aprovação, filtros, quatro alternativas, imagens/fórmulas, distratores, IA revisável e versões imutáveis | 69–70 | 🟡 PARCIAL | Workflow, editor, imagens privadas, fórmulas, distratores, snapshots e paginação de 1.500 registros DEMO estão testados; conteúdo real e IA permanecem pendentes |
| 1.5 | Tabela/construtor de provas, até cinco cadernos, elegibilidade, quantidade de questões, itens aprovados e mapa por habilidade em tabela/gráficos | 70 | ✅ ATENDE | Construtor da Fase 3, cadernos A–E, elegibilidade por aprovação, pontos e mapa curricular deduplicado estão implementados e testados |
| 1.6 | Ciclos, avaliações, calendário mês/semana/dia, janela protegida, agendamento em massa, relatórios por turma e tabela de alunos programados | 70–71 | 🟡 PARCIAL | Ciclos, avaliações, calendário, janelas, turmas, alunos programados e acompanhamento operacional existem; relatórios analíticos pertencem à Fase 5 |
| 1.7 | Prova online sequencial por token, autosave/retomada, cronômetro, estados, randomização, tipos de questão e fechamento automático | 71 | ✅ ATENDE | A Fase 4 implementa token seguro, ordem persistida, múltipla escolha, verdadeiro/falso, discursiva, fila IndexedDB, restauração após reload, retomada, relógio do servidor e autoenvio |
| 1.8 | Dashboards e PDF/DOCX por aluno/turma/escola/rede, habilidades, comparação, Alfa de Cronbach, análise de itens, ranking, lote/ZIP e identificação institucional | 72 | 🟡 PARCIAL | Dashboards, relatórios, psicometria, comparação e lote privado estão implementados e testados; ranking individual não foi exposto por adequação pedagógica e precisa de decisão formal do edital |
| 1.9 | Níveis Abaixo do Básico, Básico, Adequado e Avançado, evolução e exportação | 73 | ✅ ATENDE | Escala versionada, quatro níveis, distribuição, evolução compatível e exportação compartilham a mesma fonte de dados |
| 1.10 | VAAR/equidade: perfil socioeconômico, gap, presets, mapa de calor, risco e qualidade do cadastro | 73 | 🟡 PARCIAL | Grupos, agregação e supressão existem; fórmula VAAR, dados governados, decomposição, mapa, risco e relatórios ainda faltam |
| 1.11 | Fluência leitora por palavras, pseudopalavras e texto, precisão, perfis e consolidação | 73 | 🟡 PARCIAL | Registro assistido, áudio privado e PCMin existem; modo autônomo, perfis e consolidação ainda faltam |
| 1.12 | Objetos interativos, feedback, pontuação, trilhas, progressão, catálogo, 180 títulos de Português/Matemática, portfólio e relatório | 73–74 | 🟡 PARCIAL | Jornadas, catálogo, atribuição, progresso, portfólio e relatório existem; faltam tipos interativos e o acervo real mínimo |
| 1.13 | IA para insights, itens, conteúdos e dissertativas, com revisão humana e privacidade | 74–75 | 🟡 PARCIAL | Fila auditável, filtro básico de PII e revisão humana existem; falta o provedor e a geração real ponta a ponta |
| 1.14 | Aplicativos iOS/Android para aluno e professor | 75 | 🟡 PARCIAL | PWA responsivo; wrapper nativo e contas de loja pendentes |
| 1.15 | Responsividade, contraste, fonte, teclado, ARIA e leitura em voz alta | 75 | 🟡 PARCIAL | Há responsividade/labels; auditoria completa e narração ainda pendentes |
| 1.16 | Isolamento rede/escola/turma, LGPD, termos versionados, auditoria, dados sensíveis, rate limit, sanitização e XSS | 75 | 🟡 PARCIAL | RLS/grants/storage e exclusão de conta existem; governança e auditoria ainda não |
| 1.17 | Prova impressa aluno/professor, gabarito, códigos, folha de resposta, presença e importação offline | 76 | ❌ NÃO ATENDE | Não existe exportador nem importador |
| 2.3 | Help desk com tickets, agentes, prioridade/status, atribuição, notificações, histórico, notas internas e campos customizados | 77 | ❌ NÃO ATENDE | Não existe módulo de suporte |

Os itens 2.1–2.2 (regime, carga horária e contratação dos monitores) e 3.1 (capacitação) são requisitos operacionais da contratação, não funcionalidades demonstráveis no código. Permanecem como **DEPENDÊNCIA DE OPERAÇÃO EXTERNA** e não são contados como aderência de software.

## Auditoria inicial

### Confirmado após as Fases 1–3

- A aplicação usa React/TypeScript/Vinext, Supabase e GitHub Actions.
- O banco atual possui perfis, turmas, memberships, assignments, submissions, announcements, attendance, lesson records e materiais.
- O escopo de leitura/escrita de conteúdo da turma já usa funções privadas e RLS; as regras atuais devem ser mantidas durante a expansão.
- A Fase 1 acrescentou `network_admin`, `manager`, `reviewer` e `approver`, com permissões por vínculo institucional, convites e operações de matrícula.
- A Fase 2 acrescentou currículos customizados, importação atômica, banco de itens, workflow editorial, imagens privadas e versões imutáveis.
- A Fase 3 acrescentou ciclos, avaliações diagnósticas, cadernos A–E, mapa curricular e agendamentos escopados.
- A suíte de estabilização cobre fluxos conectados, RLS, Storage, importações, snapshots, paginação de 1.500 itens DEMO e o construtor da Fase 3.
- O workflow de estabilização executa Supabase local descartável, todas as migrations, testes sem skip, lint, typecheck, dois builds, advisors e auditoria de dependências.

### Lacunas prioritárias após a Fase 5

1. Conteúdo pedagógico oficial BNCC/SAEB e acervo real autorizado.
2. Definição formal de ranking, risco e supressão de grupos pequenos para atender edital e LGPD sem exposição inadequada.
3. Auditoria WCAG assistiva completa, LGPD operacional, help desk e mobile nativo.

## Fases 1–3 estabilizadas

A base institucional, o currículo e banco de itens e o construtor de avaliações foram estabilizados por migrations aditivas. A correção `20260913080728_stabilize_item_storage_and_snapshots.sql` qualifica referências das policies de Storage e congela explicitamente todos os campos pedagógicos no snapshot. A migration `20260912231327_add_assessment_runtime.sql` continua vazia; uma futura Fase 4 deverá criar uma migration posterior.

Antes de aplicar qualquer migration em produção, o fluxo obrigatório é: reset local, testes RLS/integrados, revisão de grants/policies e somente então `db push` no projeto autorizado.

## Fase 4 — Aplicação das avaliações

### IMPLEMENTADO

- Tentativas, itens congelados, respostas, operações idempotentes e eventos de auditoria.
- Token criptograficamente aleatório armazenado apenas como hash, com expiração, rotação, revogação e bloqueio por tentativas inválidas.
- Criação idempotente, distribuição determinística de cadernos A–E e ordem persistida de questões e alternativas.
- Snapshot completo por tentativa, independente de alterações posteriores no banco de itens.
- Runtime do aluno com múltipla escolha, verdadeiro/falso, discursiva, progresso, marcação para revisão, autosave, fila offline e retomada.
- Cronômetro ancorado no horário do servidor, bloqueio de respostas fora do prazo e autoenvio no backend e por `pg_cron`.
- Correção objetiva no servidor, fila de discursivas e revisão humana escopada.
- Monitor operacional paginado por avaliação, atualização agrupada a cada 15 segundos, emissão/revogação de token, encerramento, cancelamento, invalidação, reabertura suportada e consulta de eventos.
- RLS e RPCs guardadas para isolar aluno, turma, escola e rede. Revisor/aprovador editorial não recebe acesso implícito às respostas.
- Fila IndexedDB com migração do `localStorage`, fallback controlado, retry/backoff, bloqueio de submit pendente e aviso de saída.
- Concorrência otimista com `expected_revision`, rejeitando gravação antiga de outra aba.
- Playwright com login, token, autosave online, falha de rede, reload, restauração local, reconexão, envio e bloqueio após conclusão.

### PARCIAL

- A interface tem labels, foco sem distrações e layout responsivo, mas ainda não passou por auditoria WCAG completa com leitor de tela.
- A arquitetura usa paginação, índices e consultas agrupadas; o ensaio de carga com 12.849 alunos e 33 escolas ainda não foi realizado.
- A atualização do monitor usa polling controlado por avaliação. Supabase Realtime não foi necessário nesta entrega.

### PENDENTE

- Dashboards estatísticos, relatórios finais e demais entregas da Fase 5.

## Fase 5 — Analytics e relatórios

A migration `20260913180000_add_phase5_analytics_reporting.sql` cria as views privadas, RPCs analíticas, escalas versionadas e fila de relatórios. `components/analytics-dashboard.tsx` demonstra aluno, professor, escola e rede; `supabase/functions/analytics-report-worker/index.ts` processa lote ZIP privado. `tests/analytics-statistics.test.mjs`, `tests/phase5-integration.test.mjs` e `tests/e2e/phase4-runtime.spec.ts` cobrem fórmulas, isolamento, 12.849 tentativas, drill-down e relatório. A metodologia completa está em `docs/phase5-analytics-reporting.md`.

VAAR, fluência, recomposição completa, IA pedagógica, aplicativos nativos e help desk continuam fora da Fase 5.

## Dependências externas

- Conteúdo pedagógico autorizado para habilidades, itens, 1.500 questões e 180 atividades.
- Brasão, identidade e dados oficiais de cada rede/escola.
- Contas Apple/Google para builds móveis assinados.
- Provedor de e-mail/SMS/CAPTCHA, se exigido pelo ambiente de produção.
