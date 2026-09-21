# Checklist manual de acessibilidade — Fase 8 Desktop

Data da última execução: 20/09/2026. Escopo operacional: navegador Chromium, viewport desktop mínima de 1024 px. Este registro separa verificações executadas de validações ainda pendentes.

## Executado

- [x] Navegação até o skip link e ativação do destino no shell de gestão.
- [x] Indicador de foco visível em links, botões, campos, selects, textareas e summaries.
- [x] Auditoria axe automatizada em login do aluno, professor, gestão e nas superfícies demonstráveis de gestão, banco de itens, avaliação, analytics e jornadas.
- [x] Zero violações de impacto `critical` nas superfícies acima.
- [x] Login do aluno a 200% na viewport de 1024 px sem overflow horizontal da página.
- [x] Preferência `prefers-reduced-motion` desativa animações e transições não essenciais.
- [x] Tabelas densas mantêm rolagem horizontal dentro do próprio contêiner.
- [x] Gráficos de analytics possuem nome acessível e representação tabular equivalente.
- [x] Formulários de login usam labels persistentes e autocomplete adequado.

## Pendente de homologação humana

- [ ] Leitor de tela NVDA + Firefox no Windows.
- [ ] Leitor de tela VoiceOver + Safari no macOS.
- [ ] Percurso integral somente por teclado em todos os fluxos autenticados e conectados.
- [ ] Compreensão das mensagens de erro por usuários com tecnologia assistiva.
- [ ] Contraste em temas personalizados escolhidos pelo aluno e professor.
- [ ] Zoom 200% em todas as telas autenticadas, dialogs, dropdowns e tooltips.
- [ ] Aplicação de avaliação completa com leitor de tela, incluindo alternativas, salvamento e envio.

## Violações não críticas observadas

O axe ainda aponta ocorrências `serious`, `moderate` e `minor`, predominantemente contraste de textos auxiliares históricos, hierarquia de headings em módulos legados e nomes/descrições em controles densos. Elas não são declaradas como resolvidas por esta etapa e devem permanecer no backlog até correção e nova auditoria. A suíte anexa o JSON completo de violações por teste ao relatório Playwright.

## Repetição

Execute `npm run test:a11y`. A suíte falha se reaparecer qualquer violação `critical`. A auditoria automatizada não substitui a homologação humana listada acima.
