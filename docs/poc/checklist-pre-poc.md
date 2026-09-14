# Checklist pré-PoC

## Ambiente

- [ ] Confirmar branch e commit exibidos no Control Center.
- [ ] Subir Supabase local limpo e aplicar todas as migrations.
- [ ] Executar `npm run seed:poc` e guardar somente credenciais DEMO locais.
- [ ] Executar `npm run poc:smoke` imediatamente antes da sessão.
- [ ] Confirmar serviços, browser Chromium atualizado e resolução 1440×900.
- [ ] Confirmar internet; manter plano B local sem dependências externas.
- [ ] Confirmar espaço em disco para traces, relatórios e logs.

## Dados e acessos

- [ ] Rede, 3 escolas, 3 séries e 6 turmas aparecem.
- [ ] Admin, gestores, professores, revisor, aprovador e alunos sintéticos autenticam.
- [ ] Avaliação, caderno, ciclo, agendamento e token DEMO existem.
- [ ] Tentativas/resultados/proficiência aparecem no analytics.
- [ ] Senhas DEMO são locais, temporárias e não estão em URL, screenshot ou log.
- [ ] Nenhum dado real de aluno está presente.

## Demonstração

- [ ] PDF, DOCX, CSV e lote ZIP foram gerados antes da sessão.
- [ ] Offline/reconexão foi ensaiado com DevTools e IndexedDB.
- [ ] Perfis e rotas de cada cenário estão prontos em abas separadas.
- [ ] Screenshots/traces usam apenas dados DEMO.
- [ ] Backups são somente do ambiente local descartável.

## Contingência

- [ ] Manter roteiro impresso/PDF com resultado esperado.
- [ ] Manter relatório de validação e evidências locais.
- [ ] Se um serviço externo falhar, demonstrar a cadeia local e registrar a indisponibilidade; não substituir por mock.
- [ ] Se surgir erro, preservar log e trace sem PII e não improvisar em produção.
