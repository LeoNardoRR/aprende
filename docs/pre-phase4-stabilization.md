# Estabilização anterior à Fase 4

## Escopo e base

- Branch: `codex/estabiliza-pre-fase4`.
- Base: `master` no commit `4a96e2b19d029281f75f98f1e9b46f0061ecc37b`.
- Validação conectada: GitHub Actions `34747808200`, concluída com sucesso em um Supabase descartável.
- Produção: não foi acessada, alterada, migrada ou sincronizada.
- Fase 4: não foi implementada nesta estabilização. A migration histórica `20260912231327_add_assessment_runtime.sql` permanece vazia.

## Auditoria e causas das falhas

| Falha observada | Classificação | Causa raiz | Correção |
|---|---|---|---|
| Upload em `assessment-item-images` retornava PostgreSQL `42702` | Migration/RLS | `private.can_use_item_image` declarava variáveis `item_id` e `network_id` com os mesmos nomes de colunas consultadas. As referências não qualificadas ficavam ambíguas. | A função foi recriada com variáveis `v_item_id` e `v_network_id`, tabelas e colunas qualificadas, `search_path = ''` e grant restrito a `authenticated`. As policies também passaram a qualificar `storage.objects`. |
| `snapshot.image_paths` não continha a imagem | Efeito em cascata e robustez de migration | O upload anterior falhava antes de `set_item_images`, portanto a imagem nunca era vinculada ao item. Além disso, a função de snapshot havia sido criada antes das colunas editoriais posteriores e dependia de serialização implícita da linha. | O teste agora exige o vínculo antes da aprovação e verifica o snapshot completo. `private.item_snapshot` foi recriada explicitamente depois de `image_paths` e `formula`, congelando campos pedagógicos e alternativas. |
| Cenário de 1.500 itens contava `1501` em vez de `1502` | Efeito em cascata nos dados de teste | A asserção do snapshot interrompia a criação da revisão. O cenário pretendido contém o item aprovado, sua revisão em rascunho e 1.500 itens DEMO, totalizando `1502`. | A causa anterior foi corrigida. O teste preserva a expectativa `1502`, confirma os dois registros antes da carga e percorre todas as páginas para provar ausência de duplicados e perdas. |

As migrations históricas foram examinadas e preservadas. A correção é aditiva em `20260913080728_stabilize_item_storage_and_snapshots.sql`.

## Segurança e testes reforçados

- Bucket `assessment-item-images` privado, limite de 5 MiB e MIME restrito a PNG, JPEG e WebP.
- Caminho obrigatório `network_id/item_id/arquivo`, validado no backend.
- Leitura negada a outra rede, aluno e usuário anônimo.
- Escrita negada a aluno, outra rede, caminho cruzado, SVG e arquivo acima do limite.
- Remoção bloqueada enquanto uma versão imutável referencia a imagem.
- Snapshot aprovado verifica enunciado, fórmula, imagens, quatro alternativas, uma correta e análise de todos os distratores; uma nova revisão não altera a versão aprovada.
- Paginação verifica primeira, intermediária e última página, total exato e todos os 1.500 IDs únicos.
- Convite institucional é exercitado pela Edge Function: anônimo recebe `401`, gestor cria o convite, e o ciclo de aceitação, revogação, expiração, desativação e reativação permanece coberto.
- O frontend é verificado para impedir presença de credencial `service_role`.

O conjunto conectado cobre as operações autorizadas e negadas das Fases 1 e 2, inclusive papéis institucionais, escopo de rede/escola, diretório, importação CREATE/UPDATE/SKIP, conflitos, idempotência, promoção e histórico de matrícula. A Fase 3 continua coberta para ciclos, avaliações, até cinco cadernos, itens aprovados e versões congeladas, reorder, remoção, pontos, mapa deduplicado, calendário, turmas e alunos programados e isolamento institucional.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm ci` | Verde |
| `npx supabase start` | Verde no runner descartável |
| `npx supabase db reset --local` | Verde; todas as migrations aplicadas desde zero |
| `npx supabase migration list --local` | Verde; histórico local sincronizado até `20260913080728` |
| `npx supabase db push --dry-run --local` | Verde; `Local database is up to date` |
| `npm test` | 60 testes, 60 passaram, 0 falharam, 0 ignorados |
| `npm run lint` | Verde |
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm run build:pages` | Verde |
| `deno check supabase/functions/institutional-invite/index.ts` | Verde |
| Supabase database advisors | Executados para segurança e desempenho; nenhum erro |

A máquina macOS usada no desenvolvimento não possui Docker nem Podman. Por isso os seis testes conectados ficam ignorados quando `npm test` roda diretamente nela. O workflow obrigatório executou os mesmos testes com todas as variáveis locais e registrou `60/60`, sem skips. Essa limitação local não levou a nenhum acesso remoto: o banco usado no CI foi criado e descartado pelo Supabase CLI no próprio runner.

## Advisors

O advisor de segurança e desempenho terminou sem erros. A dívida histórica ainda reporta avisos/informações, principalmente 60 chaves estrangeiras sem índice, 14 combinações de policies permissivas, 2 usos de `auth.uid()` sem initplan, 7 índices ainda não utilizados, 1 índice duplicado e 1 tabela com RLS sem policy. A migration desta estabilização não cria tabelas ou FKs e não acrescentou nenhuma dessas ocorrências. A dívida deve ser tratada separadamente, com medição de consultas e sem remover policies legítimas apenas para silenciar o linter.

## Auditoria de dependências

`npm audit` reporta 11 vulnerabilidades: 1 baixa, 2 moderadas, 8 altas e 0 críticas.

| Pacote | Relação | Severidade | Impacto provável e atualização indicada |
|---|---|---|---|
| `@cloudflare/vite-plugin` | Direta | Moderada | Agrega `miniflare`, `wrangler` e `ws`; correção sugerida em `1.54.8`, fora da faixa atual. |
| `esbuild` | Transitiva | Baixa | Leitura de arquivo pelo servidor de desenvolvimento no Windows; atualização vem pela pilha Cloudflare. |
| `image-size` | Transitiva de `vinext` | Alta | DoS nos parsers ICNS/JXL/HEIF; requer `vinext@1.0.0-beta.9`. |
| `miniflare` | Transitiva | Alta | Agrega vulnerabilidades de `sharp`, `undici` e `ws`; atualização vem pela pilha Cloudflare. |
| `react-server-dom-webpack` | Direta | Alta | DoS em Server Functions; correção sugerida em `19.3.0`, fora da faixa atual. |
| `sharp` | Transitiva | Alta | Falhas herdadas de libvips/libheif; atualização vem pela pilha Cloudflare. |
| `undici` | Transitiva | Alta | Falhas de proxy, cookies, cache, WebSocket e parsing; atualização vem pela pilha Cloudflare. |
| `vinext` | Direta | Alta | Herdada de `image-size`; correção sugerida em `1.0.0-beta.9`. |
| `vite` | Direta | Alta | Bypass de `server.fs.deny` e risco de caminho UNC no Windows; correção sugerida em `8.3.0`. |
| `wrangler` | Direta | Moderada | Herdada de `esbuild` e `miniflare`; atualização coordenada com Cloudflare. |
| `ws` | Transitiva | Alta | Divulgação de memória e DoS; atualização vem pela pilha Cloudflare. |

As atualizações sugeridas atravessam faixas declaradas e combinam Vinext, React Server Components, Vite e o adaptador Cloudflare. Elas não foram aplicadas nesta estabilização porque exigem uma rodada própria de compatibilidade e publicação. `npm audit fix --force` não foi executado.

## Riscos restantes

- Avisos históricos de desempenho/RLS listados pelos advisors.
- Dependências com vulnerabilidades altas sem correção segura dentro das faixas atuais.
- Conteúdo pedagógico oficial e carga representativa de 12.849 alunos/33 escolas continuam como dependências externas; os 1.500 itens usados são claramente DEMO e existem somente no teste.
- O runtime de avaliações pertence à Fase 4 e permanece pendente.

Nenhuma alteração foi aplicada ao Supabase de produção, nenhuma migration remota foi executada e nenhum deploy de produção foi realizado.
