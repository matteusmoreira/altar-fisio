# Implementação: serviços, capacidade e preços

## Objetivo

Permitir configurar, na tela de Serviços:

- modalidade individual ou turma;
- capacidade específica da turma (por exemplo, 6 ou 8 alunos);
- preço da sessão avulsa;
- preço de referência por sessão quando o atendimento for vendido em pacote.

## Decisões

- `services.maxCapacity` será opcional no schema para manter compatibilidade com serviços já existentes. A aplicação interpreta serviços antigos como turma de até 4 alunos e serviços individuais como capacidade 1.
- `services.packagePricePerSession` será opcional e representará a referência unitária do pacote. O preço total, quantidade de sessões, validade e condições de pagamento continuam pertencendo a `packages`, porque um mesmo serviço pode ter vários pacotes.
- A capacidade ficará no serviço, mas os agendamentos existentes não serão alterados retroativamente. O agendamento continuará registrando seu próprio `maxCapacity`, preservando histórico e permitindo exceções por horário.

## Etapas

1. Atualizar schema, funções Convex, tipos e contexto para persistir os novos campos.
2. Atualizar formulário de criação/edição e catálogo com capacidade e preços.
3. Regenerar tipos Convex e executar typecheck, testes e build.
4. Registrar desafios encontrados em `DESAFIOS.md` se houver algum novo ponto de fricção.

## Critérios de aceite

- Editar um serviço de turma permite informar 6, 8 ou outra capacidade válida.
- Serviço individual não exibe capacidade de turma e persiste capacidade 1.
- Preço avulso continua disponível e preço por sessão em pacote pode ficar vazio.
- Valores são validados no frontend e no backend.
- Serviços antigos continuam carregando sem quebra.
- O total de um pacote continua editável no módulo de Pacotes.

## Estado da implementação

- [x] Schema, backend Convex, tipos e contexto atualizados.
- [x] Formulário de serviço permite capacidade, preço avulso e preço unitário de pacote.
- [x] Catálogo mostra capacidade e os dois preços quando configurados.
- [x] Criação de pacote usa a referência do serviço para sugerir o total inicial.
- [x] Teste de regressão cobre capacidade 8 → 6, limpeza do preço de pacote e modalidade individual.
- [x] `npm test` e build com URL fictícia de validação aprovados.
- [ ] Validação visual autenticada ainda depende de uma conta local; não foram inseridas credenciais por automação.
