# Aprendê — Fechamento da Fase 3

Esta entrega fecha as lacunas funcionais identificadas na auditoria da Fase 3 sem antecipar o domínio de tentativas da Fase 4.

## Entregue

- seletor de itens aprovados compatíveis com currículo, componente e série da avaliação;
- montagem real de cadernos A–E;
- reordenação transacional de itens;
- remoção segura com compactação das posições;
- mapa curricular real por habilidade, unidade temática, objeto, dificuldade, itens, pontos e percentual;
- correção do mapa para não multiplicar a mesma questão quando ela aparece em mais de um caderno apenas reordenada;
- calendário funcional em Mês, Semana e Dia, com navegação entre períodos;
- listagem de escolas, turmas e alunos programados para a aplicação;
- separação explícita entre “programado” da Fase 3 e estados de tentativa da Fase 4;
- teste de integração local para candidatos, montagem, reorder, remoção, blueprint e alunos programados.

## Mantido para a Fase 4

Não foram falsamente implementados nesta rodada:

- token individual de prova;
- `assessment_attempts`;
- autosave de respostas;
- retomada de prova;
- cronômetro de tentativa;
- randomização persistida por estudante;
- submissão idempotente;
- correção e status “em andamento/concluído” de tentativas;
- reaplicação.

## Segurança

As novas mutações do caderno só são aceitas enquanto a avaliação está em `draft` e passam por `private.can_manage_diagnostic_assessment`.

A listagem de alunos programados usa função `security definer`, mas filtra explicitamente o escopo com `private.has_permission('assessment.apply', network_id, school_id)`.

Nenhuma alteração desta entrega deve ser executada diretamente no Supabase de produção sem passar pelo fluxo de staging/backup/revisão já adotado no projeto.

## Validação esperada

Após aplicar os arquivos, executar:

```bash
npm test
npm run lint
npm run typecheck
npm run build:pages
```

Em ambiente local com Supabase:

```bash
npx supabase start
npx supabase db reset --local
npx supabase migration list --local
npx supabase db push --dry-run --local
```

## Integração do pacote no repositório

- Base: `codex/poc-phase-1`, commit `9a2b0011502a03b28475b9348108ef444c94f8e9`.
- Branch de entrega: `codex/finaliza-fase-3`.
- O CSS do pacote também é importado por `pages/main.tsx`, entrada do build estático.
- A coluna de retorno `"position"` da função de listagem de itens usa aspas para
  evitar o erro de sintaxe PostgreSQL `42601` encontrado no SQL original do ZIP.
- O workflow `Validate Phase 3` executa todos os testes com Supabase local em um
  runner descartável, além de lint, TypeScript, os dois builds e security advisors.
  Esse workflow não contém deploy nem usa credenciais de produção.
- Os testes de integração são ignorados por `npm test` quando não há Supabase
  local configurado; a execução completa deve apresentar zero testes ignorados.
- Nenhuma migração remota ou publicação faz parte desta entrega.
