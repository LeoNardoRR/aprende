# Inventário de telas — Aprendê Web Desktop

Base auditada: `codex/fase8-produto-final-desktop`, derivada do commit verde `96a5c0a` da Fase 7.

| Experiência | Entrada/rota demonstrável | Finalidade | Componentes principais | Estado e dependências |
|---|---|---|---|---|
| Login e escolha de perfil | `/aprende/` | autenticação de aluno e profissional | `app/page.tsx`, `student-connect.tsx` | funcional; depende de Auth no modo conectado |
| Home do aluno | `?mode=student` | atividades, avisos, progresso e personagem | `student-home.tsx`, `student-learning-path.tsx` | funcional e preservada |
| Avaliação do aluno | token de aplicação | runtime, autosave, offline e finalização | `student-assessment-runtime.tsx` | funcional; depende de agendamento/token |
| Jornada do aluno | painel do aluno | etapas, evidências, progresso e portfólio | `pedagogical-journeys.tsx` | funcional; dados DEMO identificados na prévia |
| Portal do professor | `?qa=teacher-dashboard` | turmas, alunos, frequência, materiais e avaliações | `teacher-portal.tsx` | funcional; alta densidade exige shell consistente |
| Gestão institucional | `?qa=institution-admin` | redes, escolas, anos, turmas e matrículas | `institutional-admin.tsx` | funcional; alvo principal do passe Desktop |
| Usuários e convites | `#access` | diretório, papéis, histórico e convites | `institutional-users.tsx`, `institutional-invitations.tsx` | visual padronizado; RLS/RPC existentes |
| Currículo | `#curricula` | matriz, estrutura e importação | `institutional-pedagogy.tsx`, `curriculum-explorer.tsx` | funcional; conteúdo oficial é dependência externa |
| Banco de itens | `#item-bank` | autoria, revisão, aprovação e cobertura | `item-workspace.tsx` | funcional; paginação no servidor |
| Avaliações | `#assessments` | ciclos, provas, cadernos, calendário e aplicações | `institutional-assessments.tsx` | funcional |
| Analytics | `#analytics` | KPIs, currículo, psicometria, proficiência e relatórios | `analytics-dashboard.tsx` | funcional; cálculo no banco |
| Recomposição | `#remediation` | lacuna, jornada, intervenção e progresso | `pedagogical-journeys.tsx` | funcional |
| Control Center PoC | `#poc`, somente admin interno | matriz, gaps e evidências | `poc-control-center.tsx` | protegido e não público em produção |
| Configuração da conta | portal autenticado | perfil e solicitação de exclusão | `account-settings.tsx` | exclusão existente; governança operacional será ampliada |

## Regras do inventário

- Mobile permanece fora do escopo e não é considerado atendido.
- Telas administrativas são validadas em 1024, 1280, 1366, 1440, 1600 e 1920 px.
- Conteúdo real, método VAAR, reconhecimento de fala e atestados não são inferidos a partir da capacidade do software.
