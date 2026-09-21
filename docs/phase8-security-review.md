# Revisão de segurança — Fase 8 Desktop

Data: 21/09/2026. Escopo: candidato de release em
`codex/fase8-finalizacao-desktop`; nenhum teste usa produção.

## Controles revisados

- RLS habilitada nos domínios operacionais; grants explícitos para `authenticated`.
- Funções administrativas usam `SECURITY DEFINER`, `search_path = ''` e validam
  permissão, rede e escola antes de ler ou gravar.
- Importação offline valida avaliação, tentativa, estudante, questão, escola,
  resposta, limite de lote e fingerprint dentro de uma única transação.
- Exportação LGPD exige solicitação autorizada e titular autenticado, exclui notas
  internas e não cria URL pública ou pacote persistente.
- Help Desk separa comentário público e nota interna; identidade/escopo do ticket
  são imutáveis e testes negativos cobrem outra escola.
- Impressão é montada no servidor a partir de versões congeladas; gabarito exige
  papel autorizado e o payload é isolado por escola.
- `service_role` não é usada no browser. Ela aparece apenas em seed/teste local ou
  CI descartável e nos exemplos de ambiente como variável server-only.
- Telemetria sanitiza segredos, PII e texto livre; correlation ID não concede acesso.
- Pages não publica em push: release exige execução manual explícita.

## Evidências e ferramentas

- `npm audit --audit-level=high`: **0 vulnerabilidades** em 21/09/2026.
- Banco vazio e migrations: executados no workflow do PR final.
- DB Advisors: resultado do HEAD final deve ser anexado ao artifact do workflow;
  `ERROR` falha o job, `WARN/INFO` são classificados e não “corrigidos” em massa.
- Testes conectados: isolamento de tenant/escola, notas internas, impressão,
  exclusão governada, exportação do titular e importação persistente.

## Riscos e dependências restantes

- Homologação humana com leitor de tela permanece pendente.
- Prazos de retenção, SLA e execução jurídica de anonimização são decisões externas.
- Segredos, rotação, domínio, WAF e alertas de produção dependem da infraestrutura
  do ambiente contratado; não foram alterados nesta execução.
- Nenhuma migration foi aplicada em produção e nenhum deploy foi realizado.
