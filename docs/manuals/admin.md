# Manual do administrador

## Objetivo e acesso

Opere ambientes, papéis, segurança, observabilidade e continuidade pelo menor
privilégio. Use conta individual; credenciais técnicas ficam apenas no servidor/CI.

## Operação

- **Ambientes:** separe local, staging e produção; migrations são aditivas.
- **Acesso:** revise RLS, grants e `SECURITY DEFINER`; não exponha `service_role`.
- **Release:** merge não publica. GitHub Pages exige execução manual registrada.
- **Observabilidade:** investigue por correlation ID; logs não recebem senha, token,
  resposta integral ou PII desnecessária.
- **Backup/restore:** use ambiente descartável e valide schema, dados e smoke.
- **Incidente:** contenha, preserve evidência e siga o runbook; comunicação cabe aos
  responsáveis designados.
- **Privacidade:** acompanhe estados sem editar identidade ou escopo.

## Erros, permissões e limitações

Não desative RLS para resolver erro. Classifique advisors antes de criar índices.
Não use `npm audit fix --force`. Produção, prazos jurídicos, SLA e fornecedores
exigem autorização externa. Consulte `docs/operations/` e escale com correlation ID.
