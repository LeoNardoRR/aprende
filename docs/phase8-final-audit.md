# Fase 8 Desktop — auditoria final de gaps

## Proveniência

- Auditoria executada em 20/09/2026 após `git fetch --all --prune`.
- Branch: `codex/fase8-produto-final-desktop`.
- HEAD encontrado: `3d49f7e44032d0dbae5e3b302a473cbf18a1cf89`.
- Base validada da Fase 7: `96a5c0a96630065fb378f06298e03c57e390d4da`.
- Commits da Fase 8 existentes: `310fd6d` (Design System inicial) e `3d49f7e` (fundação operacional).
- Commits posteriores à auditoria anterior: nenhum.
- Estado remoto: a branch e `master` apontavam para o mesmo HEAD; árvore de trabalho limpa.

## Classificação

`IMPLEMENTADO` exige fluxo utilizável; `PARCIAL` indica implementação real incompleta; `DOCUMENTADO APENAS` não conta como funcionalidade; `NÃO IMPLEMENTADO` não possui fluxo real; `DEPENDÊNCIA EXTERNA` não pode ser encerrado apenas por código.

| Requisito | Estado atual | Evidência | Gap | Ação necessária | Prioridade | Status |
|---|---|---|---|---|---|---|
| Design tokens | tokens iniciais globais | `app/design-tokens.css` | escala incompleta e CSS legado duplicado | ampliar tokens e migrar shells com regressão | P0 | PARCIAL |
| Componentes comuns | biblioteca UI extensa | `components/ui/` | estados KPI/filter/error/header não consolidados | criar primitivas faltantes e substituir duplicações seguras | P1 | PARCIAL |
| Shell de gestão | sidebar/header/content | `institutional-admin.tsx` | aluno e professor ainda usam shells históricos | unificar linguagem sem alterar regras | P0 | PARCIAL |
| Aluno Desktop | home, tarefas, provas, jornada, boletim e personagem | `app/page.tsx`, componentes do aluno | consistência, zoom e estados não comprovados | revisão visual e testes reais | P0 | PARCIAL |
| Professor Desktop | turmas, chamada, atividades, provas e notas | `teacher-portal.tsx` | analytics/jornadas e shell ainda fragmentados | consolidar navegação e validar fluxos | P0 | PARCIAL |
| Gestão/Secretaria | módulos institucionais completos até Fase 7 | `institutional-*.tsx` | tabelas/estados ainda inconsistentes | aplicar componentes e screenshots | P0 | PARCIAL |
| Revisor/aprovador | fluxo editorial com histórico | `institutional-pedagogy.tsx`, `item-workspace.tsx` | UX e acessibilidade não validadas integralmente | testar filas, transições e teclado | P1 | PARCIAL |
| Dashboards | analytics server-side | `analytics-dashboard.tsx`, migrations Fase 5 | estados e acessibilidade de gráficos incompletos | padronizar e validar sem recalcular no browser | P0 | PARCIAL |
| Tabelas densas | paginação RPC em áreas críticas | RPCs de diretório | falta matriz uniforme de busca/ordenação/loading | consolidar tabela Desktop | P1 | PARCIAL |
| Acessibilidade automática | foco/skip/reduced-motion | tokens e teste de contrato | sem axe em jornadas críticas | adicionar axe e corrigir violações critical | P0 | PARCIAL |
| Acessibilidade manual | diretrizes descritas | docs de Design System | sem evidência de teclado, zoom ou leitor de tela | executar checklist; não afirmar leitor de tela sem teste | P0 | DOCUMENTADO APENAS |
| Impressão analítica | PDF/DOCX de relatórios | `analytics-report-export.ts` | faltam cinco pacotes de aplicação impressa | gerar conteúdo real e testar arquivos | P0 | PARCIAL |
| Importação offline | fila offline do runtime | `assessment-offline-queue.ts` | não há ingestão CSV/XLSX com preview/idempotência | implementar parser, RPC, auditoria e UI | P0 | NÃO IMPLEMENTADO |
| Termos e privacidade | política técnica | `docs/privacy/` | sem versões/aceites imutáveis | migration, RLS, RPC e UI | P0 | DOCUMENTADO APENAS |
| Solicitações LGPD | fluxo descrito | `lgpd-operational.md` | sem requests, autorização e execução | implementar modelo e exportação do titular | P0 | DOCUMENTADO APENAS |
| Exclusão governada | RPC legada de exclusão | migration Fase 1 | pode apagar conta sem workflow institucional completo | converter para solicitação e retenção | P0 | PARCIAL |
| Help Desk | decisão interna mínima | `helpdesk-decision.md` | sem banco, RLS, RPC, interface ou testes | implementar runtime completo mínimo | P0 | DOCUMENTADO APENAS |
| Observabilidade | contrato descrito | `observability.md` | sem logger/adaptador/health agregado | implementar sanitização, correlação e checks | P1 | DOCUMENTADO APENAS |
| Ambientes | `.env.example` e documentação | `.env.example`, `environments.md` | staging não executado | adicionar validação de configuração e smoke | P1 | PARCIAL |
| Backup/restore | procedimento descrito | `backup-restore.md` | restore não executado | testar em Supabase descartável ou registrar impedimento | P1 | DOCUMENTADO APENAS |
| Performance web | baseline de bundle anotado | `phase8-desktop-readiness.md` | bundle principal ~1.026 MB e módulo pesado | medir e aplicar code splitting | P0 | PARCIAL |
| Escala de banco | fixture 12.849/33 existente | script Fase 7 | ainda não executado após Fase 8 | repetir benchmark e registrar percentis | P0 | PARCIAL |
| Regressão visual | Playwright existente | `tests/e2e/` | sem matriz de screenshots Desktop | criar snapshots úteis por papel/resolução | P0 | NÃO IMPLEMENTADO |
| Segurança | RLS/RPC/grants robustos até Fase 7 | migrations e testes anteriores | novos domínios Fase 8 inexistentes | criar políticas e testes negativos | P0 | PARCIAL |
| CI Fase 8 | workflow criado | `phase8-desktop-validation.yml` | não cobre funcionalidades ainda inexistentes; não executou verde no HEAD final | completar e executar | P0 | PARCIAL |
| Manuais | cinco arquivos mínimos | `docs/manuals/` | conteúdo insuficiente | expandir após fluxos finais | P2 | PARCIAL |
| Treinamento | matriz inicial | `training-plan.md` | sem módulos detalhados/registro | expandir sem declarar realização | P2 | PARCIAL |
| PoC | matriz Fase 6/7 | `docs/poc/` | Fase 8 não refletida | recalcular somente após evidência | P0 | PARCIAL |
| Mobile | requisito preservado | matriz PoC | fora do escopo Desktop | manter não atendido/parcial conforme evidência | — | DEPENDÊNCIA EXTERNA |
| Acervo, VAAR, IA, fluência e atestados | gaps documentados | `docs/poc/gaps.md` | dependem de conteúdo, método, fornecedor ou contratação | manter classificação honesta | — | DEPENDÊNCIA EXTERNA |

## Ordem de fechamento

1. Banco e segurança dos novos domínios: Help Desk, privacidade e importação.
2. Fluxos demonstráveis: interfaces, impressão e importação.
3. Acessibilidade e shell Desktop em todas as experiências.
4. Observabilidade, performance, restore e testes de escala.
5. Regressão visual, CI completo, evidências e atualização da PoC.

Esta auditoria não declara a Fase 8 concluída.

## Evolução verificada nesta retomada

- O domínio operacional ganhou tabelas com RLS para termos, privacidade, Help Desk e lotes de importação; as interfaces de atendimento e solicitações estão ligadas ao cliente autenticado. Isso não equivale a execução de exportação ou anonimização LGPD.
- A exclusão direta legada foi desabilitada. O botão de conta abre uma solicitação idempotente e preserva a conta até análise; a execução final ainda requer política de retenção aprovada e fluxo auditado.
- Os cinco documentos de aplicação impressa têm geradores PDF/DOCX e uma tela ligada a um pacote de caderno/turma construído por RPC com autorização no banco. Foi adicionado um teste conectado para verificar conteúdo real e bloqueio entre escolas na próxima execução descartável.
- O parser CSV/XLSX, validação, prévia e decisões da importação offline existem, mas **a gravação transacional das respostas no runtime ainda não está integrada**. A Fase 8 não deve ser declarada concluída por esse item.
- Axe, teclado, zoom e snapshots Desktop passaram localmente; a validação em Linux/CI e a verificação manual com leitor de tela ainda são evidências distintas e pendentes.
- O CI no commit anterior passou por migrations e regressões conectadas; o resultado do HEAD final deve ser registrado separadamente, sem reutilizar indevidamente evidência de commits anteriores.

## Auditoria de fechamento — 21/09/2026

- Base remota auditada: `master` em `bbca91dd63c6e4fa29afb1b1dc6906bb1d4c34aa`.
- A antiga branch `codex/fase8-produto-final-desktop` apontava para o mesmo SHA.
- Fases 4, 5, 6 e 7 foram confirmadas como ancestrais de `master`; não houve
  remerge nem reescrita de histórico.
- Trabalho isolado em `codex/fase8-finalizacao-desktop`, PR #9 contra `master`.
- GitHub Pages deixou de publicar em push; release exige ação manual explícita.

| Requisito reavaliado | Evidência atual | Classificação |
|---|---|---|
| Importação offline | RPC transacional, runtime real, fingerprint persistente, lote/linhas/auditoria, UI e teste conectado | IMPLEMENTADO — aguarda CI verde do HEAD final |
| Exportação do titular | RPC restrita ao titular autorizado, pacote estruturado sem URL pública, conclusão e auditoria | IMPLEMENTADO — aguarda CI verde do HEAD final |
| Correção LGPD | solicitação e máquina de estados; escrita arbitrária em histórico/notas não existe | IMPLEMENTADO no escopo técnico governado |
| Exclusão LGPD | exclusão direta bloqueada, solicitação idempotente e retenção explícita | IMPLEMENTADO no limite técnico; decisão jurídica é externa |
| Help Desk | banco/RLS/UI/histórico/notas internas/busca/filtros/paginação/teste negativo | IMPLEMENTADO |
| Impressão | cinco documentos PDF/DOCX, payload congelado e teste de escopo | IMPLEMENTADO |
| Acessibilidade automática | axe ampliado, label corrigida e matriz Desktop/zoom | IMPLEMENTADO — CI final pendente |
| Leitor de tela | roteiro NVDA/VoiceOver criado; nenhuma execução humana alegada | VALIDAÇÃO HUMANA PENDENTE |
| Backup/restore | etapa de dump/restore/contagens adicionada ao CI descartável | PENDENTE DE EXECUÇÃO NO HEAD FINAL |
| Performance | baseline documentado; primeiro run final teve timeout legado | PARCIAL até benchmark verde no HEAD final |
| Mobile | preservado na matriz e fora do escopo desta fase | DEPENDÊNCIA EXTERNA / FORA DO ESCOPO |

A classificação técnica da implementação está consolidada; a matriz PoC continua
registrando separadamente os requisitos externos e fora do escopo. Nenhuma
execução desta retomada acessou produção.

## Encerramento solicitado

Em 21/09/2026, após migrations, seed duplo e restore lógico passarem no run
`35602880414`, o solicitante orientou a não repetir toda a verificação de migrations
e a finalizar a entrega. A matriz foi então recalculada em **63,9%**, mantendo os
gaps externos e Mobile. O restore foi reposicionado para o fim do workflow porque
ele altera deliberadamente o banco descartável; assim, futuras execuções não usam
um estado restaurado para rodar regressões conectadas.

O PR permanece aberto, sem merge e sem deploy. Por aceite explícito do solicitante,
a implementação é encerrada como **Fase 8 Desktop tecnicamente concluída: SIM**.
A ausência de uma repetição integral do CI no commit final permanece documentada
como ressalva de validação, sem ser reclassificada como falha de implementação.
