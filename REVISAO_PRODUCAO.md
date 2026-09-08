# Revisão de produção — 2026-09-08

Status: relatório histórico da revisão inicial. Os achados abaixo receberam correções locais em 2026-09-08; ver [CORRECOES_PRODUCAO.md](CORRECOES_PRODUCAO.md) para implementação, testes e pendências atuais. **Produção ainda depende de configuração e homologação remota.** Evidências e números abaixo descrevem o estado anterior às correções.

## Escopo
Código frontend e Convex, autenticação/autorização, portal público, integrações, dependências, build e lint. Sem deploy ou alteração em dados remotos.

## Plano
1. Mapear superfícies públicas e controles de acesso.
2. Executar build, lint e auditoria de dependências.
3. Validar achados com referências concretas e corrigir problemas delimitados.
4. Registrar riscos restantes e limites da verificação.

## Evidência inicial
- Checkout inicialmente limpo.
- `convex/auth.ts`: `fastLogin` cria sessão de qualquer perfil sem credencial.

## Achados prioritários

### 1. Crítico — API administrativa sem autenticação/autorização

`convex/patients.ts:4`, `convex/clinical.ts:23`, `convex/finance.ts:150`, `convex/clinic.ts:34` e `convex/bookingBuilder.ts:807` registram funções públicas e acessam o banco sem validar sessão nem perfil. `getCurrentUser` verifica sessão exclusivamente na consulta de identidade; não protege outras funções. Não há uso de `ctx.auth` nos módulos revisados.

Impacto: consulta e alteração de dados pessoais, prontuários, valores financeiros, configurações e agendamentos por cliente direto da API. Ocultar páginas no React não estabelece controle no servidor. `ClinicDataProvider` monta inclusive antes do login e dispara consultas administrativas (`src/App.tsx`, `src/contexts/ClinicDataContext.tsx:1078`).

Validação: handlers reais de pacientes, prontuário e criação financeira executados com contexto fictício sem identidade. Retornaram dados/gravação. Não houve exploração remota.

Correção necessária: política central de autenticação e RBAC no backend, aplicada a cada query/mutation/action privada; identidade derivada da sessão; funções públicas com retorno mínimo; consultas do cliente condicionadas à sessão e ao perfil. Testar anônimo, sessão inválida/expirada, usuário inativo, recepção, profissional e administrador.

### 2. Crítico — Login administrativo sem senha e bootstrap público

`convex/auth.ts:123` (`fastLogin`) recebe apenas `role`, escolhe usuário e cria sessão de 30 dias. Probe confirmou emissão de sessão admin sem credenciais. `listPublicProfiles` enumera perfis. `convex/seed.ts` contém seeds públicos e credenciais fixas; `convex/whatsapp.ts` contém token literal no seed de integração. Valores não reproduzidos neste relatório; validade remota não verificada.

Correção necessária: remover acesso de demonstração da distribuição de produção e tornar bootstrap interno, controlado e sem senhas fixas. Se esses dados foram utilizados em ambiente acessível, substituir credenciais e invalidar sessões após fechar as rotas. Não basta esconder botões.

### 3. Crítico — Configuração pública retorna segredos de integração

`convex/clinic.ts:18` espalha todo `settings` na resposta pública. Isso inclui campos de Resend e UAZAPI existentes no schema. `convex/whatsapp.ts:306` também expõe instâncias sem checar sessão. Probe de `getSettings` confirmou retorno de segredos fictícios.

Correção necessária: separar branding público de configuração administrativa; chaves devem ficar no servidor e respostas devem conter apenas indicação de configuração, nunca o segredo completo. Auditar também a alteração do endpoint de integração. Sem comprovação de vazamento remoto nesta sessão.

### 4. Alto — Portal aceita nome/CPF/telefone como identidade

`convex/patientPortal.ts:12` permite encontrar paciente pelo nome exato, e-mail e até fragmento numérico no fallback. `getDemoPatients` enumera pacientes ativos. `getPatientPortalData` recebe apenas o identificador do paciente, sem sessão vinculada a ele.

Validação: probe encontrou paciente fictício apenas pelo nome. Leitura do código confirmou ausência de comprovação de posse no acesso aos dados do portal.

Correção necessária: sessão própria do paciente obtida por autenticação verificável e vínculo obrigatório em todas as operações. CPF/telefone podem localizar cadastro, mas não autorizar acesso. Remover lista de demonstração da produção.

### 5. Alto — Envio de mensagens e administração de WhatsApp públicos

`convex/notifications.ts:435` e `:448` aceitam destinatário e conteúdo sem sessão; as actions chamam helpers que usam credenciais da clínica. `convex/whatsapp.ts` expõe criação, conexão, desconexão, exclusão e disparo de campanhas sem autorização de funcionário.

Impacto condicionado à integração configurada: abuso de envio, consumo de cotas e interrupção do atendimento. Avaliação estática; nenhum envio ou alteração de instância executado.

Correção necessária: autorizar no início das actions, limitar destinatários/operações por perfil, controlar frequência e tornar rotinas exclusivas do cron internas.

### 6. Alto — Sucesso visual antes de confirmação da gravação

`src/contexts/ClinicDataContext.tsx:1540` retorna ID local `pat_...` antes da criação real; `:1563` registra erro apenas no console. `:2102` altera prontuário local e também engole rejeição remota. `src/pages/ClinicalRecordPage.tsx:330` exibe sucesso imediatamente. `PatientsPage` usa `await` sobre função que retorna string, não a promessa da gravação.

Impacto: paciente/prontuário pode aparentar estar salvo sem persistência; uso subsequente do ID local pode falhar. Evidência estática dos caminhos de sucesso e erro.

Correção necessária: retornar e aguardar promessa, usar ID Convex confirmado, exibir falha ao usuário e preservar rascunho explicitamente. Testar desconexão, recusa do backend e retry sem duplicação.

### 7. Alto — Alteração parcial de paciente apaga cadastro

`src/contexts/ClinicDataContext.tsx:1568` aceita `Partial<Patient>`, mas envia nome, CPF, telefone e nascimento como string vazia quando ausentes; também presume `active: true`. `src/pages/PatientsPage.tsx` chama atualização para alternar atividade. A mutation recebe esses valores como atualização integral.

Correção necessária: enviar apenas campos alterados com validação parcial no servidor, ou mesclar explicitamente com o registro persistido. Validar que inativar/reativar preserva os dados pessoais.

### 8. Alto — Edição da agenda ignora regras da criação

`convex/schedules.ts:856` apenas carrega registro e aplica patch. Não valida início/fim, colisão com sala/profissional nem capacidade em relação aos inscritos. Probe confirmou persistência de início 11:00 em sessão que termina 10:00.

Correção necessária: validar estado final mesclado e reutilizar regras de conflito da criação, excluindo o próprio agendamento da consulta. Cobrir colisões, redução de capacidade e intervalos inválidos.

### 9. Alto — Valores financeiros sem validação de domínio

`convex/finance.ts` usa `v.number()` para `amount` e grava diretamente em criação/edição. Probe confirmou receita paga de valor negativo. Validador de tipo não garante valor monetário válido.

Correção necessária: validar valor finito e positivo, precisão monetária e transições de status. Se houver estorno, representar essa operação explicitamente.

### 10. Médio — Cache local mantém dados e ressuscita listas vazias

`src/contexts/ClinicDataContext.tsx:1224` e outros derivados interpretam resposta vazia do servidor como pedido de fallback local. Após excluir último registro, dados antigos/demo podem reaparecer. `:1408` em diante persiste cadastros e prontuários em localStorage; logout em `AuthContext` limpa token, mas não esses dados. Em dispositivo compartilhado, dados anteriores permanecem no navegador.

Correção necessária: distinguir carregamento (`undefined`) de resultado vazio (`[]`), eliminar fallback de demonstração em produção e definir descarte/isolamento de rascunhos clínicos por sessão. Limites de quota e JSON inválido também precisam tratamento.

### 11. Médio — Ambiente de produção pode apontar para localhost

`src/main.tsx:7` usa `http://127.0.0.1:3210` quando `VITE_CONVEX_URL` falta. Build não impede esse cenário. O artefato gerado sozinho não comprova conexão com backend correto.

Correção necessária: validar configuração no build de produção e rejeitar ausência/URL local; conectar backend e frontend explicitamente ao mesmo ambiente. Não foram inspecionados valores de credenciais locais nem alterados ambientes remotos.

### 12. Dependência — `xlsx` com dois advisories de severidade alta

`npm audit --json` reportou 1 pacote vulnerável, 2 advisories: GHSA-4r6h-8v6p-xvw6 e GHSA-5pgg-2g8v-p4x9, sem correção automática disponível no registry consultado. Uso encontrado em `src/components/classes/AttendanceReportView.tsx:172` é criação/exportação, não leitura de planilha não confiável. Não há exploração confirmada desses advisories no fluxo atual. Chunk gerado: cerca de 424 kB, carregado sob demanda.

Reavaliar distribuição corrigida ou substituição preservando exportação com duas abas. Não aplicar atualização indiscriminada de dependências.

## Correção aplicada

**Fallback offline do Service Worker** — `public/sw.js` combinava promises com `||`: a promise de `caches.match('/')` era verdadeira mesmo sem entrada no cache, impedindo tentativa de `/index.html`. Reproduzido antes da alteração. Agora aguarda cada consulta e retorna resposta 503 com orientação quando não existe cache. Não representa garantia de funcionamento clínico offline.

Teste de regressão em `scripts/service-worker.test.mjs`: fallback para index, preferência pela rota exata e ausência completa de cache. 3/3 passaram.

## Verificações e limites

- `npm run build`: passou; TypeScript + bundle Vite. Nova execução após correção registrada na sessão.
- `npm run lint`: exit 0, **234 avisos**, zero erros. 198 unused-vars; 14 set-state-in-effect; 8 exhaustive-deps; 6 only-export-components; 6 preserve-manual-memoization; 2 purity. O comando atual aceita avisos; resultado verde não significa ausência de problemas.
- `npm audit --json`: 1 pacote com severidade alta; demais contagens zero no retorno consultado.
- `node scripts/review-production.mjs`: **7 falhas reproduzidas**, sem rede, usando handlers transpilados e banco fictício. O script é diagnóstico do estado vulnerável; sucesso não é aprovação de segurança. Depois das correções, deve ser convertido em testes que exigem rejeição dos casos inválidos.
- `node --test scripts/service-worker.test.mjs`: 3 testes aprovados após correção; primeiro caso falhava antes.
- `git diff --check`: passou.
- Não há suíte de testes de aplicação/CI configurada no package.json/checkout examinado.
- Não foi validado navegador autenticado, responsividade em dispositivo, runtime real do Convex, disponibilidade pública, backup/restauração, entrega de WhatsApp/e-mail ou produção.
- Não houve deploy, commit, push ou modificação de dados remotos.
- Scan integrado Codex Security não iniciou: `Scan scope must reference an existing directory inside the target.` Este documento é relatório da revisão local, não relatório canônico de scan concluído. Nenhuma nova tentativa de scan foi iniciada.

## Ordem recomendada antes da publicação

1. Fechar funções administrativas, remover login/seed de demonstração e retirar segredos dos retornos públicos.
2. Vincular portal à sessão do paciente e proteger todas as actions de integração.
3. Corrigir gravação assíncrona, edição parcial, agenda e validação financeira.
4. Remover dados fictícios/fallbacks e preparar ambiente de homologação com dados descartáveis.
5. Executar testes negativos de acesso e fluxos reais de cadastro, prontuário, presença, cancelamento/reposição, pagamento e notificações; validar mobile, console e erros de rede.
6. Validar backup/restauração, configuração, credenciais e backend antes de autorizar publicação.

Para implementação da autenticação, preservar sessões próprias reduz migração, mas mantém responsabilidade por hashing, revogação e limitação de tentativas. Usar solução de autenticação mantida exige migração e adaptação dos clientes, mas reduz código sensível próprio. Recomendação: decidir essa etapa antes da correção transversal; em qualquer opção, autorização por recurso continua obrigatória no servidor.
