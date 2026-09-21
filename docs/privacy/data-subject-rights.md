# Direitos do titular — operação técnica

## Fluxo

Toda solicitação percorre `Solicitada → Em validação → Autorizada/Rejeitada → Em
execução → Concluída`. Estados finais não podem ser reabertos. Identidade, tipo,
escopo e correlação da solicitação são imutáveis.

## Exportação

Após autorização, somente o titular autenticado pode gerar o pacote JSON. O pacote
é produzido na transação, entregue diretamente ao navegador e não recebe URL
pública nem armazenamento permanente. Contém dados do próprio titular e exclui
tokens, segredos e notas internas do Help Desk. A entrega conclui a solicitação e
grava evento de auditoria sem copiar o conteúdo exportado para logs.

## Correção

A solicitação descreve o dado contestado. A equipe valida a identidade e o escopo,
mas o titular não recebe uma operação genérica de escrita: notas, avaliações,
frequência, auditoria e histórico institucional permanecem protegidos. A correção
deve usar o fluxo proprietário do domínio e preservar rastreabilidade.

## Exclusão

A exclusão direta de conta está desativada. A solicitação exige confirmação e é
idempotente. Execução e anonimização dependem da política de retenção aprovada;
registros acadêmicos não são apagados em cascata por este fluxo.

## Dependência jurídica

Prazos, base legal, retenção e comunicação formal permanecem **A DEFINIR** pelo
controlador. Nenhum prazo legal é inferido pelo software.
