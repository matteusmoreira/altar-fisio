# Login do portal — implementação

## Decisões aprovadas
- CPF ou telefone com seletor e máscaras; senha inicial `@mudar123`.
- Todos os pacientes, incluindo existentes; preservar senhas personalizadas.
- Apenas admin edita cadastro, status, exclusão e senha; criação/consulta mantêm perfis atuais.
- Telefone compartilhado exige CPF. CPF válido obrigatório no agendamento e novos cadastros.
- Sessões de 24 horas, hash scrypt individual, bloqueio de links legados e tentativas limitadas.
- Publicação em produção ficou fora da tarefa de implementação e foi autorizada em release separado.

## Andamento
- [x] Inspecionar implementação atual e pontos de integração.
- [x] Implementar backend, migração idempotente e validações compartilhadas.
- [x] Atualizar portal, painel e agendamento público.
- [x] Testar permissões, integridade, autenticação e UI responsiva.
- [x] Registrar evidências e limites da entrega.

## Operação
A migração será uma action interna paginada: preparar hashes individuais antes da mutation; nunca redefinir credencial existente. Nenhum dado clínico será mesclado ao detectar CPF duplicado. Links anteriores serão rejeitados pela versão de autenticação mesmo antes da limpeza física das sessões.

## Implementação entregue
- `patients.createPatient` e `bookingBuilder.submitPublicBooking` agora são actions públicas. Seus argumentos de entrada foram preservados; gravações transacionais são mutations internas. O agendamento retorna `portalAccessCreated` para orientar sobre senha inicial ou atual.
- Login público `portalAuth.login({ type: 'cpf' | 'phone', identifier, password })` retorna `{ token }`. Alteração de senha é `portalAuth.changePassword({ sessionToken, patientId, password })`, com autorização de admin revalidada antes da gravação.
- Credenciais scrypt ficam em `patientCredentials`; sessões com `authVersion: 2` duram 24 horas. Alteração de senha, identificadores, inativação e exclusão revogam sessões. Links legados não são mais emitidos ou aceitos.
- Cinco tentativas por identificador em janela fixa de 15 minutos. A reserva acontece em mutation separada para sobreviver à rejeição da senha. Telefone compartilhado exige CPF; identificadores ambíguos nunca selecionam o primeiro paciente.
- CPF e telefone possuem índices normalizados e compatibilidade com cadastros formatados ainda não migrados. Senhas existentes são preservadas durante migração e agendamento repetido.
- Apenas admin altera cadastro, status, senha ou exclui paciente. Criação/consulta e regras clínicas existentes foram preservadas. Exclusão local só atualiza a lista após confirmação do servidor.

## Evidências — 2026-09-08
- Suíte: 46 testes Vitest + 3 testes do service worker aprovados. Casos novos cobrem hash individual, login por CPF/telefone, rate limit, permissões, revogação, duplicidade, migração, concorrência, formulários e agendamento com/sem aprovação.
- TypeScript e build aprovados. Build de verificação em `.artifacts/build-validation`, com URL fictícia HTTPS, não publicável.
- Lint sem erros; avisos preexistentes de componentes legados permanecem. Componentes novos sem avisos após extração do formatador de erros para módulo próprio.
- Backend local `http://127.0.0.1:3210` compilado com Node 24. Migração local habilitou 4 pacientes; repetição retornou 0 novas credenciais e nenhuma duplicidade de CPF.
- Navegador real em `http://127.0.0.1:5173`: login com CPF e telefone `+55`; admin autenticado alterou senha; sessão anterior recusada; nova senha aceita. Paciente fictício criado para esse fluxo foi removido ao terminar.
- Desktop e viewport mobile 390 × 844 sem overflow horizontal na tela de login; agendamento mobile rejeitou CPF repetido antes de submissão. Nenhum erro de JavaScript registrado pelo navegador nesses fluxos.
- Capturas locais: `.artifacts/portal-login-desktop.png`, `.artifacts/portal-login-mobile.png` e `.artifacts/portal-access-panel-mobile.png`.

## Publicação futura — fora desta entrega
Este bloco registra o estado anterior à autorização de release. Nesta sessão, o commit, push e deploy do backend Convex foram autorizados explicitamente; a migração remota permanece como etapa operacional posterior ao deploy.

## Release autorizado — 2026-09-08
O backend e o schema Convex foram publicados no deployment de produção antes de qualquer publicação do frontend. A validação de build, testes e bundling foi concluída localmente.

- Commit e push: `6f61833` em `main` / `origin/main`.
- Convex: deployment `exuberant-guanaco-180`, com os três índices novos publicados e nenhuma remoção.
- Migração: `portalAuth:migrateExisting` executada com `cursor: null`, `done: true`, `created: 0` e `duplicatePatientIds: []`.

Para futuras publicações, confirmar o alvo e publicar backend/schema antes do frontend. Se houver pacientes novos sem credencial, executar a action interna `portalAuth:migrateExisting` com `cursor: null`, repetir com o cursor retornado até `done: true` e guardar apenas o relatório de IDs duplicados para correção pelo admin. Repetir a migração é seguro e não redefine senhas personalizadas. CPFs legados inválidos precisam ser corrigidos pelo admin para permitir entrada por CPF; telefone válido e exclusivo continua disponível.

Homologação remota, entrega de mensagens e dispositivo físico não foram realizados. Os agendamentos positivos foram testados em base simulada isolada; no navegador, a validação pública foi exercitada sem enviar agendamento ou mensagens externas.
