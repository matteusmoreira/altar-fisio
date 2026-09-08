# Tarefa: exclusão de prontuários clínicos

## Pedido

Permitir que o usuário exclua um prontuário clínico pela Central de Prontuários e pela ficha individual.

## Escopo confirmado

- Excluir somente o registro de anamnese/avaliação (`clinicalRecords`).
- Preservar o cadastro do paciente.
- Preservar evoluções SOAP e documentos/laudos, que possuem ciclo de vida próprio.
- Limpar fotos posturais armazenadas no Convex Storage.
- Exigir confirmação explícita e autorização clínica no backend.

## Estado encontrado

- A tela já possui estados, botões e modal de confirmação para exclusão.
- A mutation `clinical.deleteClinicalRecord` já existe e exige sessão de `admin` ou `professional`.
- Na imagem enviada, todos os pacientes estão com “Sem Ficha”; por isso os botões condicionais da Central não aparecem.
- O fluxo foi validado para sucesso, falha de persistência e ausência de registro.

## Checklist

- [x] Validar mutation, autorização e a limpeza dos quatro campos de Storage implementada no backend.
- [x] Validar que falha remota não seja apresentada como sucesso.
- [x] Validar preservação do paciente, evoluções SOAP e laudos; o registro removido deixa de aparecer na Central e na ficha via query reativa.
- [x] Adicionar regressões automatizadas.
- [x] Rodar testes e build: testes, TypeScript e bundle isolado aprovados; o build normal continua bloqueado por URL local do Convex.
- [x] Registrar desafios encontrados em `DESAFIOS.md`.

## Alterações realizadas

- A mutation valida o paciente, remove o registro e as fotos, e grava auditoria com o usuário autenticado.
- O contexto só altera o fallback local depois que o backend confirma `success=true`.
- O modal identifica o paciente e explica exatamente o que será removido e o que será preservado.
- O botão da ficha individual aparece somente quando existe prontuário para excluir; na Central os botões continuam condicionados a “Prontuário Ativo”.
