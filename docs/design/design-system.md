# Design System Aprendê Desktop

O sistema usa os tokens de `app/design-tokens.css` como contrato visual. As experiências de aluno, professor e gestão compartilham tipografia, foco, estados, bordas e espaçamento; a densidade e o tom variam conforme o papel.

## Fundamentos

- **Marca institucional:** azul profundo para navegação, azul médio para ações e verde para progresso pedagógico.
- **Superfícies:** canvas `--aprende-canvas`, cartões brancos e borda `--aprende-border`.
- **Tipografia:** DM Sans para interface; Lora apenas para leitura longa.
- **Espaçamento:** escala de 4 a 40 px; cartões usam 16–24 px.
- **Radius:** 8 px para controles, 12–16 px para cartões, 20 px apenas em destaques.
- **Foco:** anel âmbar de 3 px, visível em todos os controles.
- **Motion:** 160–240 ms; `prefers-reduced-motion` reduz animações globalmente.
- **Desktop:** conteúdo máximo de 1600 px e sidebar de 244 px. O breakpoint mínimo operacional é 1024 px.

## Componentes

Botões possuem ação primária, secundária, neutra, perigosa e desabilitada. Inputs, selects e uploads usam label persistente, mensagem associada e foco comum. Cards distinguem conteúdo, KPI e ação; cards não substituem hierarquia de títulos. Tabelas usam cabeçalho, rolagem horizontal contida, paginação no servidor, estado vazio e ações agrupadas. Dialogs têm título associado, foco contido e ação de cancelamento. Estados loading, empty, error, insufficient data e success usam texto explícito e nunca dependem apenas de cor.

## Acessibilidade

A aplicação inclui skip link, landmarks, HTML semântico, foco global, alvos operáveis por teclado e redução de movimento. Gráficos mantêm tabela textual. ARIA complementa sem substituir labels e elementos nativos.
