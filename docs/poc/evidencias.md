# Evidências da PoC

## Organização

Artefatos de execução são gerados em `artifacts/poc/` e não são versionados. A árvore esperada é:

```text
artifacts/poc/
  auth/ usuarios/ itens/ avaliacao/ aplicacao/
  analytics/ relatorios/ security/
  poc-validation-report.json
  poc-validation-report.md
```

Playwright grava screenshot, trace e vídeo apenas quando configurados pelo cenário/CI. Logs de Supabase, screenshot do Control Center, plano `EXPLAIN ANALYZE`, totais de testes, advisors, audit e relatórios são enviados como artifact do GitHub Actions em toda execução, inclusive quando há falha. Nenhum segredo, JWT, resposta pessoal ou dado real deve constar nesses arquivos.

A execução de referência `34791691601` produziu o artifact
`phase6-poc-evidence` com 101/101 testes verdes e nenhum skip: 95 regressões,
4 cenários PoC e 2 E2E.

## Cadeias demonstráveis

| Cadeia | Evidência automatizada |
|---|---|
| Rede → escola → turma → aluno | `tests/phase1-integration.test.mjs` |
| Currículo → habilidade → item aprovado | `tests/phase2-integration.test.mjs` |
| Item → avaliação → caderno → agendamento | `tests/phase3-finalization.integration.test.mjs` |
| Token → tentativa → offline → sincronização → finalização | `tests/phase4-integration.test.mjs`, `tests/e2e/phase4-runtime.spec.ts` |
| Resultado → analytics → proficiência → relatório | `tests/phase5-integration.test.mjs` |
| Matriz sem inflação de status | `tests/poc/matrix.test.mjs` |

## Segurança

`tests/security-regression.test.mjs` e as suítes conectadas exercitam escopos no banco. A Fase 5 também testa chamada direta de RPC, tabela de proficiência, job de relatório e manipulação de `student_id` entre tenants. Advisors locais devem ser anexados ao relatório da execução.

As chaves administrativas são usadas somente por scripts/testes que recusam hosts remotos. O frontend usa apenas a chave pública e nunca recebe `service_role`.
