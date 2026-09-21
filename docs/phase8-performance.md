# Performance — Fase 8 Desktop

## Ambiente e método

O workflow da PR executa `npm run phase7:performance` em Ubuntu/GitHub Actions,
Supabase local descartável e dados sintéticos. O dataset contém 12.849 estudantes,
33 escolas, 1.500 jornadas e mede catálogo, dashboard, relatório institucional,
portfólio e recomendações com cinco amostras (quando aplicável), registrando p50,
p95 e máximo. Não há dados pessoais reais nem conexão de produção.

O teste **não** representa 12.849 usuários simultâneos. Ele mede volume de dados e
latência sequencial no runner compartilhado. Importação e exportação LGPD possuem
testes funcionais; ainda não constituem benchmark de concorrência.

## Baseline comparável

O run 35524328480 da Fase 7 registrou: catálogo p50 14,7 ms/p95 45,0 ms;
dashboard p50 675,4 ms/p95 702,7 ms; relatório p50 960,2 ms/p95 1.010,0 ms;
portfólio p50 8,2 ms/p95 25,5 ms; recomendações p50 544,3 ms/p95 552,3 ms.

## Resultado do candidato final

O primeiro run do PR final aplicou migrations e seed, mas a regressão de carga
legada `get_analytics_dashboard` atingiu o `statement_timeout` antes da etapa de
benchmark. O novo HEAD deve repetir a medição; até um run verde, não se reutiliza o
baseline como resultado final nem se declara ausência de regressão.

## Bundle e decisões

Rotas secundárias de aluno e módulos institucionais pesados usam lazy loading onde
seguro. O build ainda informa chunks acima de 500 kB; isso permanece risco P1, não
erro ocultado. Otimizações futuras devem preservar UX e evitar mover analytics do
PostgreSQL para o navegador.
