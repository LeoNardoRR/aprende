# Escola do Saber — Sala do Aluno

Interface responsiva de estudo com personalização e dados locais no navegador.

## Funcionalidades

- Editor com prévia global, cancelar, restaurar visual e salvar.
- 6 paletas incluindo modo escuro; 4 banners (2 ilustrações originais e 2 gradientes).
- 4 famílias de fontes locais: DM Sans, Nunito, Lora e Space Grotesk.
- Lucide e Phosphor Icons com packs regular, duotone, bold e fill.
- 5 opções de cursor, incluindo cursores SVG reais; 8 avatares SVG e nome editável.
- Carteira virtual: novos itens são cobrados uma única vez ao salvar; itens adquiridos permanecem disponíveis.
- 3 atividades com 3 questões cada, salvamento das respostas, correção, explicações, notas e recompensa única.
- Materiais de apoio com impressão / salvar PDF pelo navegador.
- Calendário navegável com eventos pessoais, lembretes e registro pessoal dos dias estudados.
- Preferências, saldo, progresso e registros salvos na chave localStorage `escola-saber-v2`.

Não há contas escolares, banco de dados compartilhado, sincronização entre dispositivos ou integração com boletim/chamada oficiais. As moedas são virtuais, sem pagamento real. Ao limpar os dados do navegador, os registros locais são perdidos. Navegadores/origens diferentes têm registros separados. Falhas de armazenamento são informadas no rodapé.

## Executar e verificar

- `npm run dev -- --host 127.0.0.1`
- `npm run build`
- `npx tsc --noEmit`
- `node --experimental-strip-types --test tests/classroom.test.mjs`

Testes cobrem cobrança única, saldo insuficiente, persistência, entradas inválidas, correção de atividades, recompensa única e datas locais.

Ferramentas WebMCP opcionais: `set_customization_panel` e `read_room_state`. Registro condicionado à disponibilidade de `document.modelContext`; não houve contexto de navegador WebMCP disponível para validação desse contrato.

## Imagens e créditos

Os banners `public/banners/creative.png` e `cosmos.png` foram gerados com ImageGen nativo, em resolução nativa **2172 × 724 px**. Não há recortes de screenshot nas imagens usadas pela interface.

Prompts: (1) ilustração editorial sofisticada de aprendizagem com livros abertos e formas fluidas coral, laranja, violeta e teal, composição à direita e área calma à esquerda, sem texto; (2) universo de estudo em ilustração 3D, livro flutuante e planetas à direita, violeta e índigo, área escura à esquerda, sem texto. Solicitados em 3072 × 1024; os arquivos entregues pela ferramenta têm 2172 × 724.

- Avatares Adventurer: Lisa Wischofsky via DiceBear, CC BY 4.0: https://www.dicebear.com/styles/adventurer/ . SVGs locais obtidos pela API pública 10.x, sem modificação artística.
- Lucide: ISC, https://github.com/lucide-icons/lucide/blob/main/LICENSE . Também usado nos cursores SVG.
- Phosphor Icons: MIT, https://github.com/phosphor-icons/react .
- Fontsource: fontes locais sob OFL, licenças distribuídas nos respectivos pacotes.
