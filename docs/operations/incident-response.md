# Resposta a incidentes

## Fluxo

`detectar → classificar → conter → preservar evidência → corrigir → recuperar → revisar`

Severidade considera indisponibilidade, perda de integridade, exposição entre tenants e impacto a dados pessoais. Logs de incidente usam correlation ID e não copiam tokens, senhas ou PII desnecessária. A equipe técnica não decide sozinha comunicações legais.

## Evidência mínima

Horários em UTC, ambiente, versão, sintomas, escopo, decisões, responsáveis, comandos aprovados, resultado de validação e ações preventivas. Stack traces ficam restritos à telemetria autorizada e nunca aparecem para o usuário final.
