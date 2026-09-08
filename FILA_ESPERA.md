# Fila de espera e lembretes — implementação local

Implementação de 08/09/2026. Nenhuma publicação em produção ou mensagem para telefone real foi realizada nesta tarefa.

## Comportamento

- No portal, a área **Reposições** oferece agendamento direto e fila de espera. Uma inscrição vincula um crédito disponível a uma ocorrência específica da agenda; não modifica a série recorrente.
- O paciente visualiza data, início/fim, profissional, sala, telefone e posição. Confirma que aceita o encaixe automático. Pode sair ou trocar de horário; a troca entra no fim da nova fila.
- A vaga liberada por cancelamento, remarcação, remoção, ausência antecipada ou aumento de capacidade chama o primeiro paciente elegível. Crédito, participante e inscrição são atualizados na mesma transação.
- Exatamente 90 minutos antes ainda permite encaixe; depois desse instante, a inscrição é encerrada sem consumir crédito. A validade original é mantida.
- Cancelamento de reposição no prazo devolve o mesmo crédito. Fora do prazo, ele permanece usado. Remarcação de reposição é atômica: se o destino estiver lotado, a sessão original é mantida.
- A agenda diária, semanal e mensal abre a fila da sessão. Administrador/recepção podem incluir e retirar; profissionais podem consultar. A autorização é conferida no backend e no registro de permissões da interface.

## WhatsApp e operação

- Véspera: preservado o disparo diário às 08:00 de Brasília. Os avisos usam a mesma proteção contra envio duplicado e cancelamento dos novos lembretes.
- Novos lembretes: trabalhos duráveis por participante, para 1 hora e 30 minutos antes. O cron de 2h foi retirado; a função antiga permanece inativa para eventuais chamadas já agendadas.
- Os modelos de véspera, 1h, 30min e encaixe podem ser vinculados na Central WhatsApp. Os modelos antigos de 2h são preservados como legado, sem disparo automático.
- Os trabalhos conferem participante, sessão, horário e estado antes de tentar enviar. Alterações/cancelamentos invalidam trabalhos antigos. Falhas não desfazem o encaixe e aparecem na recepção e na central de notificações.
- Respostas incertas não causam repetição automática. Reenvio manual exige nova validação; a interface pede conferência no WhatsApp antes de repetir uma resposta incerta.
- `appointmentNotifications.backfill` prepara compromissos futuros de forma paginada e idempotente. O cron de reconciliação executa a cada cinco minutos e não recria lembretes já preparados nem dispara retroativamente janelas vencidas.

## Evidências

- **77 testes passaram:** 74 no Vitest e 3 de service worker. Incluem prioridade, concorrência, limite exato de 90 minutos, autorização, uso manual do crédito, restituição, remarcação, mudança de sessão, falha/incerteza do provedor e permissões reais do wrapper React.
- TypeScript e build aprovados. Build de validação em `.artifacts/fila-build`, com URL Convex fictícia; **não publicar esse diretório**.
- Lint sem erros; 290 avisos no projeto. Nenhum aviso nos módulos novos da fila e do envio.
- Backend Convex anônimo isolado compilou e executou o fluxo com pacientes fictícios, sem copiar configurações de produção ou instâncias WhatsApp.
- Navegador: login de paciente e equipe; entrada na fila; recepção visualizando posição; cancelamento liberando vaga; encaixe refletido no portal; falha WhatsApp destacada; cancelamento do encaixe devolvendo o crédito na validade original.
- Portal e agenda conferidos em viewport de 390px, sem overflow horizontal após os ajustes. Nenhum erro de aplicação foi registrado pelo navegador.
- Registros locais: `.artifacts/fila-tests.log`, `.artifacts/fila-build.log`, `.artifacts/fila-lint.log` e imagens `.artifacts/fila-*-mobile.png`.

## Próxima etapa de publicação

Publicar o backend antes do frontend, preservando os campos opcionais de compatibilidade. Executar o backfill paginado no deployment confirmado ou verificar a primeira reconciliação automática. Construir o frontend novamente com a URL correta do ambiente; conferir consultas autenticadas e trabalhos futuros nesse deployment.

A integração só poderá ser declarada homologada em entrega após o responsável indicar um telefone de teste autorizado e confirmar recebimento da mensagem de encaixe e dos lembretes. Sucesso HTTP/provedor não equivale a entrega física. O ambiente local usado nesta tarefa comprovou o tratamento de falha, não o recebimento no aparelho.
