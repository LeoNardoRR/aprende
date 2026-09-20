# Rollback

Rollback de aplicação reutiliza o último artefato aprovado. Migration histórica nunca é editada nem revertida destrutivamente: uma correção de esquema é feita por migration aditiva compatível. Antes de promover mudanças incompatíveis, usar expansão/contração: adicionar estrutura, publicar código compatível, migrar dados, verificar e somente depois retirar legado em release posterior.

Registrar incidente, SHA afetado, decisão, operador, horários, impacto, validações e resultado. Após rollback, executar login, leitura de turma, atividade, avaliação, relatório e health check.
