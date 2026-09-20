# Runbook operacional

## Triagem

1. Confirmar ambiente, SHA e correlation ID.
2. Consultar health checks de Auth, Data API, banco, Storage, Edge Functions e jobs.
3. Classificar: rede, sessão, permissão, timeout, conflito, indisponibilidade ou erro inesperado.
4. Verificar mudanças recentes e métricas sem consultar PII desnecessária.
5. Aplicar mitigação documentada ou iniciar rollback.

## Verificações essenciais

- login de aluno e profissional;
- isolamento por rede/escola/turma;
- criação e envio de atividade;
- aplicação de avaliação e autosave;
- analytics no banco;
- upload/download autorizado;
- Help Desk e privacidade;
- filas/jobs sem backlog anormal.

Erros ao usuário apresentam mensagem acionável e identificador de suporte, nunca stack trace.
