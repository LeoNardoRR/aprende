# Fase 7 — medição de escala

O comando `npm run phase7:performance` aceita somente URLs de API e PostgreSQL em `localhost`/`127.0.0.1`. Ele é executado após as regressões e o E2E, sobre Supabase local descartável, com o seed PoC/Fase 7 sintético. Não usa dados reais nem toca produção.

## Dataset e método

- 12.849 identidades de estudantes sintéticos, distribuídas em 33 escolas, com matrícula e vínculo institucional;
- 33 turmas adicionais, 33 atribuições de jornada, 12.849 registros de progresso e recomendações;
- 1.500 jornadas sintéticas de uma etapa somente para medir busca/paginação. Nenhuma delas conta como acervo pedagógico real ou requisito da licitação atendido;
- catálogo: primeira, página intermediária, última e varredura das 63 páginas de 24 itens, verificando total, duplicados e perdas;
- dashboard, relatório, portfólio e recomendações: cinco amostras por cenário após carga. O relatório registra p50, p95 e máximo observados no runner, sem prometer SLA de produção;
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` em agregação de atribuições e recomendações. O plano bruto vai em `artifacts/poc/phase7-explain.txt` e as durações em `artifacts/poc/phase7-performance-report.json`.

O teste não simula 12.849 logins simultâneos nem transferência real de arquivos. As identidades de escala não têm senha de demonstração; apenas os usuários sintéticos existentes entram pelo Supabase local. O benchmark roda depois das demais suítes para não mudar suas contagens.

## Resultado observado

O [Actions 35524328480](https://github.com/LeoNardoRR/aprende/actions/runs/35524328480) executou o benchmark em 20/09/2026 e terminou verde. O artifact `phase7-performance-report.json` registrou `status: passed`, 12.849 estudantes, 33 escolas e 1.500 jornadas sintéticas; a criação do dataset levou 4.597,4 ms. As 63 páginas do catálogo foram percorridas sem duplicação ou perda.

| Cenário | Amostras | p50 | p95 / pior caso |
|---|---:|---:|---:|
| Catálogo (primeira, intermediária e última página) | 3 | 14,7 ms | 45,0 ms |
| Dashboard pedagógico da rede | 5 | 675,4 ms | 702,7 ms |
| Relatório institucional da rede | 5 | 960,2 ms | 1.010,0 ms |
| Portfólio do aluno sob carga | 5 | 8,2 ms | 25,5 ms |
| Contagem protegida de recomendações | 5 | 544,3 ms | 552,3 ms |

Os dois `EXPLAIN ANALYZE` mediram 11,554 ms para agregar as 12.849 atribuições e 4,651 ms para agregar recomendações. Houve varredura sequencial de 12.853 linhas de progresso e 12.849 recomendações. Para agregações completas dessa rede isso é esperado; não há evidência neste plano de que adicionar índice ao acaso melhore essas consultas. A diferença entre o tempo SQL e o tempo das RPCs inclui RLS, construção/transferência de JSON e HTTP. O benchmark não mede concorrência nem geração simultânea de PDFs.

## Interpretação

O relatório institucional atual agrega e devolve todas as atribuições autorizadas em uma única resposta. Mesmo com RPC abaixo de 1,1 s nesta amostra, exportar milhares de linhas sincronicamente no navegador pode consumir muita memória; paginação/geração assíncrona continuam necessárias antes de afirmar escala operacional completa dos relatórios. Esses tempos são da execução anterior às últimas correções editoriais e aos upgrades de dependências; a validação final deve repetir o benchmark no HEAD da PR.
