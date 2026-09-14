# Roteiro oficial de demonstração

Todos os logins usam o domínio sintético `@poc.aprende.invalid`, Supabase local e a senha DEMO definida antes do seed. Nunca projetar token, senha ou DevTools com credenciais. As durações são metas e não evidência de performance.

## Cenário 01 — Administração institucional (4 min)

- Requisito: POC-1.1. Perfil: administrador da rede. Pré-condição: seed concluído.
- Rota: `/?access=institutional#overview`.
- Passos: entrar; conferir rede; abrir escolas, anos, séries e turmas; mostrar a versão do sistema.
- Esperado: hierarquia DEMO completa e escopo protegido. Evidência: screenshot em `artifacts/poc/usuarios/`.
- Plano B: relatório do seed e teste de integração local.

## Cenário 02 — Usuários e permissões (5 min)

- Requisito: POC-1.1/1.3/1.16. Perfis: admin, gestor, professor e aluno.
- Rota: `#access` e `#enrollments`.
- Passos: consultar diretório; mostrar vínculo; trocar para gestor; tentar escola alheia; revisar movimentação.
- Esperado: ação autorizada funciona e acesso cruzado é negado. Evidência: `tests/security-regression.test.mjs`.
- Plano B: executar o caso negativo conectado.

## Cenário 03 — Currículo (4 min)

- Requisito: POC-1.2. Perfil: gestor. Pré-condição: currículo DEMO.
- Rota: `#curricula`.
- Passos: abrir componente, unidade, objeto e habilidade; explicar que o conteúdo é sintético.
- Esperado: relacionamento navegável. Evidência: screenshot e teste da Fase 2.
- Plano B: consultar registros no Supabase local.

## Cenário 04 — Banco de itens (5 min)

- Requisito: POC-1.4. Perfil: professor.
- Rota: `#item-bank`.
- Passos: filtrar; criar item; conferir quatro alternativas, justificativa, distratores, habilidade, fórmula/imagem quando aplicável.
- Esperado: item em draft e imagem privada. Evidência: trace em `artifacts/poc/itens/`.
- Plano B: usar item DEMO pré-carregado.

## Cenário 05 — Workflow editorial (4 min)

- Requisito: POC-1.4. Perfis: professor, revisor, aprovador.
- Rota: `#item-bank`.
- Passos: enviar para revisão; comentar; aprovar; editar origem; comparar snapshot.
- Esperado: versão aprovada imutável e nova revisão separada. Evidência: testes de snapshots.
- Plano B: mostrar versões DEMO existentes.

## Cenário 06 — Construção da avaliação (5 min)

- Requisito: POC-1.5. Perfil: gestor/professor.
- Rota: `#assessments`.
- Passos: abrir avaliação; adicionar somente itens aprovados; criar cadernos A-E; reordenar; conferir pontos e mapa.
- Esperado: máximo de cinco cadernos e mapa deduplicado. Evidência: teste da Fase 3.
- Plano B: avaliação DEMO já pronta.

## Cenário 07 — Agendamento (4 min)

- Requisito: POC-1.6. Perfil: gestor/professor.
- Rota: `#assessments`.
- Passos: escolher ciclo, janela e turmas; salvar; revisar estudantes elegíveis; reagendar.
- Esperado: apenas turmas do escopo. Evidência: screenshot em `artifacts/poc/avaliacao/`.
- Plano B: agendamento DEMO ativo.

## Cenário 08 — Aplicação do aluno (5 min)

- Requisito: POC-1.7. Perfil: aluno.
- Rota: `/?mode=student`.
- Passos: autenticar; usar token; abrir avaliação; responder; navegar; atualizar página.
- Esperado: tentativa idempotente, ordem estável e resposta preservada. Evidência: trace da Fase 4.
- Plano B: repetir com cenário conectado automatizado.

## Cenário 09 — Offline e reconexão (6 min)

- Requisito: POC-1.7. Perfil: aluno.
- Rota: runtime da avaliação.
- Passos: responder; ativar offline; responder; recarregar; conferir IndexedDB; reconectar; esperar indicador de sincronizado.
- Esperado: fila persiste e servidor recebe cada operação uma vez. Evidência: `artifacts/poc/aplicacao/`.
- Plano B: executar teste determinístico da fila offline.

## Cenário 10 — Monitor do professor (4 min)

- Requisito: POC-1.6/1.7. Perfil: professor.
- Rota: monitor da aplicação.
- Passos: abrir turma; observar estados; filtrar; conferir eventos e timeout.
- Esperado: somente turma autorizada e atualização de status. Evidência: teste da Fase 4.
- Plano B: registros DEMO finalizados.

## Cenário 11 — Correção (4 min)

- Requisito: POC-1.7/1.8. Perfil: professor.
- Rota: monitor/correção.
- Passos: abrir discursiva pendente; atribuir nota; finalizar revisão; atualizar analytics.
- Esperado: nota provisória não é apresentada como definitiva e a correção repercute. Evidência: integração Fase 5.
- Plano B: comparar payload antes/depois no Supabase local.

## Cenário 12 — Analytics (6 min)

- Requisito: POC-1.8. Perfil: gestor/admin.
- Rota: `#analytics`.
- Passos: filtrar escola, turma e avaliação; abrir habilidade, aluno e questão; conferir média, mediana, variância e psicometria.
- Esperado: totais fecham e estados sem amostra exibem “Sem dados suficientes”. Evidência: testes matemáticos e screenshot.
- Plano B: usar relatório JSON da RPC.

## Cenário 13 — Proficiência (4 min)

- Requisito: POC-1.9. Perfil: gestor/admin.
- Rota: `#analytics`.
- Passos: selecionar avaliação; mostrar escala versionada, distribuição e evolução.
- Esperado: níveis e histórico preservados; comparação incompatível é identificada. Evidência: teste da Fase 5.
- Plano B: payload do relatório analítico.

## Cenário 14 — Relatórios (5 min)

- Requisito: POC-1.8/1.9. Perfil: gestor/admin.
- Rota: `#analytics`.
- Passos: exportar PDF, DOCX e CSV; solicitar lote ZIP; acompanhar progresso; baixar.
- Esperado: formatos usam o mesmo payload e clique repetido é idempotente. Evidência: `artifacts/poc/relatorios/`.
- Plano B: arquivos gerados no ensaio e teste do job.

## Encerramento

Abrir `#poc`, filtrar P0 e explicar objetivamente os gaps. Não apresentar os requisitos das Fases 7/8 como atendidos. Duração total planejada: cerca de 65 minutos.
