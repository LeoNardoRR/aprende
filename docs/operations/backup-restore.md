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

O CI final cria um dump lógico após o seed sintético, restaura em um segundo banco
no mesmo Supabase descartável, valida tabelas e contagens mínimas e elimina o banco
de restore. Falha de qualquer etapa interrompe o workflow. O teste não cobre RPO,
RTO, backups gerenciados, Storage ou Auth externo de produção; esses pontos seguem
dependentes da infraestrutura contratada.
