# Fase 8 — prontidão Web Desktop

- Base validada: `96a5c0a96630065fb378f06298e03c57e390d4da`.
- Workflow de origem: Validate Phase 7 pedagogy, run `35528069028`, conclusão `success`.
- Branch: `codex/fase8-produto-final-desktop`.
- Plataforma: Web Desktop, breakpoint operacional mínimo de 1024 px.
- Mobile, Android e iOS permanecem fora do escopo e não atendidos.

## Baseline local em 20/09/2026

`npm ci`, 62 testes unitários, typecheck, build Vinext, build GitHub Pages e `npm audit` passaram. Oito integrações exigem Supabase local descartável e não foram contadas como executadas. O bundle Pages principal mede aproximadamente 1.026 kB antes de gzip e requer code splitting; existem avisos do minificador para diretivas CSS do ecossistema Tailwind. Portanto performance e regressão completa não estão concluídas nesta evidência local.
