# AGENDAMENTO DE SESSÕES DENTRO DO PORTAL DO PACIENTE — DOCUMENTO DE CONTEXTO

Este arquivo documenta as decisões tomadas no `/grill-me`, a arquitetura acordada e o roadmap de execução.

## Decisões Tomadas no Grill-me:
1. **Modelo de Agendamento:** Consumir sessão do pacote/plano ativo se tiver saldo, com trava amigável direcionando ao WhatsApp para renovação/avulso se não tiver saldo.
2. **Ponto de Acesso:** Botão em destaque "+ Agendar Aula/Sessão" no topo da aba Agenda, botão no empty state, botão flutuante rápido (FAB) e botão direto nos cards da aba Planos.
3. **Regra de Confirmação:** Confirmação imediata e automática na grade de horários da clínica se houver vaga livre e saldo ativo.
4. **Controle de Saldo:** Smart Allocation — O paciente só pode agendar se o saldo restante for superior às aulas futuras já agendadas para aquele pacote.
5. **Anti-Conflito:** Não permite sobreposição de horários no mesmo dia.
6. **Notificações:** Disparo de WhatsApp de confirmação ao paciente e notificação interna para a recepção da clínica.

## Roadmap de Execução:
1. **Backend (`convex/patientPortal.ts`):**
   - Mutation `bookAppointmentFromPortal` com validações atômicas de saldo, anti-conflito e capacidade.
   - Enriquecimento de `getPatientPortalData` para informar quantas sessões futuras já estão reservadas por pacote (`bookableSessionsCount`).
2. **Frontend (`src/pages/PatientPortalPage.tsx`):**
   - Modal de Novo Agendamento com seleção de plano, carrossel de datas e lista de horários.
   - Botões de acesso na Agenda, no FAB e na aba Planos.
   - Estado de feedback em tempo real e atualização reativa instantânea.
3. **Validação & Testes:**
   - Validação com pacientes de demonstração e verificação de build.
