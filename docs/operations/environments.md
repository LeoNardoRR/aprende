# Ambientes e configuração

| Ambiente | Finalidade | Dados | Deploy |
|---|---|---|---|
| local | desenvolvimento e migrations | sintéticos | máquina do desenvolvedor |
| staging | smoke, E2E, acessibilidade, visual e homologação | sintéticos versionados | pipeline aprovado |
| production | operação real | controlados pela instituição | fora do escopo de execução da Fase 8 |

As variáveis documentadas estão em `.env.example`. Variáveis `NEXT_PUBLIC_*` e `VITE_*` são públicas por definição e aceitam somente URL e chave publicável/anon. `SUPABASE_SERVICE_ROLE_KEY` e `DB_URL` são exclusivos de servidor/CI. A promoção usa artefato imutável identificado por SHA; não se recompila com código diferente por ambiente.
