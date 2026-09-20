# Mapa de dados

| Domínio | Dados principais | Titulares | Finalidade | Acesso técnico | Armazenamento |
|---|---|---|---|---|---|
| Identidade | nome, e-mail, papel e avatar | alunos e profissionais | autenticação e identificação | próprio usuário e escopo institucional autorizado | Auth, `profiles`, Storage |
| Organização | rede, escola, ano, turma e vínculo | comunidade escolar | operação acadêmica | RBAC e RLS por escopo | tabelas institucionais |
| Aprendizagem | respostas, notas, feedback, habilidades e proficiência | alunos | ensino, avaliação e intervenção | aluno, professor e gestão autorizada | tabelas de aplicação e analytics |
| Frequência | presença, data, turma e registrador | alunos | acompanhamento escolar | aluno e equipe autorizada | `attendance` |
| Portfólio e jornadas | evidências, etapas e intervenções | alunos | acompanhamento pedagógico | participante e equipe autorizada | tabelas da Fase 7 e Storage |
| Suporte | descrição, comentários, prioridade e histórico | usuários | atendimento operacional | solicitante e equipe autorizada | Help Desk |
| Auditoria | ator, ação, recurso, escopo, resultado e correlação | usuários administrativos | segurança e responsabilização | administradores autorizados | `audit_logs` e logs operacionais |

## Fluxos externos

E-mail de autenticação, hospedagem, monitoramento e eventual Help Desk externo só podem receber o mínimo necessário. Fornecedor, região, subprocessadores, contrato e retenção devem ser registrados antes da ativação em produção.
