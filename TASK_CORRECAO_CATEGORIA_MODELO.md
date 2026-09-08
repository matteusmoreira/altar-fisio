# Correção: categoria do novo modelo de mensagem

## Sintoma

Ao criar um novo modelo e trocar a categoria, o select muda, mas o título, o conteúdo e os controles do editor continuam com os dados da categoria anterior.

## Causa encontrada

`MessageTemplateBuilder` só aplicava um preset quando a categoria era `booking_confirmation`. As demais categorias apenas executavam `setCategory`, deixando o restante do formulário inalterado.

## Decisão técnica

- Centralizar os presets por categoria em uma estrutura única.
- Aplicar o preset somente enquanto não existe `editingTemplateId`, para não apagar edições de um modelo salvo.
- Atualizar título, formato, conteúdo, rodapé, botões, botão de lista e cartões do carrossel juntos, mantendo o editor coerente.

## Validação planejada

- Verificar o diff isolado do componente.
- Executar o build TypeScript/Vite.
- Executar os testes disponíveis.

## Resultado

- Implementados presets para as cinco categorias do editor.
- A troca de categoria no modo de criação atualiza título, formato, conteúdo, rodapé, botões, lista e cartões.
- A troca de categoria durante a edição preserva o modelo salvo e suas alterações manuais.
- Regressões adicionadas em `tests/message-template-builder.test.tsx`.
- `npm test`: 28 testes Vitest e 3 testes do Service Worker aprovados.
- `npx tsc -b`: aprovado.
- `npm run build` com `VITE_CONVEX_URL=https://fixture.convex.cloud` apenas no ambiente do comando: aprovado. Sem essa variável, o build é bloqueado pela validação de produção já existente no `vite.config.ts`.
