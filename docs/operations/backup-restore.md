# Backup e restauração

Backup só é aceito como controle quando existe restauração testada.

1. Definir RPO/RTO e cobertura de banco, Auth, Storage e configurações.
2. Criar backup cifrado e verificar integridade/metadata.
3. Restaurar exclusivamente em ambiente descartável isolado.
4. Executar migrations pendentes, checagens relacionais, contagens e smoke tests.
5. Confirmar que RLS, grants e buckets continuam protegidos.
6. Eliminar com segurança o ambiente e registrar evidência, duração e falhas.

Não usar dados pessoais reais em exercícios quando dados sintéticos forem suficientes.

## Evidência da Fase 8

O CI final cria um dump lógico somente dos dados sintéticos do schema `public`,
zera essas tabelas no próprio Supabase descartável, restaura o dump com o cliente
PostgreSQL da mesma imagem e compara as contagens de perfis, redes e vínculos antes
e depois. Falha de qualquer etapa ou divergência interrompe o workflow. O schema e
as migrations são validados separadamente no mesmo job, desde um banco vazio.

Este teste não é um restore integral do stack gerenciado: Auth, Storage, Realtime,
Vault, `pg_cron`, RPO/RTO e backups da plataforma não são cobertos. Essas áreas
dependem do ambiente contratado e de um ensaio próprio. A separação é intencional:
extensões gerenciadas do Supabase local não podem ser recriadas em um segundo banco
do mesmo contêiner sem reconfigurar o stack.
