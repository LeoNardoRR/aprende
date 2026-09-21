# Decisão técnica — Help Desk

## Decisão

Adotar implementação interna mínima e isolada no Aprendê, porque o atendimento precisa reutilizar identidade, escopo institucional, RLS e auditoria já existentes. Uma integração externa permanece possível no futuro por adaptador, após avaliação contratual e de proteção de dados.

## Escopo mínimo

Ticket, solicitante, prioridade, status, tipo, departamento, responsável, descrição, comentários públicos, notas internas, histórico e timestamps. Solicitantes veem seus tickets; agentes veem filas permitidas ou atribuídas; gestores veem o escopo operacional autorizado; administradores configuram categorias. Comentário público e nota interna são entidades e permissões distintas.

## Critérios de segurança

RLS por usuário e escopo, RPCs protegidas para transições, grants explícitos, testes negativos entre tenants, anexos privados e auditoria sem corpo textual desnecessário. A implementação não deve transformar `TO authenticated` em autorização genérica.

## SLA e operação

Prioridade e status são dados operacionais; prazo de primeira resposta ou solução
não é codificado como promessa contratual. Metas de atendimento devem ser
configuradas e aprovadas pelo responsável do contrato antes da produção. Até lá,
painéis podem medir tempos observados, mas não exibir um “SLA oficial”.

## Estado

Banco, RLS, interface Desktop, histórico, notas internas, filtros, paginação e
testes conectados de isolamento existem. Anexos e integração com fornecedor
externo não fazem parte do mínimo interno atual. A operação contratual e seus SLAs
continuam como dependência externa.
