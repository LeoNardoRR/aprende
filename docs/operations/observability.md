# Observabilidade

Eventos estruturados usam `timestamp`, `level`, `environment`, `release`, `correlation_id`, `operation`, `result`, `duration_ms` e identificadores técnicos de escopo. Não registrar senha, token, segredo, resposta de aluno, texto livre de ticket ou PII desnecessária.

Health checks devem cobrir Auth, Data API, banco, Storage, Edge Functions e jobs. Métricas mínimas: taxa de erro, latência p50/p95/p99, volume, saturação, falhas de sincronização, filas e duração de jobs. Alertas precisam apontar runbook e ambiente. Error tracking recebe mensagens sanitizadas e correlation ID; stack trace permanece restrito à equipe autorizada.

O changelog Supabase de 18/09/2026 adicionou health checks de Auth, Storage, Edge Functions e Data APIs aos Advisors. A adoção em staging deve ser validada antes de configurar alertas de produção.
