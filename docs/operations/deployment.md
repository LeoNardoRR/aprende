# Implantação

## Ambientes

- **local:** Supabase descartável, dados sintéticos e chaves locais;
- **staging:** migrations completas, smoke/E2E, homologação e demonstração;
- **production:** promoção explícita de artefato já validado. Esta fase não executa deploy em produção.

## Procedimento

1. Fixar SHA e registrar origem validada.
2. Executar `npm ci`, testes, lint, typecheck, builds, audit e validações da matriz.
3. Subir Supabase descartável e aplicar todas as migrations desde banco vazio.
4. Executar seed determinístico duas vezes e regressões de segurança/isolamento.
5. Promover migration em staging, executar smoke, acessibilidade, visual e impressão.
6. Produzir plano de rollback e janela aprovada antes de qualquer produção.
7. Validar health checks, erros, latência e operações críticas após o deploy.

Variáveis públicas do frontend nunca contêm `service_role`. Segredos são fornecidos pelo ambiente de execução e não entram em Git, logs ou bundles.
