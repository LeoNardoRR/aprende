# LGPD operacional — Aprendê

Este documento descreve controles técnicos e operacionais, sem substituir avaliação jurídica. O tratamento de dados de crianças e adolescentes exige definição formal do controlador, bases legais, responsáveis e prazos antes da produção.

## Ciclo de solicitações do titular

1. **Request:** registrar tipo, escopo, titular, canal, data e identificador de correlação; nunca registrar documento completo em logs técnicos.
2. **Validation:** confirmar identidade por sessão autenticada ou procedimento institucional aprovado.
3. **Authorization:** determinar quais dados podem ser corrigidos, exportados, anonimizados ou precisam ser retidos.
4. **Execution:** gerar exportação estruturada, aplicar correção ou executar anonimização aprovada de forma idempotente.
5. **Audit:** registrar ator, ação, recurso, escopo, horário, resultado e correlação, sem senha, token, segredo ou PII desnecessária.

## Exclusão de conta

O fluxo existente de exclusão deve ser tratado como solicitação, não como autorização para eliminar automaticamente registros acadêmicos. A conta de acesso pode ser desativada após reautenticação; matrículas, avaliações, frequência e demais registros sujeitos a retenção seguem a política institucional. Toda execução deve produzir recibo auditável e permitir investigação de falha.

## Termos e privacidade

- versões são imutáveis e identificadas por versão, data de vigência e hash do conteúdo;
- o aceite registra usuário, versão, horário, contexto e resultado;
- nova versão material exige novo aceite conforme decisão jurídica;
- recusa ou ausência de aceite não deve ser convertida silenciosamente em consentimento;
- dados de menores não são usados para marketing, perfilamento externo ou treinamento de IA por padrão.

## Exportação, correção e anonimização

Exportações são geradas sob demanda depois da autorização. O pacote estruturado é entregue diretamente ao titular autenticado, sem URL pública ou cópia persistente que exija expiração, e a entrega é auditada. Correções preservam histórico quando o dado acadêmico exigir rastreabilidade. Anonimização só é declarada quando irreversibilidade e impacto relacional forem verificados; pseudonimização não é anonimização. Os detalhes operacionais estão em `data-subject-rights.md` e `retention-policy.md`.

## Incidentes

Incidentes seguem `docs/operations/incident-response.md`. A decisão sobre comunicação à ANPD ou aos titulares pertence aos responsáveis jurídicos e de segurança designados.
