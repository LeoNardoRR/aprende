# Gaps da PoC

## P0 — risco direto de reprovação

| ID | Requisito | Impacto e evidência | Causa / dependência | Recomendação | Esforço |
|---|---|---|---|---|---|
| POC-1.1 | Acesso | CAPTCHA e cartas de senha não podem ser demonstrados. | Domínios não implementados; CPF/RA/RG exigem decisão LGPD. | Definir campos mínimos, mecanismo antiabuso e geração segura. | M |
| POC-1.2 | Currículo oficial | Estrutura funciona, conteúdo integral não está disponível. | Acervo oficial/licenciado externo. | Importar pacote homologado e validar amostra com pedagogia. | M + externa |
| POC-1.4 | Acervo de 1.500 itens | Escala técnica existe; acervo real validado não. | Produção pedagógica externa. | Obter, revisar e importar acervo oficial. | XL + externa |
| POC-1.10 | VAAR/equidade | Grupos e supressão são demonstráveis, mas o relatório oficial continua incompleto. | Faltam metodologia VAAR, dados socioeconômicos governados, índice ponderado, gap, risco, mapa e exportação própria. | Homologar metodologia/LGPD e completar cálculos e relatórios. | XL + externa |
| POC-1.11 | Fluência leitora | Registro assistido e PCMin existem; a experiência integral não. | Faltam modo autônomo, etapas completas, perfis homologados e consolidação por escopo. | Completar runtime, rubricas e painéis após validação pedagógica. | L + externa |
| POC-1.12 | Recomposição | Jornada/versionamento, atribuição, progresso, portfólio, relatório e escala sintética de 12.849 alunos estão demonstrados; o acervo obrigatório não. | Faltam tipos interativos completos e 180 títulos reais de Português e Matemática; relatório extenso ainda é exportado sincronicamente no navegador. | Construir runtimes restantes, preparar exportação assíncrona e importar acervo autorizado. | XL + externa |
| POC-1.13 | IA pedagógica | Fila, privacidade básica e revisão humana existem; nenhuma IA real foi integrada. | Faltam provedor aprovado e fluxos ponta a ponta de insight, geração e correção. | Homologar provedor/política e integrar sem decisão automatizada. | L + externa |
| POC-1.14 | Mobile nativo | PWA responsiva não prova apps em lojas. | Fase 8 e contas de distribuição. | Criar wrappers, validar dispositivos e publicar. | XL + externa |
| POC-1.16 | LGPD operacional | RLS existe; retenção e direitos do titular não fecham o requisito. | Decisões jurídica/administrativa e Fase 8. | Aprovar política e implementar fluxos auditáveis. | L + externa |
| POC-3.1 | Implantação | Disponibilidade contratual não foi provada. | Ambiente e SLA externos; deploy proibido nesta fase. | Preparar homologação separada. | Externa |

## P1 — requisito importante incompleto

- **POC-1.3:** gerar credenciais/cartas individuais e em lote sem expor senha em logs.
- **POC-1.8:** formalizar se alguma forma de ranking é exigida e permitida pela metodologia e privacidade.
- **POC-1.15:** executar auditoria WCAG completa com leitor de tela, zoom e contraste.
- **POC-2.1/2.2:** aprovar equipe operacional e plano de capacitação.
- **POC-2.3:** o Help Desk e sua rastreabilidade estão implementados; homologar SLA e operação da equipe de suporte.

## P2 e P3

Os requisitos já atendidos permanecem P2 para regressão contínua. Melhorias visuais e de conveniência entram como P3 apenas quando não afetam a demonstração. A matriz não contém P3 artificial nesta revisão inicial.

## Decisão

Há P0 ligados a conteúdo, método, mobile e decisões externas. A conclusão técnica Desktop da Fase 8 não torna o produto pronto para a PoC integral.
