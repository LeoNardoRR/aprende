# Política de release

## Estado da Fase 8 Desktop

Publicação não é consequência automática de merge ou push em `master`. O workflow
`Publish GitHub Pages` aceita somente execução manual (`workflow_dispatch`) para
separar validação técnica de decisão de release.

## Liberação explícita

Uma pessoa autorizada deve, após revisar o commit e o resultado dos workflows:

1. selecionar o SHA aprovado da `master`;
2. iniciar manualmente `Publish GitHub Pages` no GitHub Actions;
3. acompanhar build e deploy do ambiente `github-pages`;
4. registrar SHA, responsável, horário e resultado da liberação.

O workflow de validação da Fase 8 não publica, não aplica migrations em produção e
não autoriza release. Reativar publicação automática exige uma decisão de produto
e uma alteração revisada desta política e do workflow.
