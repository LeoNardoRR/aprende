# Retenção e anonimização

Esta política técnica complementa `data-retention.md`. Os prazos jurídicos e
institucionais continuam **A DEFINIR** pelo controlador antes da produção.

- Solicitar exclusão não apaga automaticamente matrícula, frequência, avaliação,
  resultado, auditoria ou outros registros acadêmicos.
- A execução deve separar desativação de acesso, anonimização tecnicamente
  irreversível, retenção obrigatória e expurgo autorizado.
- `legal hold` e retenção dependem de decisão registrada; o sistema não presume
  base legal nem prazo.
- Pseudonimização não é registrada como anonimização.
- Jobs futuros de expurgo precisam ser idempotentes, auditados e ensaiados em
  staging com dados sintéticos antes de qualquer habilitação em produção.

A Fase 8 entrega solicitação governada e estados auditáveis. A decisão de quais
campos podem ser anonimizados e quando continua como dependência externa jurídica.
