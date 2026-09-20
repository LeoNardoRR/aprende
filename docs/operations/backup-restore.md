# Backup e restauração

Backup só é aceito como controle quando existe restauração testada.

1. Definir RPO/RTO e cobertura de banco, Auth, Storage e configurações.
2. Criar backup cifrado e verificar integridade/metadata.
3. Restaurar exclusivamente em ambiente descartável isolado.
4. Executar migrations pendentes, checagens relacionais, contagens e smoke tests.
5. Confirmar que RLS, grants e buckets continuam protegidos.
6. Eliminar com segurança o ambiente e registrar evidência, duração e falhas.

Não usar dados pessoais reais em exercícios quando dados sintéticos forem suficientes.
