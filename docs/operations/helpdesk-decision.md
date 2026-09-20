# Decisão técnica — Help Desk

## Decisão

Adotar implementação interna mínima e isolada no Aprendê, porque o atendimento precisa reutilizar identidade, escopo institucional, RLS e auditoria já existentes. Uma integração externa permanece possível no futuro por adaptador, após avaliação contratual e de proteção de dados.

## Escopo mínimo

Ticket, solicitante, prioridade, status, tipo, departamento, responsável, descrição, comentários públicos, notas internas, histórico e timestamps. Solicitantes veem seus tickets; agentes veem filas permitidas ou atribuídas; gestores veem o escopo operacional autorizado; administradores configuram categorias. Comentário público e nota interna são entidades e permissões distintas.

## Critérios de segurança

RLS por usuário e escopo, RPCs protegidas para transições, grants explícitos, testes negativos entre tenants, anexos privados e auditoria sem corpo textual desnecessário. A implementação não deve transformar `TO authenticated` em autorização genérica.

## Estado

Decisão registrada; implementação de banco, interface e testes conectados ainda é requisito de fechamento e não deve ser marcada como atendida antes das quatro evidências: implementação, teste, evidência e demonstração.
