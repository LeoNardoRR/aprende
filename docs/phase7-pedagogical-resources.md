# Fase 7 — Recursos pedagógicos e recomposição

## Escopo implementado

A Fase 7 adiciona uma base real para recursos pedagógicos versionados, jornadas, atribuição por turma, progresso do estudante, portfólio, recomendações explicáveis, fluência assistida, agrupamentos de equidade e sugestões assistivas com revisão humana.

O frontend usa RPCs e dados persistidos. A pontuação pedagógica permanece separada dos pontos de participação, e o seed é sintético e identificado como DEMO.

## Segurança

Todas as tabelas públicas da fase usam RLS. O papel `anon` não recebe acesso às tabelas nem às RPCs. Usuários autenticados recebem somente leitura direta protegida por policy; as escritas são feitas por funções `SECURITY DEFINER` com `search_path` vazio e verificação de rede, escola, turma, estudante ou permissão institucional.

Os buckets `pedagogical-resources` e `reading-fluency-audio` são privados. O caminho inicia pelo identificador da rede e as policies repetem a autorização no banco.

## Recomposição e portfólio

Uma jornada publicada possui etapas ordenadas, recursos opcionais, avaliação opcional, limiar de domínio, pontos pedagógicos e pontos de participação. A atribuição gera registros individuais e o progresso é idempotente por chave de requisição. O portfólio consolida jornadas, evidências, avaliações e fluência no escopo autorizado.

O relatório pedagógico PDF, DOCX ou CSV usa o mesmo payload da RPC do painel. A evolução é descrita como observada e não como causalidade da intervenção.

## Fluência

O cálculo implementado é:

`palavras corretas por minuto = (palavras lidas - erros) × 60 / segundos`

Tempo inválido retorna indisponível. A classificação é armazenada junto da sessão e deve usar uma rubrica homologada pela rede. A entrega atual é assistida pelo professor; reconhecimento automático de voz, modo autônomo completo e painéis consolidados ainda são gaps.

## Equidade e VAAR

Os grupos são configuráveis e usam limite mínimo para suprimir agregados pequenos. O resultado é explicitamente rotulado como evolução observada e não implementa a fórmula oficial do VAAR. Dados socioeconômicos, índice ponderado, decomposição do gap, risco, qualidade cadastral e relatórios próprios dependem de desenho metodológico e LGPD.

## Inteligência artificial

A tabela de sugestões registra prompt estruturado, conteúdo gerado, provedor, modelo, solicitante, decisão e revisão. Campos comuns de PII são recusados e apenas revisor autorizado pode aprovar ou rejeitar. Ainda não há chamada real a um provedor de IA; portanto, o assistente permanece parcial.

## Validação

- `npm run test:phase7`: fórmulas, progresso, supressão, autorização, idempotência e revisão humana;
- `tests/e2e/phase7-pedagogy.spec.ts`: analytics → jornada → aluno → progresso → professor;
- `.github/workflows/phase7-pedagogical-validation.yml`: Supabase descartável, migrations do zero, seeds repetidos, regressão, PoC, E2E, Deno, lint, tipos, builds, advisors e audit.

O ambiente local atual não possui Docker. A validação conectada e as migrations devem ser comprovadas pelo GitHub Actions descartável antes de qualquer declaração de conclusão.

## Riscos medidos e limites

`npm audit` encontrou 11 vulnerabilidades nas dependências atuais: 1 low, 2 moderate e 8 high, sem critical. Entre as dependências diretas afetadas estão `vinext`, `vite`, `react-server-dom-webpack`, `@cloudflare/vite-plugin` e `wrangler`; `image-size`, `miniflare`, `sharp`, `undici`, `ws` e `esbuild` são transitivas. Atualizações exigem nova regressão das Fases 1–7; não foi aplicado `npm audit fix --force`.

O seed da Fase 7 valida o fluxo funcional com dados sintéticos, mas ainda não mede catálogo, atribuições e relatórios com 12.849 estudantes. Portanto, a capacidade nessa escala permanece sem comprovação específica da Fase 7. O banco usa busca paginada e índices de escopo, mas a RPC de relatório devolve o conjunto autorizado em uma resposta; relatórios institucionais extensos precisarão de paginação ou processamento assíncrono.
