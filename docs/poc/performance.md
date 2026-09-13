# Performance da PoC

## Baseline confirmado da Fase 5

- Volume: 12.849 tentativas sintéticas.
- Ambiente: GitHub Actions, Supabase local descartável.
- Operação: agregação `get_analytics_dashboard` com página 65 e 200 registros.
- Tempo observado no HEAD base: 7.269 ms.
- Limite automatizado: 12.000 ms.

Esse teste prova volume de agregação analítica. Ele não prova 12.849 logins concorrentes. O seed da Fase 6 cadastra 33 escolas sintéticas, mantém 3 escolas ativas no roteiro e mede o dashboard em 12 amostras para registrar p50, p95 e pior caso sem converter o resultado em garantia de produção.

## Critérios

- usar paginação no servidor;
- registrar volume, ambiente e parâmetros;
- executar `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` apenas no banco local;
- investigar scans sequenciais em tabelas de alto volume;
- evitar índice sem hipótese e plano comparável;
- não incluir tempo de criação do dataset na latência da consulta;
- registrar p50, p95 e máximo de múltiplas amostras.

## Resultado da Fase 6

Preenchido automaticamente em `artifacts/poc/poc-validation-report.md` após a suíte conectada. Até a nova medição ser executada, o único número confirmado é o baseline acima.
