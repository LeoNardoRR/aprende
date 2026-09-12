# Matriz de conformidade - Pregão Eletrônico nº 40/2026

**Projeto:** Aprendê (`LeoNardoRR/aprende`)  
**Versão auditada:** `fc28ed7` (`master`)  
**Data da auditoria:** 12/09/2026  
**Fonte usada nesta rodada:** requisitos funcionais fornecidos na solicitação e o edital retificado anexado em `93578c201e504a12a59cfb9149717ea8Edital+Retificado+PregAo+EletrOnico+n++402026.pdf`. A leitura confirmou que a PoC oficial está nas páginas 67–77 e cobre aproximadamente 70% do Termo de Referência.

## Regra de leitura

Os estados abaixo descrevem o que foi confirmado no código e nos testes atuais. Uma estrutura parecida não é considerada implementação do requisito. Conteúdo pedagógico, operação externa, contas de loja e configuração institucional ficam marcados como dependência quando ainda não há evidência no repositório.

| ID | Requisito | Fonte | Status | Tela | Backend | Teste | Observações |
|---:|---|---|---|---|---|---|---|
| 1 | Rede → escolas → anos/séries → turmas → profissionais → alunos | Escopo 1 | 🟡 PARCIAL | Portal atual de aluno/professor | Perfis, turmas e memberships existem; hierarquia institucional entra na Fase 1 | Testes atuais cobrem isolamento por turma | Rede e escola ainda não existem na versão auditada |
| 2 | Papéis network_admin, manager, reviewer, approver, teacher e student com RBAC | Escopo 2 | 🟡 PARCIAL | Professor/aluno | Enum atual contém apenas teacher/student | Regressão de professor/aluno | Fase 1 cria papéis e permissões escopadas |
| 3 | Matrícula, importação CSV, promoção, transferência, suspensão e remoção lógica | Escopo 3 | 🟡 PARCIAL | Vínculo do aluno à turma | Memberships permitem vínculo por código; sem matrícula institucional | Teste de join por código | Importador e movimentações ainda pendentes |
| 4 | BNCC, SAEB, currículo, habilidades e vínculo avaliativo | Escopo 4 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Depende de modelagem e conteúdo/referências oficiais |
| 5 | Banco de itens com workflow e versões imutáveis | Escopo 5 | ❌ NÃO ATENDE | Não existe | Assignments não são banco de itens | Não existe | Infraestrutura e conteúdo pedagógico pendentes |
| 6 | Construtor de provas, cadernos e mapa por habilidade | Escopo 6 | 🟡 PARCIAL | Professor publica tarefas/provas simples | Assignments distinguem task/exam | Testes cobrem a distinção | Sem itens aprovados, cadernos ou mapas |
| 7 | Calendário e janela de aplicação de avaliações | Escopo 7 | 🟡 PARCIAL | Calendário do aluno | due_at existe em assignments | Testes básicos de fluxo | Agendamento multi-turma e bloqueios pendentes |
| 8 | Execução de prova com token, autosave, retomada, tempo e randomização | Escopo 8 | 🟡 PARCIAL | Rota de tarefa/prova | Submissions draft/submitted e bloqueio após envio | Testes de submissão | Token, autosave resiliente e cronômetro ainda pendentes |
| 9 | Analytics por aluno, turma, escola e rede com estatística | Escopo 9 | 🟡 PARCIAL | Pontos e frequência do aluno | Cálculo de pontos e presença | Testes de progresso/presença | Estatística educacional e agregações institucionais pendentes |
| 10 | Dashboard municipal com filtros e alunos em risco | Escopo 10 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Depende da Fase 5 |
| 11 | Relatórios PDF/DOCX individuais, sintéticos e analíticos | Escopo 11 | ❌ NÃO ATENDE | Impressão local de materiais apenas | Não existe gerador institucional | Não existe | Geração em lote/ZIP pendente |
| 12 | Escala de proficiência configurável | Escopo 12 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Pendente |
| 13 | Equidade/VAAR com dados protegidos | Escopo 13 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Requer definição institucional e revisão LGPD |
| 14 | Fluência leitora | Escopo 14 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Avaliação assistida pode ser primeira entrega |
| 15 | Recomposição, catálogo, fases e gamificação | Escopo 15 | 🟡 PARCIAL | Sala e trilha do aluno | Assignments, pontos e trilha existem | Testes de pontos/trilha | Catálogo e 180 conteúdos reais dependem de conteúdo pedagógico |
| 16 | IA pedagógica com revisão humana e auditoria | Escopo 16 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Nenhum provedor/modelo configurado |
| 17 | Provas impressas, gabarito e importação offline | Escopo 17 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Pendente |
| 18 | Acessibilidade e auditoria WCAG | Escopo 18 | 🟡 PARCIAL | Interfaces responsivas e labels existentes | Sem módulo específico | Sem auditoria automatizada completa | Requer auditoria por tela e teclado/leitor |
| 19 | Segurança, LGPD, logs e consentimento versionado | Escopo 19 | 🟡 PARCIAL | Confirmações de conta e configurações | RLS, grants, storage e exclusão de conta existem | Regressão de RLS | Audit log, termos, CAPTCHA/rate limit e governança pendentes |
| 20 | Help desk | Escopo 20 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Pendente |
| 21 | Aplicativos iOS e Android | Escopo 21 | 🟡 PARCIAL | PWA responsivo | Wrapper nativo não existe | Build web/PWA | Capacitor ou equivalente depende de configuração e contas |
| 22 | Versão visível do sistema | Escopo 22 | ❌ NÃO ATENDE | Não existe | `package.json` possui versão técnica | Não existe | Pendente |
| 23 | Escala de 12.849 alunos/33 escolas | Escopo 23 | 🟡 PARCIAL | Paginação visual parcial | Índices e consultas escopadas existem | Integração local pequena | Sem teste de volume representativo |
| 24 | Migrations sem alterar histórico aplicado | Escopo 24 | ✅ ATENDE | Não aplicável | Histórico reconciliado e versionado | CI reinicia Supabase local | Push remoto/produção deve continuar via migration |
| 25 | Cobertura de RBAC, RLS, importação, provas e analytics | Escopo 25 | 🟡 PARCIAL | Não aplicável | Suíte atual cobre fluxos conectados e RLS | `npm test` e integração local | Cobertura dos módulos novos ainda pendente |
| 26 | Rota restrita `/poc` demonstrando a PoC | Escopo 26 | ❌ NÃO ATENDE | Não existe | Não existe | Não existe | Depende do conteúdo oficial da PoC |
| 27 | Matriz de conformidade versionada | Escopo 27 | ✅ ATENDE | Este documento | Não aplicável | Revisão manual nesta rodada | Atualizar a cada fase |
| 28 | Implementação em fases funcionais | Escopo 28 | 🟡 PARCIAL | Não aplicável | Fase 1 iniciada nesta branch/master | Testes por fase | Demais fases ainda não iniciadas |
| 29 | Preservar recursos, RLS e CI/CD | Escopo 29 | ✅ ATENDE | Portais preservados | Migrations aditivas; RLS/grants existentes preservados | Regressões atuais verdes | Cada migration nova precisa de auditoria própria |
| 30 | Validação obrigatória por fase | Escopo 30 | 🟡 PARCIAL | Não aplicável | CI executa Supabase local + migrations | Lint, typecheck, build e testes atuais | Fase 1 adicionará cenários institucionais |
| 31 | Relatório final com aderência, riscos e dependências | Escopo 31 | 🟡 PARCIAL | Não aplicável | Não aplicável | Não aplicável | Este é o relatório inicial; o final depende das fases restantes |

## Checklist rastreável da PoC oficial

Esta tabela condensa os itens de demonstração do **Anexo VI, Item 1**, nas páginas 67–76 do edital. O status é do código auditado em `fc28ed7`; ele não presume conteúdo pedagógico que ainda não foi fornecido.

| Item da PoC | Exigência oficial agrupada | Página | Status | Evidência atual / lacuna |
|---|---|---:|---|---|
| 1.1 | Nuvem para 1º–9º ano, acesso individual, versão visível, login de docentes/alunos, troca de senha inicial, token de prova, CPF/RA/RG, CAPTCHA, perfis revisor/aprovador/gestor, rede/escola/ano/turma, cartas-senha e movimentações | 67–68 | 🟡 PARCIAL | PWA, login, teacher/student e turmas existem; versão, token, CAPTCHA, credenciais em lote e escopo institucional entram nas próximas fases |
| 1.2 | Matrizes BNCC/SAEB/próprias, áreas, componentes, anos, unidades, objetos, habilidades/códigos e filtro curricular na prova | 68 | ❌ NÃO ATENDE | Não há módulo curricular nem catálogo de habilidades |
| 1.3 | Importação/atualização CSV em lote, conflitos assistidos, credenciais, rejeições, promoção e exportação | 69 | ❌ NÃO ATENDE | Membership por código não substitui matrícula/importação |
| 1.4 | Banco com 1.500 itens, avaliações de Português/Matemática, tabela de autoria/revisão/aprovação, filtros, quatro alternativas, imagens/fórmulas, distratores, IA revisável e versões imutáveis | 69–70 | ❌ NÃO ATENDE | Assignments são tarefas/provas simples; conteúdo real é dependência pedagógica |
| 1.5 | Tabela/construtor de provas, até cinco cadernos, elegibilidade, quantidade de questões, itens aprovados e mapa por habilidade em tabela/gráficos | 70 | 🟡 PARCIAL | Há `assignments.kind = exam`; não há itens, cadernos ou mapa |
| 1.6 | Ciclos, avaliações, calendário mês/semana/dia, janela protegida, agendamento em massa, relatórios por turma e tabela de alunos programados | 70–71 | 🟡 PARCIAL | Existe `due_at` e calendário de sala; aplicação multi-turma ainda não existe |
| 1.7 | Prova online sequencial por token, autosave/retomada, cronômetro, estados, randomização, tipos de questão e fechamento automático | 71 | 🟡 PARCIAL | Draft/submitted e bloqueio após envio existem; o modo de prova diagnóstico ainda não |
| 1.8 | Dashboards e PDF/DOCX por aluno/turma/escola/rede, habilidades, comparação, Alfa de Cronbach, análise de itens, ranking, lote/ZIP e identificação institucional | 72 | ❌ NÃO ATENDE | Pontos/frequência não são o painel estatístico exigido |
| 1.9 | Níveis Abaixo do Básico, Básico, Adequado e Avançado, evolução e exportação | 73 | ❌ NÃO ATENDE | Não existe escala de proficiência |
| 1.10 | VAAR/equidade: perfil socioeconômico, gap, presets, mapa de calor, risco e qualidade do cadastro | 73 | ❌ NÃO ATENDE | Não existe módulo; dados de menores exigem desenho LGPD antes de carga |
| 1.11 | Fluência leitora por palavras, pseudopalavras e texto, precisão, perfis e consolidação | 73 | ❌ NÃO ATENDE | Não existe módulo |
| 1.12 | Objetos interativos, feedback, pontuação, trilhas, progressão, catálogo, 180 títulos de Português/Matemática, portfólio e relatório | 73–74 | 🟡 PARCIAL | Trilha/pontos e tarefas existem; autoria, catálogo e conteúdo real dependem de implementação/conteúdo |
| 1.13 | IA para insights, itens, conteúdos e dissertativas, com revisão humana e privacidade | 74 | ❌ NÃO ATENDE | Não há integração de IA nem trilha de aprovação |
| 1.14 | Aplicativos iOS/Android para aluno e professor | 75 | 🟡 PARCIAL | PWA responsivo; wrapper nativo e contas de loja pendentes |
| 1.15 | Responsividade, contraste, fonte, teclado, ARIA e leitura em voz alta | 75 | 🟡 PARCIAL | Há responsividade/labels; auditoria completa e narração ainda pendentes |
| 1.16 | Isolamento rede/escola/turma, LGPD, termos versionados, auditoria, dados sensíveis, rate limit, sanitização e XSS | 75 | 🟡 PARCIAL | RLS/grants/storage e exclusão de conta existem; governança e auditoria ainda não |
| 1.17 | Prova impressa aluno/professor, gabarito, códigos, folha de resposta, presença e importação offline | 76 | ❌ NÃO ATENDE | Não existe exportador nem importador |
| 2.3 | Help desk com tickets, agentes, prioridade/status, atribuição, notificações, histórico, notas internas e campos customizados | 77 | ❌ NÃO ATENDE | Não existe módulo de suporte |

Os itens 2.1–2.2 (regime, carga horária e contratação dos monitores) e 3.1 (capacitação) são requisitos operacionais da contratação, não funcionalidades demonstráveis no código. Permanecem como **DEPENDÊNCIA DE OPERAÇÃO EXTERNA** e não são contados como aderência de software.

## Auditoria inicial

### Confirmado

- A aplicação usa React/TypeScript/Vinext, Supabase e GitHub Actions.
- O banco atual possui perfis, turmas, memberships, assignments, submissions, announcements, attendance, lesson records e materiais.
- O escopo de leitura/escrita de conteúdo da turma já usa funções privadas e RLS; as regras atuais devem ser mantidas durante a expansão.
- O papel persistido atualmente é limitado a `teacher` e `student`.
- A suíte atual cobre fluxos conectados, bloqueio de submissão, frequência, materiais/storage, grants e alguns cenários de isolamento.
- A publicação Pages executa migrations locais, integração RLS, lint, typecheck e build antes do deploy.

### Lacunas prioritárias

1. Hierarquia institucional e papéis escopados.
2. Banco curricular/BNCC e banco de itens.
3. Construtor e execução de avaliações diagnósticas.
4. Analytics e relatórios institucionais.
5. Acessibilidade auditada, LGPD operacional, help desk e mobile nativo.

## Fase 1 iniciada

A migration `20260912153902_add_institutional_rbac_foundation.sql` cria a base aditiva de rede, escola, ano letivo, série, memberships institucionais, matrículas, movimentações e permissões. Ela mantém as colunas legadas de `classrooms` opcionais para não quebrar turmas já existentes e acrescenta políticas institucionais sem remover as políticas atuais.

Antes de aplicar qualquer migration em produção, o fluxo obrigatório é: reset local, testes RLS/integrados, revisão de grants/policies e somente então `db push` no projeto autorizado.

## Dependências externas

- Conteúdo pedagógico autorizado para habilidades, itens, 1.500 questões e 180 atividades.
- Brasão, identidade e dados oficiais de cada rede/escola.
- Contas Apple/Google para builds móveis assinados.
- Provedor de e-mail/SMS/CAPTCHA, se exigido pelo ambiente de produção.
