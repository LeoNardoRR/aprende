# Política técnica de retenção

Os prazos abaixo são categorias de implementação e precisam ser preenchidos pelo controlador antes da produção.

| Categoria | Exemplos | Evento inicial | Prazo | Destino |
|---|---|---|---|---|
| Conta e autenticação | perfil, sessões e aceite | encerramento do vínculo | `A DEFINIR` | excluir ou anonimizar |
| Vida acadêmica | matrícula, frequência, avaliações e resultados | fim do ano/vínculo | `A DEFINIR` | arquivo regulado |
| Conteúdo pedagógico | atividades, jornadas e portfólio | fim do vínculo | `A DEFINIR` | exportar e eliminar/anonimizar |
| Suporte | tickets e comentários públicos | fechamento do ticket | `A DEFINIR` | anonimizar ou excluir |
| Auditoria e segurança | ações administrativas, falhas e correlação | criação do evento | `A DEFINIR` | expurgo automatizado |
| Exportações temporárias | PDF, DOCX, CSV e pacotes do titular | criação do arquivo | curto e configurável | exclusão automática |

## Regras

- retenção deve ser configurável por ambiente e categoria;
- legal hold suspende somente o expurgo do escopo documentado;
- jobs de expurgo são idempotentes, observáveis e executados primeiro em staging;
- backup não é arquivo permanente: cópias expiram conforme política própria e restauração reaplica expurgos pendentes;
- nenhuma execução é habilitada em produção sem aprovação institucional e jurídica registrada.
