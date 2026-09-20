# Auditoria de UX Desktop

## Evidências atuais

A gestão usa shell consistente com sidebar, cabeçalho e conteúdo; Banco de Itens, Avaliações, Analytics e Recomposição preservam seus fluxos. A revisão visual da Fase 7 corrigiu cartões sem estilo, paginações soltas, overflow em formulários de acesso e a transferência entre Analytics e Recomposição.

## Prioridades da Fase 8

1. Aplicar tokens compartilhados sem reconstruir as telas.
2. Manter navegação por papel e reduzir ruído na visão inicial.
3. Padronizar estados, paginações, uploads, filtros e ações de tabela.
4. Acrescentar impressão, privacidade operacional e suporte dentro do shell institucional.
5. Validar teclado, zoom e resoluções Desktop; mobile permanece fora do escopo.

## Riscos conhecidos

- O CSS histórico ainda contém valores anteriores aos tokens; a migração será progressiva para evitar regressões.
- Tabelas densas devem manter rolagem contida em 1024 px.
- Conteúdo oficial e decisões jurídicas não podem ser resolvidos por redesign.
- Teste automático de acessibilidade não substitui homologação com leitor de tela.
