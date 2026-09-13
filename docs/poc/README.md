# Fase 6 — consolidação e preparação da PoC

Esta pasta transforma os requisitos demonstráveis do Pregão Eletrônico nº 40/2026 em uma trilha auditável. A fonte única de classificação é [`matriz-conformidade.json`](matriz-conformidade.json); a versão Markdown e o Control Center são derivados dela.

## Base registrada

- Branch base: `codex/fase5-analytics-relatorios`
- Commit base: `89b336ab3dc89af02323ff5f8635beae3b869550`
- Branch da Fase 6: `codex/fase6-poc-licitacao`
- Data: 13/09/2026
- Dependência: a PR da Fase 5 ainda estava aberta quando esta branch foi criada.

## Como validar

```bash
npm run poc:matrix
npm run test:poc
npm run poc:smoke
npm run poc:report
```

`seed:poc` recusa qualquer URL que não seja `localhost` ou `127.0.0.1`. Os dados usam domínio `.invalid`, nomes DEMO e uma senha local substituível por variável de ambiente.

## Regra de classificação

- **ATENDIDO:** implementação funcional, rota demonstrável, segurança, evidência e teste.
- **PARCIAL:** existe parte funcional, mas ao menos uma condição integral não está provada.
- **NÃO ATENDIDO:** o domínio ou o fluxo exigido não existe.
- **NÃO APLICÁVEL:** o requisito não se aplica, com justificativa.
- **DEPENDÊNCIA EXTERNA:** depende de conteúdo, decisão jurídica, infraestrutura ou operação fora do repositório.

A conformidade ponderada atribui 1 ponto a `ATENDIDO`, 0,5 a `PARCIAL` e 0 a `NÃO ATENDIDO`. Dependências externas e itens não aplicáveis ficam fora do denominador. Essa métrica mede o produto atual; o percentual de conclusão da Fase 6 mede a execução desta auditoria e não altera a conformidade.

## Documentos

- [Matriz legível](matriz-conformidade.md)
- [Gaps priorizados](gaps.md)
- [Roteiro oficial](roteiro-demonstracao.md)
- [Evidências](evidencias.md)
- [Checklist pré-PoC](checklist-pre-poc.md)
- [Performance](performance.md)
- [Segurança e LGPD](security-lgpd.md)

Produção não foi alterada.
