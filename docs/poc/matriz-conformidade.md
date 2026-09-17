# Matriz de conformidade executável

Fonte canônica: [`matriz-conformidade.json`](matriz-conformidade.json). Execute `npm run poc:report` para recalcular os totais.

| ID | Categoria | Fase | Status | Severidade | Demonstração principal |
|---|---|---:|---|---|---|
| POC-1.1 | Acesso e administração | 1/6 | PARCIAL | P0 | `/?access=institutional` |
| POC-1.2 | Currículo | 2 | PARCIAL | P0 | `#curricula` |
| POC-1.3 | Usuários e matrículas | 1 | PARCIAL | P1 | `#enrollments` |
| POC-1.4 | Banco de itens | 2 | PARCIAL | P0 | `#item-bank` |
| POC-1.5 | Avaliação | 3 | ATENDIDO | P2 | `#assessments` |
| POC-1.6 | Agendamento | 3/4 | ATENDIDO | P2 | `#assessments` |
| POC-1.7 | Aplicação | 4 | ATENDIDO | P2 | `/?mode=student` |
| POC-1.8 | Analytics e relatórios | 5 | PARCIAL | P1 | `#analytics` |
| POC-1.9 | Proficiência | 5 | ATENDIDO | P2 | `#analytics` |
| POC-1.10 | VAAR e equidade | 7 | PARCIAL | P0 | `#remediation` |
| POC-1.11 | Fluência leitora | 7 | PARCIAL | P0 | `#remediation` |
| POC-1.12 | Recomposição | 7 | PARCIAL | P0 | `#remediation` |
| POC-1.13 | IA pedagógica | 7 | PARCIAL | P0 | `#remediation` |
| POC-1.14 | Mobile | 8 | PARCIAL | P0 | `/` (PWA web) |
| POC-1.15 | Acessibilidade | 5/8 | PARCIAL | P1 | `/` |
| POC-1.16 | LGPD e segurança | 1–6/8 | PARCIAL | P0 | `#access` |
| POC-1.17 | Aplicação impressa | 8 | NÃO ATENDIDO | P0 | — |
| POC-2.1 | Operação | Externa | DEPENDÊNCIA EXTERNA | P1 | — |
| POC-2.2 | Capacitação | Externa | DEPENDÊNCIA EXTERNA | P1 | — |
| POC-2.3 | Suporte | 8 | NÃO ATENDIDO | P0 | — |
| POC-3.1 | Implantação | Externa | DEPENDÊNCIA EXTERNA | P0 | — |

Cada linha completa no JSON registra descrição, referência do edital, implementação, rota, perfil, dados, testes, evidências, gap e observações. O validador rejeita IDs duplicados, enums desconhecidos, caminhos inexistentes e qualquer item `ATENDIDO` sem implementação, teste ou evidência.

A classificação foi confrontada novamente com o PDF retificado, páginas 67–76. A [documentação da Fase 7](../phase7-pedagogical-resources.md) registra as capacidades demonstráveis e os limites que ainda impedem declarar a solução pronta para a PoC.
