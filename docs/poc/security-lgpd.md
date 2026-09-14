# Auditoria de segurança e LGPD da PoC

## Escopo técnico

- RLS e policies das Fases 1–5;
- grants de `anon` e `authenticated`;
- 131 ocorrências de funções `SECURITY DEFINER` no histórico, com foco em autorização interna, `search_path` e grants;
- Storage privado de imagens de itens e relatórios;
- tokens de avaliação, hash, revogação, expiração e bloqueio;
- isolamento entre redes, escolas, turmas e estudantes;
- exposição de segredos no frontend, logs, URLs e mensagens.

## Evidências existentes

- Nenhuma ocorrência de `service_role` foi encontrada em `app/`, `components/`, `lib/` ou `public/`.
- Funções analíticas revogam execução de `public` e `anon`; chamadas são liberadas apenas a `authenticated` e verificam o escopo no banco.
- O aluno não consegue ampliar `student_id`, consultar psicometria interna, criar job em lote ou ler a escala diretamente.
- Professor, gestor escolar e administrador são restringidos, respectivamente, por turma, escola e rede.
- Storage de imagens e relatórios permanece privado, com policies baseadas no escopo institucional.
- O seed e os testes administrativos recusam hosts remotos antes de usar `service_role`.

## Findings

| Nível | Finding | Situação |
|---|---|---|
| CRITICAL | Nenhum confirmado na auditoria estática, advisors ou `npm audit`. | Execução descartável verde. |
| HIGH | 8 vulnerabilidades npm, envolvendo `react-server-dom-webpack`, `vite`, `vinext/image-size` e transitivos de Cloudflare. | Atualizações existem, mas exigem rodada dedicada de regressão; não foi usado `--force`. |
| MEDIUM | 2 vulnerabilidades npm em cadeia Cloudflare/Undici. | Mesma decisão acima. |
| LOW | 1 vulnerabilidade npm transitiva em `esbuild`. | Afeta cenário de desenvolvimento Windows; atualização coordenada necessária. |
| INFO | Tabelas de escala de proficiência têm RLS sem policies diretas. | Intencional: acesso somente por RPC autorizada; manter como deny-by-default. |
| INFO | Índices GIN duplicados no banco de itens foram indicados pelo advisor local. | Não removidos sem plano comparativo; acompanhar como otimização. |

Na execução `34791691601`, os advisors terminaram sem `ERROR`. Foram 108
findings: 17 `WARN` de performance e 91 `INFO`. Os cinco findings da categoria
`SECURITY` são `INFO` de RLS habilitada sem policy direta em tabelas acessadas
por função autorizada ou deliberadamente fechadas. O relatório automático
separa esses cinco itens dos findings de performance.

## LGPD

O produto implementa segregação por tenant, controle de acesso, auditoria de operações, exclusão de conta e exportações escopadas. Permanecem dependências externas: base legal/finalidade documentada, política de retenção, atendimento completo de solicitações do titular, regras para dados de menores, controlador/operador, encarregado e política de privacidade homologada.

Essas decisões não podem ser inventadas pelo código. A matriz mantém o requisito como `PARCIAL` e P0 até a governança jurídica e administrativa ser definida e os fluxos operacionais correspondentes serem testados.

## Execução automatizada

O workflow da Fase 6 executa migrations do zero, testes negativos, Playwright, Deno, database advisors e `npm audit --audit-level=critical`. Logs e traces são preservados por sete dias como artifacts em toda execução.
