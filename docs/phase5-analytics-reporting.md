# Fase 5 — Analytics, desempenho, proficiência e relatórios

## Base e limite operacional

- Branch: `codex/fase5-analytics-relatorios`.
- HEAD inicial: `808f7701aa5e1aedae9082446eaa550761722c40`, mais recente que o HEAD de referência `e678f7876362669b3f2e9ac8e755cdb0aa799431`.
- Dependência: a PR #5 da Fase 4 ainda estava aberta quando esta branch foi criada. A Fase 5 parte diretamente da branch `codex/finaliza-fase4`.
- A migration histórica vazia `20260912231327_add_assessment_runtime.sql` foi preservada.
- Nenhum comando remoto do Supabase foi executado. Produção não foi alterada.

## Fluxo dos dados

```text
assessment_attempts
  -> assessment_responses
  -> assessment_attempt_items.snapshot
  -> curriculum_skills
  -> curriculum_knowledge_objects
  -> curriculum_thematic_units
  -> curriculum_subjects
  -> student_enrollments
  -> classrooms
  -> schools
  -> networks
  -> diagnostic_assessments
  -> assessment_cycles
```

Os fatos são derivados das tabelas transacionais das Fases 2–4. Não há cópia de resposta, nota ou identidade do estudante em uma tabela analítica paralela. As views privadas `analytics_attempt_facts` e `analytics_item_facts` formam a camada semântica; RPCs `SECURITY DEFINER`, com `search_path` vazio e autorização interna, executam filtro, agregação e paginação no PostgreSQL.

## Estados de resultado

- `graded`, `submitted` e `auto_submitted` entram em estatísticas definitivas somente quando nenhuma resposta aguarda correção.
- `pending_review` aparece na participação e nos totais operacionais, mas seu percentual permanece `null`.
- `cancelled` e `invalidated` são excluídas das views analíticas.
- Questão anulada sai do total, nota máxima, nota obtida e psicometria.
- Ausência de observações retorna `empty`; amostra insuficiente retorna `insufficient_data`; métricas inválidas retornam `null`. A API nunca fabrica zero, `NaN` ou infinito.
- Participação usa matrículas ativas realmente agendadas como denominador, inclusive alunos sem tentativa.

## Agregações e currículo

`get_analytics_dashboard(filters)` recebe filtros combináveis de rede, escola, turma, estudante, avaliação, ciclo, componente, série curricular e habilidade. Retorna:

- participação, tentativas, estudantes, questões, respostas, omissões, acertos, erros, pontos e tempos;
- média, mediana, mínimo, máximo, variância populacional, desvio padrão populacional e quantidade de observações;
- desempenho por componente, unidade temática, objeto do conhecimento e habilidade;
- distribuição de proficiência;
- resultados individuais paginados, evolução e psicometria por item.

Detalhes do estudante usam `page` e `page_size`, limitados a 200 linhas. O frontend não baixa respostas brutas para recalcular indicadores.

## Metodologia estatística

Considere apenas observações válidas, após remover `NULL`, itens anulados e tentativas excluídas.

### Estatística descritiva

- Média: `μ = (Σxᵢ) / N`.
- Mediana: percentil contínuo 0,5 do conjunto ordenado.
- Variância populacional: `σ² = Σ(xᵢ - μ)² / N`.
- Desvio padrão populacional: `σ = √σ²`.
- Percentuais são mantidos com quatro casas no cálculo e apresentados com até duas casas.

### Psicometria

- Dificuldade: `p = acertos válidos / respostas válidas`. Exige pelo menos três respostas.
- Discriminação: `D = p_superior - p_inferior`, usando os grupos superior e inferior de 27% ordenados pelo resultado total. Exige ao menos quatro participantes e grupos não vazios.
- Correlação ponto-bisserial: correlação de Pearson entre o escore binário do item e o resultado total da tentativa. Retorna `null` quando qualquer variância é zero ou a amostra tem menos de três respostas.
- Distratores: `escolhas da alternativa / respostas válidas × 100`; a RPC retorna contagem e percentual por alternativa.
- Alfa de Cronbach: `α = k/(k-1) × (1 - Σσᵢ²/σₜ²)`, com variâncias populacionais. Exige `k >= 2`, ao menos três participantes e variância total positiva.

Os testes usam conjuntos fixos e verificam valores conhecidos, incluindo `α = 0,6667` no cenário conectado de quatro itens e quatro estudantes.

## Proficiência e evolução

`proficiency_scales` e `proficiency_levels` versionam nome, vigência, versão, escopo e cortes. Uma escala precisa conter `below_basic`, `basic`, `adequate` e `advanced`, cobrir 0–100 sem lacunas nem sobreposição e manter ordem explícita. `assessment_proficiency_scales` fixa a versão da escala na avaliação. Depois que há resultado final, a associação não pode ser substituída.

A evolução informa resultado anterior, atual, diferença em pontos percentuais, diferença relativa somente quando o valor anterior é diferente de zero e mudança de proficiência na visão individual. Avaliações com escala diferente, componente diferente ou série diferente não são ligadas no mesmo gráfico; a resposta apresenta uma mensagem de incompatibilidade para o usuário refinar os filtros.

## Segurança e privacidade

- Aluno: somente a própria tentativa, inclusive quando manipula `student_id` no cliente.
- Professor: somente turmas das quais é proprietário.
- Gestor escolar: somente a escola do vínculo ativo.
- Administrador de rede: somente a própria rede.
- Revisor e aprovador não recebem analytics individuais por herança editorial.
- As tabelas de escala e jobs têm RLS, escrita direta revogada e mutações por RPC autorizada.
- O bucket `analytics-reports` é privado; somente o worker com service role grava, e o solicitante recebe uma URL assinada por cinco minutos após nova validação de identidade e propriedade do job.
- O service role existe apenas na Edge Function. Nenhuma chave privilegiada é enviada ao frontend.
- Logs do job armazenam IDs técnicos e mensagem de erro limitada; respostas e PII não são copiadas.

A arquitetura deixa o ponto de supressão de grupos pequenos preparado na RPC. A regra mínima ainda precisa ser definida pela política LGPD da contratante antes de ser ativada, pois ocultar grupos sem critério oficial alteraria relatórios exigidos.

## Dashboards e acessibilidade

O componente `AnalyticsDashboard` é reutilizado nas visões do aluno, professor, gestor escolar e rede. Há filtros combináveis, drill-down por habilidade, resultados por estudante, currículo, psicometria, distratores, Cronbach, proficiência e evolução. O estudante vê pontos fortes e habilidades que precisam de atenção, sem gabarito nem estatística interna do item.

Os gráficos Recharts têm título, legenda, tooltip, descrição acessível e tabela textual equivalente. Estados `loading`, `empty`, `error`, `insufficient_data` e `success` são explícitos; foco, controles nativos e layout responsivo preservam navegação por teclado e zoom. Cor não é o único canal de informação.

O modo `qa` contém números DEMO exclusivamente para inspeção visual e mostra a faixa “DEMO visual”. Em modo conectado, toda informação vem das RPCs reais.

## Relatórios e lotes

`get_analytics_report_data` usa o mesmo payload do dashboard e registra `methodology_version=phase5-v1`, filtros, data e condição provisória. Assim, a tela, o PDF, o DOCX e o CSV compartilham a mesma fonte e os mesmos arredondamentos.

- PDF: arquivo PDF real, paginado, com rodapé e metodologia.
- DOCX: documento Office Open XML real com títulos e tabelas.
- CSV: UTF-8 com BOM, delimitador consistente e escape de campos.
- Lote: `request_analytics_report` cria job idempotente; a Edge Function valida o usuário, processa fora do navegador, gera PDFs individuais e índice CSV, compacta em ZIP, grava em bucket privado e atualiza progresso. Estados: `queued`, `processing`, `completed`, `failed`. Retry somente reabre job falho; clique repetido reutiliza a chave até a confirmação.

O worker pagina em blocos de 200 e aceita até 20.000 resultados por job. Acima disso, o usuário deve dividir por turma; o limite evita estouro silencioso de memória/tempo na Edge Function.

## Cache e consistência

Nenhuma materialized view ou cache foi adotado nesta versão. Os dados são derivados na consulta, portanto uma correção discursiva ou anulação aparece na próxima atualização sem janela de defasagem. Os índices cobrem escopo, status, avaliação, estudante, habilidade e fila de jobs. Uma futura materialização só deve ser introduzida com invalidação transacional e SLA documentado.

## Testes e performance

- `tests/analytics-statistics.test.mjs`: fórmulas, casos degenerados, proficiência, evolução e assinaturas reais dos arquivos PDF/DOCX/CSV.
- `tests/phase5-integration.test.mjs`: rede, duas escolas, turmas, alunos, avaliação, quatro itens, habilidade, tentativas e respostas; confere totais em todos os escopos, RLS negativa, proficiência, Cronbach, jobs e idempotência.
- `tests/e2e/phase4-runtime.spec.ts`: amplia o fluxo conectado até o dashboard do professor, habilidade, aluno e download de relatório.
- Ensaio do CI: 12.849 tentativas, detalhes paginados a 200 e medição da RPC agregada. A execução de 13/09/2026 concluiu a agregação em 4.638 ms no runner compartilhado do GitHub Actions.

## Validação e riscos conhecidos

O workflow `phase5-analytics-validation.yml` executa `npm ci`, Supabase local descartável, reset, migration list, dry-run, toda a suíte sem skips, ensaio de carga, Playwright, Deno check das Edge Functions, lint, typecheck, build, build Pages, advisors e `npm audit`.

Riscos restantes:

- o worker ZIP usa memória durante a compactação; lotes grandes devem ser divididos por turma;
- a política institucional de supressão/anominização de grupos pequenos ainda não foi fornecida;
- PDFs usam gráficos resumidos em dados/tabelas; incorporar o desenho vetorial dos gráficos ao documento é uma melhoria visual, sem divergência numérica;
- `npm audit` registra 11 vulnerabilidades existentes: 1 baixa, 2 moderadas e 8 altas. Afetam principalmente a cadeia de desenvolvimento `vinext`/`vite`/Cloudflare e `react-server-dom-webpack`; as atualizações sugeridas exigem nova rodada de regressão, por isso não foi usado `npm audit fix --force`.

Produção não foi alterada.
