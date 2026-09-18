# DESAFIOS.md — Registro de Desafios e Pontos de Fricção

### [2026-09-18] Refatoração Mobile-First Integral: Contenção de Overflow X, Cards Responsivos e Preservação A11y/Testes
- **Ponto de Fricção**:
  1. Nas 5 páginas principais da clínica (Ficha Clínica / Prontuário, Agendamento Rápido, Turmas & Salas Físicas, Pacotes & Serviços e Notificações WhatsApp), layouts baseados em `flex justify-between items-center` ou grades rígidas sem `min-w-0` e sem `overflow-x-hidden` causavam overflow horizontal em smartphones (viewport de 393px × 852px do iPhone 14 Pro), empurrando a viewport e comprimindo títulos, botões e tabs.
  2. Na Ficha Clínica, a evolução de dor EVA continha 4 cards de KPIs em linha única com rótulos extensos ("Média Recente (Últimos 30 dias)", "Evolução Global"), truncando valores e forçando scroll lateral.
  3. No Agendamento Rápido, o placeholder do campo de busca de pacientes continha 58 caracteres (`"Buscar por nome, telefone ou CPF... (Clique para listar todos)"`), ocupando todo o espaço visual no mobile e quebrando seletor de busca em testes quando encurtado sem o padrão `/Clique para listar todos/i`.
  4. Em botões de abas responsivas (`tabs`) e ações com textos compactos no mobile, a alteração de rótulos visuais para telas pequenas sem preservação de `aria-label` causa quebra em suites de teste do Testing Library que utilizam seletores semânticos acessíveis (`getByRole('tab', { name: ... })`).
- **Mitigação / Regra**:
  1. Contenção global e local:
     - Adicionar `overflow-x-hidden w-full max-w-full` na raiz (`html, body` em `src/index.css`) e no container mestre (`AppLayout.tsx`), associado a `min-w-0` em containers flex/grid.
     - Em telas com cabeçalhos com múltiplos botões de ação, empilhar em coluna no mobile (`flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3`) com botões principais em largura total (`w-full sm:w-auto`).
  2. Em cards e KPIs densos:
     - No `PainEvolutionChart.tsx`, adotar grid 2x2 ou cards compactos com padding reduzido (`p-2.5 sm:p-3.5`), rótulos concisos ("Dor Inicial", "Dor Atual", "Redução da Dor", "Média Recente") e valores autoajustáveis.
     - No `PackagesPage.tsx`, migrar de 4 cards em coluna única com altura excessiva para grid 2x2 responsivo (`grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4`), reduzindo mais de 250px de altura desnecessária na rolagem móvel.
  3. Preservação de acessibilidade e seletores de teste:
     - Ao compactar visualmente botões e abas para mobile (`<span className="sm:hidden">...</span><span className="hidden sm:inline">...</span>`), incluir sempre `aria-label` com o nome semântico completo esperado por leitores de tela e testes automatizados.
     - No campo de busca do paciente, manter o termo funcional `"Buscar... (Clique para listar todos)"`, harmonizando espaço móvel e estabilidade da suíte.
- **Validação**: 52 arquivos de teste e 287 testes aprovados com 100% de sucesso no Vitest, mais 3 testes de service worker aprovados. Typecheck TypeScript (`tsc -b`) com 0 erros.

### [2026-09-18] Determinismo Temporal em Testes com Seleção Dinâmica de Dia e Revisão Mobile-First Integral
- **Ponto de Fricção**:
  1. No Agendamento Rápido (`QuickBookingPage.tsx`), a data padrão de visualização da grade semanal é inicializada via `getTodayDateString()` (fuso `America/Sao_Paulo`). No teste de integração `tests/quick-booking-enhancements.test.tsx`, o mock de dados da grade semanal continha um slot registrado com data fixa `'2026-09-17'`. Quando a data real do sistema mudou para `2026-09-18`, a grade filtrou apenas slots do dia corrente, não encontrando o slot e falhando a busca pelo badge `'2/8'` (`Unable to find an element with the text: 2/8`).
  2. Em refatorações para telas pequenas (smartphones de 360px a 430px), tabelas com muitas colunas (ex: grade semanal de salas e atendimentos por fisioterapeuta) sofrem compressão severa de células ou estouram a viewport se não tiverem proteção de scroll horizontal ou conversão inteligente para cartões empilhados.
- **Mitigação / Regra**:
  1. Em testes unitários ou de integração que renderizem páginas com inicialização baseada na data atual (`getTodayDateString()`), aplicar sempre mock determinístico da data via `vi.mock('@/lib/dateUtils', ...)` fixando a data de referência dos mocks (ex: `getTodayDateString: () => '2026-09-17'`), assegurando independência da virada de dia e execução 100% reproduzível.
  2. No layout Mobile-First:
     - Adotar touch targets mínimos de 44px e safe areas com `pb-[calc(...,env(safe-area-inset-bottom,0px))]` em menus de navegação fixos.
     - Em modais de formulário, aplicar `w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto`.
     - Em tabelas com múltiplas colunas de dados, prover alternativa em cards empilhados (`< md`) e alternadores rápidos de visualização (ex: abas por dia da semana no `AvailabilityManagerModal` e seletor rápido de ambiente no `WeeklyScheduleGrid`).
- **Validação**: 52 arquivos de teste e 287 testes aprovados com 100% de sucesso no Vitest, mais 3 testes de service worker aprovados. Typecheck TypeScript (`tsc -b`) sem nenhum erro.

### [2026-09-17] Clareza Métrica na Agenda: Vagas Ocupadas vs Cadastros de Pacientes
- **Ponto de Fricção**:
  1. Na barra de métricas da Agenda (`ScheduleMetricsBar.tsx`), o card de ocupação exibia o rótulo `"Alunos / Vagas"` com a contagem total de matrículas somadas em todas as sessões do período selecionado (ex: 17 agendamentos em 40 sessões no mês para 2 pacientes com aulas recorrentes).
  2. Isso gerava discrepância cognitiva com a tela "Pacientes & Alunos", que exibia apenas 2 pacientes cadastrados, levando o usuário a crer que o sistema estava exibindo 17 pacientes cadastrados em vez de 17 vagas preenchidas.
- **Mitigação / Regra**:
  1. No `ScheduleMetricsBar.tsx`, substituir o rótulo para `"Vagas Ocupadas"` (mantendo coerência direta com o card vizinho `"Vagas Livres"` e a taxa de `"Ocupação"`).
  2. Adicionar tooltip semântico no card informando o total de vagas ocupadas e a quantidade de pacientes únicos atendidos no período (ex: `17 vaga(s) ocupada(s) em 40 sessão(ões) (2 pacientes únicos)`).
- **Validação**: Novo teste unitário em `tests/schedule-metrics-bar.test.tsx` cobrindo o novo rótulo, cálculos de métricas e ausência de `"Alunos / Vagas"`. 287 testes Vitest em 52 arquivos e 3 testes de service worker aprovados com 100% de sucesso. Typecheck TypeScript (`tsc -b`), build Vite de produção e oxlint aprovados com 0 erros.

### [2026-09-17] Provisionamento de Usuário Administrador e Escapamento de Argumentos JSON no PowerShell
- **Ponto de Fricção**:
  1. Ao executar comandos do CLI do Convex (`npx convex run [action] [args]`) via PowerShell no Windows para provisionar usuários com senhas complexas que incluem `@` (ex: `@clinica2026`), o PowerShell interpreta o `@` como operador de splatting/array caso não esteja explicitamente entre aspas, e ao passar argumentos JSON com aspas simples `'{"..."}'`, o PowerShell remove as aspas internas antes de entregar ao binário, causando erro de parsing de JSON5.
  2. A criação de usuários via `authActions:provisionUser` exige senha com no mínimo 12 caracteres (conforme hardening de segurança) e hash scrypt com salt criptográfico único, além de invalidação proativa de sessões antigas.
- **Mitigação / Regra**:
  1. Para invocar actions do Convex com JSON no PowerShell sem risco de stripping de aspas ou interpretação indevida de caracteres especiais (`@`), encapsular o payload com escape `\"` ou executar via script Node (`child_process.spawnSync`).
  2. O usuário admin `marcelo@gmail.com` foi provisionado com perfil `admin` e vinculado ao registro profissional do Dr. Marcelo tanto no deployment de produção (`exuberant-guanaco-180`) quanto no ambiente de desenvolvimento local, validado com teste de autenticação real via `authActions:login` e encerramento imediato de sessão de teste.
- **Validação**: Login com credenciais conferido e aprovado retornando token de sessão e perfil `admin`. 286 testes Vitest em 51 arquivos e 3 testes de service worker aprovados com 100% de sucesso.

### [2026-09-17] Blindagem Sistêmica: DoS em Rate Limit Global, Content-Security-Policy e Resiliência em Logout e Timers
- **Ponto de Fricção**:
  1. Em `convex/auth.ts`, a limitação de taxa de login aplicava uma chave compartilhada (`login:global`). Caso um ator malicioso disparasse 100 requisições incorretas seguidas, toda a equipe da clínica (administradores, médicos e recepção) ficava impedida de acessar o sistema por 15 minutos.
  2. No `vercel.json`, a ausência de um cabeçalho explícito de `Content-Security-Policy` (CSP) deixava brechas teóricas para injeção de scripts e requisições a origens desconhecidas.
  3. No Portal do Paciente (`PatientPortalPage.tsx`), caso a chamada de rede para invalidar a sessão no servidor falhasse (ex: queda de conexão móvel), o fluxo de logout era abortado precocemente por um `return` no bloco `catch`, retendo o token local no `sessionStorage` e impedindo o paciente de deslogar.
  4. Múltiplos componentes modais (`AvailabilityManagerModal`, `BroadcastSender`, `MessageTemplateBuilder`, `PatientPortalPage`) disparavam `setTimeout` para limpeza de toasts de feedback sem reter a referência do timer para descarte (`clearTimeout`), provocando potenciais alertas de vazamento de memória e tentativas de atualização de estado após o desmonte.
  5. Em `convex/finance.ts`, o resumo de fluxo de caixa quando solicitado para todo o histórico (`!args.monthYear`) truncava o cursor em `.take(200)`, corrompendo somatórios de faturamento se a clínica ultrapassasse 200 lançamentos.
- **Mitigação / Regra**:
  1. Em `convex/auth.ts`: remover a chave global `login:global` e manter a blindagem estrita de 5 tentativas por usuário específico (`login:${email}`) em janela de 15 minutos, impedindo negação de serviço a usuários legítimos.
  2. No `vercel.json`: adicionar o header `Content-Security-Policy` restringindo origens e liberando apenas o backend oficial Convex (`*.convex.cloud`), conexões locais para desenvolvimento, ViaCEP (`viacep.com.br`), WhatsApp Uazapi e scripts locais da aplicação.
  3. No `PatientPortalPage.tsx`: encapsular a limpeza de sessão do paciente (`sessionStorage.removeItem`) e os resets de aba em bloco `finally`, garantindo logout no dispositivo independentemente do status da rede.
  4. Nos componentes com feedback assíncrono: implementar controle via `useRef` e descarte com `useEffect` de retorno (`clearTimeout`), prevenindo memory leaks.
  5. Em `convex/finance.ts`: substituir `.take(200)` por `.collect()`, garantindo que os totais financeiros reflitam a integralidade das movimentações.
  6. No `shared/bookingTime.ts`: assegurar preenchimento de hora (`09:00`) para ordenação e comparação lexicográfica robusta.
  7. Manter a senha padrão `@mudar123` em `shared/patientIdentity.ts` conforme exigência operacional da clínica.
- **Validação**: 286 testes Vitest em 51 arquivos e 3 testes de service worker aprovados com 100% de sucesso. Typecheck TypeScript (`tsc -b`) sem erros, oxlint com 0 erros, e build de produção Vite concluído com sucesso em 1.15s.

### [2026-09-17] Exibição Confiável do Logotipo no Menu Lateral (Eliminação de Blobs no LocalStorage e Precedência do Servidor)
- **Ponto de Fricção**:
  1. Ao trocar o logotipo da clínica via upload em `SettingsPage.tsx`, o arquivo era enviado com sucesso ao Convex Storage (`data.storageId`), mas o estado local mantinha a prévia `URL.createObjectURL(file)` (`blob:http...`).
  2. Ao clicar em "Salvar Todas as Configurações", a função `updateClinicInfo` repassava o `blob:` temporário para o `ThemeContext`, que o serializava no `localStorage` sob a chave `altar_fisio_theme`.
  3. No `ThemeContext.tsx`, `userOverrides` lia o `localStorage` na inicialização e o `useMemo` dava precedência absoluta para `userOverrides.logoUrl !== undefined` sobre `serverLogo` vindo do Convex. Como os blobs expiram ou são inválidos após navegação/reloads, a tag `<img>` da sidebar disparava `onError={() => setLogoError(true)}`, ativando o fallback permanente do ícone verde `HeartPulse` com o texto da marca no menu lateral, enquanto na tela de configurações a logo continuava visível (pois lia diretamente `convexSettings.logoUrl`).
  4. O upload no card de logotipo não gravava a alteração no banco de forma imediata, dependendo de o usuário rolar a página inteira e clicar no botão "Salvar Todas as Configurações" no rodapé.
- **Mitigação / Regra**:
  1. No `ThemeContext.tsx`:
     - O `localStorage` (`altar_fisio_theme`) deve persistir EXCLUSIVAMENTE preferências de cliente do dispositivo (`mode`, `preset`, `customHex`). Dados institucionais (`logoUrl`, `clinicName`, `clinicSubtitle`, `phone`, `address`, `cnpj`) são de autoridade central do banco de dados Convex (`serverLogo`).
     - Rejeitar na inicialização e na derivação qualquer URL que comece com `blob:`, garantindo que a URL oficial do storage (`serverLogo`) tenha precedência incondicional.
  2. No `SettingsPage.tsx`:
     - Implementar persistência imediata no `handleLogoFileUpload` e no `handleApplyCustomUrl`: ao concluir o envio binário para o storage, disparar imediatamente a mutation no Convex, sincronizando a nova logo no menu lateral no mesmo segundo.
     - No salvamento, garantir que `logoUrl` nunca repasse strings de blob quando `logoStorageId` estiver definido.
  3. No backend Convex (`convex/clinic.ts`):
     - Sanitizar `args.logoUrl` em `updateSettings` para descartar qualquer valor `blob:` e limpar o campo caso `logoStorageId` esteja presente.
     - Em `getSettings` e `getAdminSettings`, nunca expor `blob:`.
- **Validação**: 2 novos testes dedicados em `tests/theme-logo-resilience.test.tsx` cobrindo sobrevivência contra blobs legados do `localStorage` e ausência de `logoUrl` no storage persistido. 286 testes Vitest em 51 arquivos e 3 testes de service worker aprovados 100%. TypeScript (`tsc -b`), build de produção com Vite e oxlint com 0 erros. Deploy Convex de produção `exuberant-guanaco-180` atualizado.

### [2026-09-17] Dinamização Fidedigna dos Dados da Clínica na Central de Documentos Clínicos e Adição do Campo CNPJ
- **Ponto de Fricção**:
  1. Na Central de Emissão de Documentos Clínicos (`DocumentGeneratorModal.tsx`), o cabeçalho timbrado continha dados estáticos/mockados em código (CNPJ `45.123.789/0001-90`, endereço fictício `Av. Paulista, 1000 - Cj. 42 • Bela Vista \n São Paulo - SP • CEP 01310-100` e telefone `(11) 99123-4567`). Mesmo que a clínica configurasse seu endereço e WhatsApp próprios, os documentos gerados continuavam exibindo os dados falsos.
  2. O schema do Convex (`convex/schema.ts`) e a tela de configurações (`SettingsPage.tsx`) não contemplavam o campo formal de CNPJ da clínica, impossibilitando que o gestor informasse seu registro legal.
  3. No rodapé dos documentos, a data e praça estavam rigidamente gravadas como `São Paulo - SP, ...`, e o texto de consentimento da LGPD no modelo TCLE citava compulsoriamente a "Altar Fisio", ignorando clínicas que customizaram o nome do estabelecimento no sistema.
- **Mitigação / Regra**:
  1. Adicionar o campo `cnpj: v.optional(v.string())` à tabela `clinicSettings` no `convex/schema.ts`, expondo-o nas queries `getSettings`/`getAdminSettings` e na mutação `updateSettings` em `convex/clinic.ts`.
  2. Criar os helpers universais `normalizeCnpj` e `formatCnpj` em `shared/patientIdentity.ts` e disponibilizar o campo com máscara no formulário de dados da clínica em `SettingsPage.tsx`.
  3. Estender o `ClinicThemeConfig` e `ThemeContext.tsx` para derivar e propagar reativamente `phone`, `address` e `cnpj`.
  4. Em `DocumentGeneratorModal.tsx`:
     - Renderizar dinamicamente o CNPJ (omitindo o bloco caso não esteja configurado, sem exibir dados fictícios).
     - Quebrar e renderizar de forma harmônica as linhas do endereço oficial configurado.
     - Exibir o telefone/WhatsApp configurado da clínica.
     - Derivar a Cidade - UF do endereço oficial da clínica para a praça timbrada de data (ex: `Campinas - SP, 17 de setembro de 2026.`).
     - Substituir todas as menções estáticas a "Altar Fisio" no TCLE, assinaturas e autenticidade pelo nome oficial configurado da clínica (`clinicDisplayName`).
- **Validação**: 4 novos testes unitários dedicados em `tests/clinical-document-clinic-info.test.tsx` cobrindo cabeçalho timbrado com CNPJ/endereço/telefone reais, derivação de praça/data, texto LGPD com nome customizado e ausência de dados fictícios quando sem CNPJ. 284 testes Vitest em 50 arquivos e 3 testes de service worker aprovados 100%. Typecheck TypeScript (`tsc -b`), build Vite de produção e oxlint com 0 erros. Deploy Convex de produção `exuberant-guanaco-180` atualizado com sucesso.


- **Ponto de Fricção**:
  1. No Agendamento Rápido, a mensagem de confirmação enviada pelo WhatsApp utilizava texto fixo no código (`buildDefaultMessage`) e não consultava o template configurado em `clinicSettings.activeConfirmationTemplateId`, fazendo com que alterações salvas em "Modelos de Lembretes" não afetassem as mensagens geradas pelo balcão.
  2. Na tela de Modelos de Lembretes (`MessageTemplateBuilder.tsx`), os modelos salvos na coluna esquerda não exibiam botão explícito de edição (apenas a lixeira), e o seletor superior ("Ao Agendar:") permitia apenas escolher uma opção, sem atalho direto para abrir o modelo no editor central, dificultando a localização da edição pelo administrador.
  3. No TypeScript, declarar `let messageToSend = args.customMessage?.trim()` seguido de reatribuição condicional causou erro TS2322 em chamadas de mutation do Convex que exigem `v.string()`. Tipagem explícita com `string = ... || ''` assegura type safety em todo o fluxo.
- **Mitigação / Regra**:
  1. Implementar a query protegida `whatsapp:getActiveConfirmationTemplate` e conectar reativamente o modal de resumo (`WhatsAppSummaryModal.tsx`) e a mutation `quickBooking:sendQuickBookingWhatsApp`, interpolando tags inteligentes (`{{paciente}}`, `{{clinica}}`, `{{servico}}`, `{{profissional}}`, `{{sala}}`, `{{regras}}` e `{{datas}}`).
  2. Na tela de Modelos de Lembretes, adicionar o botão `[ ✏️ Editar ]` ao lado do seletor superior "Ao Agendar" (e demais gatilhos) e em cada card salvo, acompanhado da badge informativa `📌 Ao Agendar (Agendamento Rápido)` e das novas tags (`{{datas}}`, `{{horario_fim}}`, `{{telefone_clinica}}`).
  3. Quando "Texto Padrão da Clínica" estiver selecionado e o usuário clicar em "Editar", o sistema carrega o preset pronto no editor com a categoria correta para facilitar a customização imediata.
- **Validação**: 280 testes Vitest em 49 arquivos (incluindo testes dedicados em `tests/quick-booking-whatsapp-summary.test.tsx` e `tests/message-template-builder.test.tsx`) e 3 testes de service worker aprovados 100%. Typecheck TypeScript (`tsc -b`), build Vite de produção e oxlint com 0 erros. Backend Convex de produção `exuberant-guanaco-180` atualizado com sucesso.

### [2026-09-17] Remoção de Bloco Invasivo de Falhas de WhatsApp e Expurgos de Jobs na Manutenção do Convex
- **Ponto de Fricção**:
  1. Na tela de Lembretes WhatsApp/Email (`NotificationsPage.tsx`), o componente `<AppointmentDeliveryProblems />` exibia um card amarelo permanente ("WhatsApp: envios que precisam de atenção") contendo registros repetidos de envios que falharam ou retornaram sem confirmação do provedor ("Envio não confirmado pelo provedor. Confira o WhatsApp antes de reenviar."). Não havia botão para dispensar, descartar ou limpar os avisos, mantendo o card eternamente travado na interface.
  2. Na rotina de manutenção diária (`convex/maintenance.ts`), apenas jobs de lembretes com status `sent` e `skipped` eram expurgados; jobs com status `failed` e `uncertain` nunca eram limpos pelo lote automático, gerando acúmulo de dados na tabela `appointmentJobs`.
  3. Para o deploy Convex na nuvem (`npx convex deploy`), o `.env.local` contém `CONVEX_DEPLOYMENT=anonymous:...`, o que faz o CLI tentar publicar no ambiente local anônimo a menos que a variável seja explicitamente sobrescrita como `$env:CONVEX_DEPLOYMENT="exuberant-guanaco-180"`.
- **Mitigação / Regra**:
  1. Remover `<AppointmentDeliveryProblems />` da `NotificationsPage.tsx` e deletar o componente órfão `src/components/whatsapp/AppointmentDeliveryProblems.tsx`, mantendo a tela limpa e direcionando a visualização de falhas exclusivamente para a aba "Histórico & Auditoria".
  2. Implementar as mutações `appointmentNotifications:clearProblems` (para uso autenticado por admin/reception) e `appointmentNotifications:clearProblemsInternal` (para execução interna/CLI) no backend Convex, autorizadas em `shared/accessPolicy.ts`.
  3. Atualizar a rotina de manutenção diária em `convex/maintenance.ts` para também expurgar jobs com status `failed` e `uncertain` com mais de 15 dias, evitando retenção indefinida no tier gratuito do Convex.
  4. Executar com sucesso a limpeza remota em produção (`appointmentNotifications:clearProblemsInternal`), eliminando os 10 registros travados na nuvem.
- **Validação**: 276 testes Vitest em 49 arquivos (incluindo testes dedicados em `tests/notifications-problems-removed.test.ts` e `tests/notification-logs-ui.test.tsx`) e 3 testes de service worker aprovados 100%. Typecheck TypeScript (`tsc -b`), build Vite de produção e oxlint com 0 erros. Deploy Convex de produção `exuberant-guanaco-180` atualizado e commit enviado para a branch `main` no GitHub.


### [2026-09-17] Exibição Exclusiva de Logotipo sem Textos Redundantes na Identidade Visual do Sistema
- **Ponto de Fricção**:
  1. No cabeçalho da barra lateral desktop, cabeçalho mobile e tela de login, quando uma clínica configurava ou alterava o logotipo do sistema (`theme.logoUrl`), a imagem ficava confinada em um quadrado rígido reduzido (40x40px), e ao lado eram exibidos o nome e o subtítulo da clínica (`theme.clinicName` e `theme.clinicSubtitle`), causando truncamento de texto ("Clínica de Fisioterapi..."), poluição visual e redundância gráfica (a maioria dos logotipos de clínicas já inclui o nome da empresa na própria imagem).
  2. Em caso de URLs externas quebradas ou indisponíveis, a tag `<img>` nativa exibia o ícone padrão de imagem quebrada do navegador acompanhado do texto alternativo `alt` cortado dentro do box.
- **Mitigação / Regra**:
  1. Em `AppLayout.tsx` (sidebar desktop, mobile header e mobile drawer) e `LoginPage.tsx`: quando `theme.logoUrl` estiver definido e for válido (`hasValidLogo`), remover todo o texto da marca (`clinicName` e `clinicSubtitle`) e renderizar exclusivamente o logotipo.
  2. Na sidebar desktop, o logotipo recebe espaço livre amplo (`max-h-11 w-auto max-w-full object-contain object-left`), sem background ou bordas comprimidas, com clique rápido para direcionar ao Dashboard. Quando a sidebar é recolhida, o logotipo é centralizado de forma harmônica (`max-h-9 max-w-9 object-contain`).
  3. Implementar controle de erro reativo com `onError={() => setLogoError(true)}`: caso a URL da imagem esteja inacessível ou falhe na rede, o sistema ativa um fallback suave para o ícone padrão `HeartPulse` e os textos, evitando quebras visuais na tela.
  4. Em `SettingsPage.tsx`, atualizar a prévia contextual "Na Sidebar:" para refletir fielmente a exibição ampla e exclusiva do logotipo sem a caixinha reduzida.
- **Validação**: 5 novos testes dedicados em `tests/layout-logo-display.test.tsx` cobrindo exibição exclusiva da logo, remoção do texto da marca, fallback por `onError` e comportamento na tela de login. 272 testes Vitest em 48 arquivos e 3 testes de service worker aprovados 100%, typecheck TypeScript (`tsc -b`) com 0 erros, oxlint com 0 erros, build Vite de produção gerado com sucesso. Commit `92035ab` enviado para a branch `main` no GitHub e deploy Convex de produção `exuberant-guanaco-180` atualizado com sucesso.

### [2026-09-17] Remarcação e Desmarcação Ágil na Agenda Rápida (Sem Créditos/Portal) e Isolamento de Handlers Convex
- **Ponto de Fricção**:
  1. Pacientes solicitam remarcações com alta frequência e a clínica não utiliza portal do cliente nem sistema de créditos; todos os agendamentos são operados pela recepção na Agenda Rápida. Faltava uma forma direta e sem burocracia de visualizar as próximas aulas do paciente e realizar a transferência para um novo horário ou cancelamento imediato de vaga.
  2. Em Convex, funções declaradas com `mutation({...})` são exportadas como `RegisteredMutation` e não expõem `.handler` invocável internamente por outras mutações. Tentar reutilizar mutações existentes dentro de novas mutações (ex: série recorrente) causa erros de execução/tipagem.
  3. A tabela `scheduleParticipants` não possui o índice composto `by_schedule_patient`, apenas `by_schedule` e `by_patient`, exigindo filtragem de paciente em memória nas consultas de sessão.
  4. Em agendamentos recorrentes (`recurringGroupId`), o operador precisava de controle explícito para escolher entre transferir apenas uma data avulsa ou mudar o dia fixo da semana para todas as semanas seguintes.
- **Mitigação / Regra**:
  1. No backend Convex (`convex/quickBooking.ts`):
     - Isolar a lógica atômica de remarcação no helper assíncrono interno `executeRescheduleSingle(ctx, { sessionToken, ... })`, reutilizado tanto por `rescheduleParticipant` quanto por `rescheduleSeriesParticipant`.
     - Criar a mutação `rescheduleSeriesParticipant` para recalcular e mover todas as participações futuras de uma série mantendo a integridade de turmas e salas.
     - Criar `cancelQuickBookingParticipant` para liberar a vaga no ato, cancelar lembretes agendados e disparar processamento da fila de espera (`processWaitlist`).
     - Enriquecer `getPatientBookingContext` com `upcomingAppointments` (datas a partir de hoje com sala, horário, status e flag de turma fixa).
     - Adicionar permissões em `shared/accessPolicy.ts` para perfis `admin` e `reception`.
  2. No frontend (`QuickBookingPage.tsx` e componentes):
     - Adicionar o card `PatientUpcomingSessionsCard` logo abaixo da seleção de paciente, exibindo as próximas aulas e botões diretos de `Remarcar` e `Desmarcar`.
     - Ao clicar em `Remarcar`, se a sessão pertencer a uma série recorrente, abrir `RescheduleScopeDialog` para o atendente escolher entre "Apenas esta data" ou "Mudar dia fixo da semana para todas as semanas seguintes".
     - Ativar o modo de remarcação visual na grade semanal com banner superior contextual e clique direto em horário com vaga disponível para confirmar a transferência.
     - Ao concluir a transferência, abrir automaticamente o `WhatsAppSummaryModal` com mensagem personalizada pronta para envio informando a data/horário anterior e a nova marcação.
- **Validação**: 272 testes Vitest em 48 arquivos aprovados 100% (incluindo `tests/quick-booking-rescheduling.test.tsx` e `tests/quick-booking-enhancements.test.tsx`), typecheck TypeScript (`tsc -b`) sem erros, oxlint com 0 erros e build Vite de produção gerado com sucesso.

### [2026-09-17] Higienização de Títulos de Turmas e Nomes Legíveis de Modalidades (Eliminação de Underscores de Slugs)
- **Ponto de Fricção**:
  1. No Agendamento Rápido (`convex/quickBooking.ts`), ao materializar uma turma ou agendamento, o título era gerado diretamente a partir do identificador da especialidade (`args.specialty.charAt(0).toUpperCase() + args.specialty.slice(1)`). Quando a especialidade cadastrada possuía slug interno (ex: `pilates_e_fortalecimento_muscula`), o título gerado exibia underscores (`Pilates_e_fortalecimento_muscula 09:00`), divergindo do nome oficial da sala ("Pilates e Fortalecimento Muscular").
  2. Na Ficha do Paciente (`PatientProfileModal.tsx`), a coluna "TURMA / MODALIDADE" e o card de "Próximas Sessões Marcadas" exibiam diretamente `item.specialty` e `sched.title` brutos do banco, expondo `Pilates_e_fortalecimento_muscula` em vez do nome amigável da modalidade e da sala.
  3. No modal de resumo de WhatsApp (`WhatsAppSummaryModal.tsx`) e detalhes do slot (`RoomDrawer.tsx`), a especialidade também herdava o slug técnico com underscores.
- **Mitigação / Regra**:
  1. Criar helpers universais em `shared/clinicalSpecialties.ts`:
     - `formatSpecialtyName`: resolve o nome da especialidade priorizando o catálogo da clínica (`clinicSettings.clinicalSpecialties`), salas ou conversão limpa de underscores para texto natural com conectivos em caixa baixa.
     - `formatScheduleTitle`: normaliza títulos que contenham underscores ou slugs técnicos, associando-os ao nome da sala correspondente e preservando horários (ex: `Pilates e Fortalecimento Muscular 09:00`).
  2. No backend Convex (`convex/quickBooking.ts`), gerar títulos limpos na criação (`${room.name || specialtyDisplayName} ${args.startTime}`) e higienizar na query da grade semanal.
  3. No `convex/schedules.ts`, normalizar reativamente `enrichSchedule` e `listSchedulesForPatient`, além de disponibilizar a mutation administrativa `schedules:sanitizeScheduleTitles` e rotina preventiva em `convex/maintenance.ts` para registros persistidos no banco.
  4. No frontend (`PatientProfileModal.tsx`, `RoomDrawer.tsx`, `WhatsAppSummaryModal.tsx`), higienizar exibições de título e modalidade para garantir consistência visual idêntica à lista de salas.
- **Validação**: 262 testes Vitest em 46 arquivos aprovados 100% (incluindo `tests/class-modality-formatting.test.tsx`), typecheck TypeScript (`tsc -b`) sem erros, oxlint com 0 erros e build Vite de produção gerado com sucesso.

### [2026-09-17] Resumo Único de WhatsApp no Agendamento Rápido e Clareza de Marcações na Ficha do Paciente
- **Ponto de Fricção**:
  1. No Agendamento Rápido, ao agendar sessões recorrentes (ex: segundas e quartas ao longo do mês), o sistema disparava múltiplos WhatsApps individuais (um para cada dia agendado, totalizando 8 a 10 mensagens simultâneas), gerando spam ao paciente, e não permitia ao operador revisar ou editar o texto antes do disparo.
  2. Após agendar, a Ficha do Paciente (`PatientProfileModal`) exibia "0 turma(s) encontrada(s)" e histórico zerado, porque a query `schedules:listSchedulesForPatient` não estava autorizada em `shared/accessPolicy.ts` e o hook customizado `useQuery` de `staffConvex.ts` forçava silenciosamente `'skip'`.
  3. Sessões recorrentes com `recurringGroupId` eram tratadas como avulsas no KPI superior (exibia "Avulso / Sem turma") porque o filtro checava apenas `type === 'turma'`, e a aba principal "Visão Geral" não mostrava um card com os próximos agendamentos confirmados.
  4. O componente `PatientProfileModal` possui uma folha oculta de impressão (`#printable-patient-sheet`), duplicando nomes de salas e profissionais no DOM e quebrando consultas estritas `screen.getByText` em testes com Testing Library.
- **Mitigação / Regra**:
  1. Em `convex/quickBooking.ts`, substituir o laço de envio individual por uma única chamada à action interna `sendQuickBookingSummaryAction` (`convex/notifications.ts`), enviando um WhatsApp consolidado com todas as datas/horários (`• Seg, 08/09 às 08:00`) e suporte a mensagem editada customizada (`customMessage`).
  2. Criar o componente `WhatsAppSummaryModal.tsx` no Agendamento Rápido, permitindo ao atendente revisar, editar livremente o texto ou optar por não enviar antes do disparo.
  3. Adicionar `'schedules:listSchedulesForPatient': ['admin', 'professional', 'reception']` em `shared/accessPolicy.ts`.
  4. No `PatientProfileModal.tsx`, agrupar sessões recorrentes por `recurringGroupId || isRecurring || type === 'turma'` para calcular a turma fixa no cabeçalho (ex: `Seg e Qua 08:00`), e adicionar a seção nobre "Próximas Sessões Marcadas" com grid de encontros, salas e profissionais na aba "Visão Geral".
  5. Em testes do perfil do paciente, utilizar `screen.getAllByText(...).length).toBeGreaterThanOrEqual(1)` para nós que coexistam no modal e na ficha de impressão.
- **Validação**: 258 testes Vitest em 45 arquivos e 3 testes de service worker aprovados 100% (incluindo `tests/quick-booking-whatsapp-summary.test.tsx` e `tests/patient-profile-appointments-clarity.test.tsx`). Typecheck TypeScript (`tsc -b`) e oxlint com 0 erros.

### [2026-09-17] Exclusão Administrativa de Logs de Notificações e Testes de Abas Radix UI no Vitest
- **Ponto de Fricção**:
  1. No painel de Lembretes WhatsApp/Email (`NotificationsPage.tsx`), a aba "Histórico & Auditoria" exibia todos os disparos efetuados (com taxa de sucesso e erros acumulados durante testes, ex: `HTTP 401`), mas não havia nenhuma função no backend ou interface para o administrador expurgar os registros.
  2. Em testes com jsdom e Vitest no Radix UI (`@radix-ui/react-tabs`), simular apenas o evento `fireEvent.click(tab)` não ativa a mudança de aba, pois os gatilhos internos do Radix escutam `pointerDown` e teclas de acessibilidade (`Enter`/`Space`).
- **Mitigação / Regra**:
  1. Implementar as mutações protegidas `notifications:clearNotificationLogs` (exclusão total com contagem de registros deletados) e `notifications:deleteNotificationLog` (exclusão individual por ID) no backend Convex, restritas a administradores (`requireStaff(ctx, sessionToken, ["admin"])`).
  2. Registrar compulsoriamente a ação do administrador na tabela `auditLogs` (LGPD & COFFITO), registrando quem executou a limpeza e a quantidade de registros eliminados.
  3. Adicionar as permissões correspondentes em `shared/accessPolicy.ts` (`"notifications:clearNotificationLogs": ["admin"]`, `"notifications:deleteNotificationLog": ["admin"]`).
  4. Na UI de `NotificationsPage.tsx`, disponibilizar o botão `"Excluir Todos os Logs"` no cabeçalho da tabela apenas para perfil administrador, acompanhado de diálogo modal de confirmação irreversível com alerta explicativo. Disponibilizar também o botão de lixeira individual em cada linha de log e no modal de detalhes.
  5. Em testes unitários que navegam entre abas do Radix UI no Vitest, utilizar o helper `activateTab(tab)` combinando `pointerDown`, `click` e `keyDown(Enter)`.
- **Validação**: 252 testes Vitest em 43 arquivos (incluindo testes dedicados em `tests/notification-logs-deletion.test.ts` e `tests/notification-logs-ui.test.tsx`) e 3 testes de service worker aprovados 100%. Typecheck TypeScript (`tsc -b`) aprovado com 0 erros, oxlint com 0 erros.

### [2026-09-17] Destaque Operacional da Lotação de Salas e Rebalanceamento do Dashboard
- **Ponto de Fricção**:
  1. A capacidade e ocupação física em tempo real das salas ficava comprimida na 3ª coluna lateral do Dashboard, com textos cortados (`max-w-[170px]`) e barras de 2px, dificultando a rápida tomada de decisão sobre vagas e turmas em andamento.
  2. O cabeçalho de ações continha o botão "Lançar SOAP" que gerava redundância com o fluxo de atendimento clínico e da timeline de pacientes.
- **Mitigação / Regra**:
  1. No `DashboardPage.tsx`, promover a Lotação das Salas para uma seção horizontal nobre logo abaixo dos KPIs operacionais com grid responsivo (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), exibindo a cor da sala, ocupação em tempo real (`0/5`, `4/8`), percentual, barra encorpada, status de momento (*Disponível*, *Em uso*, *Lotada*), detalhes da aula atual ou próxima prevista e total de alunos/turmas do dia.
  2. Remover a listagem antiga comprimida da coluna 3, evitando duplicação e dando respiro aos blocos de WhatsApp e Ações Rápidas.
  3. Remover o botão "Lançar SOAP" do cabeçalho superior.
- **Validação**: Novo teste automatizado em `tests/dashboard-room-occupancy.test.tsx` cobrindo ausência do botão SOAP e presença dos dados de capacidade e status de todas as salas. 244 testes Vitest em 41 arquivos e 3 testes de service worker aprovados 100%, typecheck TypeScript (`tsc -b`) sem erros, e build de produção Vite gerado com sucesso.

### [2026-09-17] Exclusão Resiliente de Instâncias WhatsApp (Uazapi) e Tratamento de Tokens Órfãos no Provedor
- **Ponto de Fricção**:
  1. Ao excluir uma instância no painel de WhatsApp, a action `whatsapp:deleteInstanceAction` realizava a chamada `DELETE /instance` na UAZAPI com o header `token` e exigia que a resposta fosse estritamente `res.ok === true` antes de disparar `removeInstanceInternal`.
  2. Caso a instância já tivesse sido deletada no servidor remoto da Uazapi ou seu token tivesse expirado, o provedor retornava `HTTP 401 Unauthorized` (ou `HTTP 404`). A action abortava a execução, impedindo que o registro fosse removido do banco Convex local e travando a instância permanentemente na interface.
  3. No frontend (`WhatsAppInstanceManager.tsx`), o bloco `catch` engolia o erro real do provedor exibindo apenas o texto genérico `"Erro ao excluir instância"`, sem fornecer contexto nem opção de forçar a exclusão local da clínica.
- **Mitigação / Regra**:
  1. Em `deleteInstanceAction` e `disconnectInstanceAction`, tratar retornos `401` e `404` do provedor como confirmação de que o recurso já não existe remotamente (`isAlreadyGoneOnProvider`), procedendo normalmente com a remoção ou desconexão no banco Convex.
  2. Adicionar o parâmetro opcional `force: boolean` em `deleteInstanceAction`: se o provedor falhar com erro interno (ex: `500` ou timeout), o administrador tem a opção explícita de forçar a exclusão local para desvincular a linha.
  3. Em `removeInstanceInternal`, buscar tanto por `instanceId` direto quanto por índice `by_token`, e limpar reativamente o campo `activeWhatsappInstanceToken` em `clinicSettings` se a instância excluída era a ativa/padrão.
  4. No modal de exclusão da interface, exibir o erro retornado pelo servidor e disponibilizar o botão `"Forçar Exclusão na Clínica"`.
- **Validação**: 242 testes Vitest em 40 arquivos (incluindo `tests/whatsapp-instance-deletion.test.ts` com cobertura de 401, 404 e force 500) e 3 testes de service worker aprovados 100%. Typecheck TypeScript (`tsc -b`) aprovado com 0 erros, oxlint com 0 erros, deploy Convex de produção `exuberant-guanaco-180` atualizado, remoção da instância travada confirmada em produção (`whatsapp:listInstances` retornando `[]`), e deploy Vercel `dpl_AY8qEd8BtoutneQhqc3Aou8SeCeC` concluído com sucesso.

### [2026-09-17] Agendamento Rápido em Coluna Única, Formatação de Nomes e Asserções DOM no Vitest
- **Ponto de Fricção**:
  1. A exibição de profissionais em slots da grade utilizava `slot.professionalName.split(' ')[0]`, o que isolava prefixos e fazia `"Dr. Marcelo"` ser exibido de forma truncada como apenas `"Dr."`.
  2. O matcher `toBeInTheDocument()` do Jest DOM não está configurado globalmente no Vitest deste projeto, disparando `Invalid Chai property: toBeInTheDocument`.
  3. A renderização do Agendamento Rápido com `<aside className="w-84">` comprimia os controles e a grade em duas colunas, e as descrições de parágrafo longo na recorrência mensal quebravam o layout vertical.
- **Mitigação / Regra**:
  1. Utilizar centralizadamente o helper `formatProfessionalDisplayName` (`src/lib/professionalUtils.ts`): profissionais com prefixo (`Dr.`, `Dra.`, `Prof.`) são exibidos como `"Dr Marcelo"`, `"Dra Larissa"`, e demais pelo primeiro nome (`"Gustavo"`, `"Claudia"`), mantendo o nome completo acessível no atributo `title` do slot.
  2. Em testes com Testing Library no Vitest deste repositório, utilizar asserções nativas com `expect(...).toBeTruthy()` e `expect(screen.queryByText(...)).toBeNull()` em vez de matchers externos não carregados.
  3. Na tela de Agendamento Rápido, organizar o layout em 1 coluna fluida com painel superior em grid (Paciente com dropdown completo ao focar/clicar, Especialidade e Recorrência sem parágrafos expansivos) e grade de horários ocupando 100% da largura, com alternador temporal `[ Dia | Semana | Mês ]`.
- **Validação**: 234 testes Vitest em 39 arquivos aprovados 100%, typecheck TypeScript (`tsc -b`) aprovado com 0 erros, build Vite de produção gerado com sucesso e oxlint com 0 erros.

### [2026-09-16] Especialidades Clínicas Dinâmicas no Agendamento Rápido (Eliminação de Mocks Estáticos)
- **Ponto de Fricção**:
  1. A tela de Agendamento Rápido (`QuickBookingPage.tsx`) possuía uma constante estática `SPECIALTIES` com opções legadas fixas em código (`pilates`, `fisioterapia`, `rpg`, `avaliacao`, `fortalecimento_muscular`).
  2. Isso causava discrepância com as especialidades ativas cadastradas nas configurações da clínica (`clinicSettings.clinicalSpecialties`) e quebrava o filtro da grade semanal, pois os IDs fixos não correspondiam aos IDs reais das regras de disponibilidade (ex: `pilates_e_fortalecimento_muscula`).
- **Mitigação / Regra**:
  1. Todas as páginas e componentes que exibem filtros ou seleção de especialidades devem consumir reativamente a query `api.clinic.getClinicalSpecialties` com fallback para `DEFAULT_CLINICAL_SPECIALTIES` de `shared/clinicalSpecialties`.
  2. Utilizar `useEffect` para sanitizar o estado de filtro selecionado caso uma especialidade seja removida ou renomeada dinamicamente pelo administrador.
- **Validação**: 227 testes Vitest em 38 arquivos e 3 testes de service worker aprovados 100%, typecheck TypeScript (`tsc -b`) aprovado com 0 erros, e oxlint com 0 erros.

### [2026-09-16] Otimização Extrema do Banco Convex para Permanência no Plano Gratuito (Hobby Tier)
- **Ponto de Fricção**:
  1. No Convex Free (Hobby), há limites estritos de 1 GB de armazenamento, 10 GB de bandwidth de leitura mensal e 1.000.000 de invocações de função.
  2. O cron `preparar-lembretes-1h-30min` rodava a cada 5 minutos varrendo em cascata todos os agendamentos futuros do banco (`appointmentNotifications.backfill`), consumindo mais de 43.200 chamadas de função por mês sem necessidade, já que os lembretes são preparados no momento em que cada paciente é agendado (`prepareReminders`).
  3. No frontend (`ClinicDataContext`), todos os usuários logados abriam 18 subscrições WebSocket reativas simultâneas, mantendo ativas queries pesadas de cálculo de comissões, relatórios clínicos, auditoria e logs de WhatsApp mesmo enquanto utilizavam apenas a Agenda.
  4. A função `enrichSchedule` executava centenas de leituras N+1 redundantes buscando as mesmas salas, profissionais, pacotes e serviços para cada participante em visualizações de semana/mês da agenda.
  5. Tabelas como `services`, `packages`, `patientPackages` e `availabilityRules` sofriam table scans por falta de índices compostos e de status.
  6. A rotina diária de manutenção não expurgava logs de auditoria nem jobs de lembrete finalizados, gerando acúmulo de dados a longo prazo.
- **Mitigação / Regra**:
  1. Mudar o cron de verificação de lembretes para execução preventiva diária às 04:00 BRT (`preparar-lembretes-preventivo`), economizando ~43.200 invocações mensais.
  2. Implementar subscrições reativas sob demanda em `ClinicDataContext` via prop `currentSection`: queries de páginas secundárias recebem `"skip"` quando o usuário está fora da respectiva seção (ex: comissões apenas em Finanças; auditoria em Configurações; logs de notificação na Central de Mensagens; SOAP apenas em Pacientes/Prontuário), reduzindo o bandwidth em mais de 70%.
  3. Adicionar índices dedicados no `schema.ts`: `services.by_active`, `packages.by_service`, `packages.by_active`, `packages.by_public_active`, `patientPackages.by_patient_status`, `availabilityRules.by_active`, `availabilityRules.by_day_active`, `clinicalEvolutions.by_patient_timestamp` e `appointmentJobs.by_status`.
  4. Introduzir cache de resolução em memória (`ScheduleEnrichmentCache`) durante a execução de `enrichSchedule` e `calculateProfessionalCommissions`, reduzindo leituras repetidas em mais de 80%.
  5. Na manutenção diária das 03:00 BRT (`runDailyMaintenance`), ampliar o lote para 300 itens e purgar logs de notificação (> 30 dias), logs de auditoria (> 60 dias), jobs de lembretes finalizados/descartados (> 15 dias) e sessões expiradas.
- **Publicação & Verificação**: Convex `exuberant-guanaco-180` atualizado em produção (`npx convex deploy`). Schema validado, 9 novos índices de alta performance adicionados sem remoção de índices existentes, crons de economia de chamadas e expurgos diários ativos na nuvem. Smoke test remoto nas queries `clinic:getClinicalSpecialties` e `clinic:getSettings` responderam com HTTP 200 e dados consistentes. 227 testes Vitest em 38 arquivos e 3 testes de service worker aprovados 100%, `tsc -b` aprovado com 0 erros, build Vite de produção gerado com sucesso e oxlint com 0 erros.

### [2026-09-16] Agendamento Rápido no Balcão: Remarcação sem Falta Indevida, Identificação de Séries Recorrentes e Compatibilidade com Node 25 no Convex
- **Ponto de Fricção**:
  1. Na mutação de remarcação rápida (`rescheduleParticipant`), desmatricular um paciente marcando seu registro anterior com `status: 'absence'` registra falta no prontuário e no relatório de frequência do paciente, além de não cancelar os jobs agendados de lembrete de WhatsApp (`cancelParticipantJobs`) e não acionar a fila de espera (`processWaitlist`) da vaga desocupada.
  2. Ao gerar agendamentos com recorrência mensal em lote no balcão, a ausência do campo `recurringGroupId` nas sessões impedia que a tela de turmas (`ClassesPage`) e mutações de gestão em lote (`deleteSchedule(deleteSeries: true)`) reconhecessem que aquelas aulas pertenciam a uma mesma turma/série mensal.
  3. No ambiente Windows com Node.js v25.x instalado, o backend local do Convex acusa `DeploymentNotConfiguredForNodeActions: Node.js v20, 22, or 24 is not installed` ao tentar inicializar ações locais com `"use node"`.
  4. Na `SchedulePage`, o botão principal de agendamento continuava abrindo o modal antigo caso não estivesse conectado via prop `onNavigate` à nova rota do Agendamento Rápido (`quick_booking`).
- **Mitigação / Regra**:
  1. Em qualquer fluxo de remarcação ou transferência de horário, cancelar os lembretes pendentes com `cancelParticipantJobs`, remover a inscrição anterior com `ctx.db.delete` sem imputar falta indevida e acionar `processWaitlist(ctx, oldScheduleId)` para liberar a vaga para pacientes que aguardam reposição.
  2. Ao criar agendamentos recorrentes em lote, gerar sempre um identificador único `recurringGroupId = rec_${Date.now()}_${random}` e gravar `isRecurring: true` nas sessões criadas.
  3. Para o runtime local do Convex em desenvolvimento que utilize actions em Node, priorizar versões LTS (Node 20 ou 22), ou delegar a execução de actions ao ambiente gerenciado na nuvem (`npx convex deploy`).
  4. Conectar sempre os botões de ação e gatilhos da agenda mãe (`SchedulePage`) à nova rota `quick_booking` passando `onNavigate={setCurrentSection}` e mantendo fallback caso o componente seja utilizado de forma isolada.
- **Validação**: 227 testes Vitest em 38 arquivos e 3 testes de service worker aprovados 100%, typecheck TypeScript (`tsc --noEmit`) aprovado com 0 erros.

### [2026-09-16] Bloqueio Silencioso por accessPolicy.ts, Persistência Imediata de CRUD e Diálogo Dedicado vs Layout Embutido
- **Ponto de Fricção**:
  1. No hook customizado `useQuery` de `src/lib/staffConvex.ts`, qualquer função do Convex que não esteja registrada no dicionário estático `accessPolicy` em `shared/accessPolicy.ts` é interceptada e recebe o valor `'skip'`. Isso fez `api.clinic.getClinicalSpecialties` retornar permanentemente `undefined` em tempo de execução no navegador (embora testes com mock passassem), deixando o estado da tela zerado ("Especialidades ativas (0)") e impossibilitando o carregamento da lista real salva no banco.
  2. A renderização do gerenciador de especialidades com `variant="embedded"` embutido diretamente dentro de uma coluna de 50% (`grid-cols-2`) no modal de regras semanais (`AvailabilityManagerModal.tsx`) espremia os campos de input, textos descritivos e botões numa largura de ~250px, quebrando a altura do formulário e gerando o efeito de "tela pequena e bugada".
  3. A separação entre o clique em "+ Adicionar" (que só salvava no rascunho de memória) e um botão de salvamento no rodapé gerava a percepção de que a funcionalidade "não estava funcionando", pois o usuário esperava que ao adicionar ou alterar um nome a mudança já estivesse persistida no banco.
- **Mitigação / Regra**:
  1. Sempre que novas queries ou mutations forem criadas no Convex para o painel de staff, adicioná-las imediatamente em `shared/accessPolicy.ts` (`"clinic:getClinicalSpecialties": "public"`, `"clinic:updateClinicalSpecialties": ["admin"]`). Funções públicas ou com leitura segura de configurações devem usar `'public'` na policy para não dependerem de token ou sofrerem bloqueio em páginas deslogadas.
  2. Nunca embutir componentes complexos de CRUD ou listas gerenciáveis dentro de colunas estreitas de formulários em modais. Utilizar sempre o padrão de Diálogo Dedicado (`ClinicalSpecialtiesDialog`) com largura ampla (`sm:max-w-xl`), foco isolado e fechamento suave, sincronizando a seleção no formulário pai via reatividade do Convex.
  3. No padrão de CRUD de configurações rápidas, adotar a persistência imediata com atualização otimista/síncrona do draft: o clique em Adicionar, Confirmar Edição (Check) ou Excluir grava diretamente no banco com feedback de sucesso/spinner, mantendo o botão geral "Salvar Especialidades" como garantia de segurança redundante.
- **Publicação & Verificação**: Convex `exuberant-guanaco-180` atualizado (`npx convex deploy`). Consulta remota `clinic:getClinicalSpecialties` respondeu com sucesso. Commit `2f9d11e` enviado para `origin/main` no GitHub. 227 testes Vitest em 38 arquivos aprovados 100%, `tsc -b` aprovado com 0 erros, build Vite de produção gerado com sucesso e oxlint com 0 erros.

### [2026-09-16] Gestão Dinâmica de Especialidades Clínicas (Criar, Editar e Excluir)
- **Ponto de Fricção**:
  1. No modal de "Novo Horário Semanal" e nas definições de serviços e turmas, as opções de especialidade eram fixas em código ("Fisioterapia Avançada", "Pilates (Solo & Aparelhos)", "RPG (Postural)") e validadas rigidamente no backend Convex através de unions literais `v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))`.
  2. A introdução de novas especialidades sem flexibilização de validadores causava falhas de schema nas mutações de horários e serviços.
  3. No Vitest sob jsdom, referências a funções do Convex (`api.clinic.getClinicalSpecialties`) não devem ser convertidas com `String(fn)` (dispara `TypeError: Cannot convert object to primitive value`).
- **Mitigação / Regra**:
  1. Modelar as especialidades como lista de objetos estruturados `{ id, name, description }` em `clinicSettings.clinicalSpecialties`, preservando 100% de compatibilidade retroativa com regras legadas cadastradas com `"fisioterapia"`, `"pilates"` e `"rpg"`, sem custo de leitura extra no banco.
  2. Flexibilizar os validadores do Convex para `v.string()` nas tabelas e mutações que gravam especialidades.
  3. Em mocks de testes com Convex, utilizar sempre a função oficial `getFunctionName(ref)` do pacote `convex/server` para identificar a query/mutation chamada com 100% de robustez.
  4. Implementar o componente modular `ClinicalSpecialtiesManager` com suporte a visualização em card nas Configurações da Clínica e visualização embutida (`variant="embedded"`) acionada pelo botão "Gerenciar especialidades" no próprio formulário de horários semanais.
- **Publicação Convex**: Backend Convex de produção `exuberant-guanaco-180` publicado com sucesso via `npx convex deploy`. Consulta remota de smoke `clinic:getClinicalSpecialties` respondeu com sucesso retornando as especialidades clínicas.
  1. A derivação de estado reativo em `ThemeContext.tsx` usava `convexSettings?.mode ?? localTheme.mode` e `convexSettings?.colorPreset ?? localTheme.preset`. Uma vez carregadas as configurações do Convex, os campos do servidor nunca retornavam nulo, tornando `localTheme` inatingível e ignorando 100% dos cliques em "Modo Escuro", alternador da barra lateral e seleção de paletas pré-definidas.
  2. O valor de cor primária persistido no banco e carregado no `customHex` continha a string HSL legada (`158 64% 38%`). Isso fazia o elemento nativo `<input type="color">` do modal quebrar e reverter para `#000000` (quadrado preto), além de travar a validação de regex hex ao tentar clicar em "Aplicar HEX".
  3. No `SettingsPage.tsx`, ao consolidar as configurações, `theme.customHex || ...` tinha prioridade sobre presets, reenviando a string HSL para o banco mesmo com um preset ativo.
- **Mitigação / Regra**:
  1. No `ThemeContext.tsx`, adotar o modelo de sobreposições ativas (`userOverrides`) inicializado pelo `localStorage` e combinado via `useMemo` com `serverDefaults` (`userOverrides.mode ?? serverMode ?? defaultTheme.mode`). Isso garante que escolhas ativas do usuário e preferências salvas tenham precedência imediata no navegador (0ms de latência e persistência instantânea) sem disparar warnings de `setState` em efeitos no React 19.
  2. Implementar e exportar a função `normalizeToHex`: converte valores HSL (ex: `158 64% 38%`), hexadecimais curtos (`#fff`) e nomes de presets para código hexadecimal estrito de 6 dígitos `#rrggbb`.
  3. No `ThemeCustomizerModal.tsx`, sincronizar os estados internos com a abertura do modal (`open`), garantindo que o color picker e o input HEX sempre recebam códigos válidos e atualizem o preset customizado em tempo real.
- **Publicação**: Convex `exuberant-guanaco-180` atualizado. Deploy Vercel `dpl_Ucg12h1UP3hKGKrmZmW5ZjwYDcfq` (READY), aliases `https://altar-fisio.vercel.app` e `https://clinicadrmarcelo.vercel.app`. Endpoints públicos (`/`, `/sw.js`) e consulta remota `clinic:getSettings` responderam com HTTP 200.
- **Validação**: 9 testes automatizados cobrindo normalização de cores, alternância para modo escuro, seleção de paletas e aplicação de HEX customizado em `tests/theme-customization.test.tsx`. Todos os 222 testes Vitest em 37 arquivos, 3 testes de service worker, TypeScript (`tsc -b`), build com Vite e oxlint aprovados 100%.

### [2026-09-10] Deploy de Produção: Carteira de Pacientes por Profissional ("Meus Pacientes")
- **Publicação**: Convex `exuberant-guanaco-180` atualizado com a query `patients:listAssignedPatientIds` protegida por privilégio mínimo (`requireStaff` e restrição compulsória para perfil `professional`). Deploy Vercel `dpl_3wsqyy9e5HoBDthtebqQ3gSD7XWk` (READY), aliases `https://altar-fisio.vercel.app` e `https://clinicadrmarcelo.vercel.app`.
- **Validação**: 213 testes Vitest em 36 arquivos e 3 testes de service worker aprovados; TypeScript (`tsc -b`), build com Vite e oxlint sem erros. Endpoints públicos (`/`, `/login`, `/portal`, `/agendar`, `/sw.js`) e consulta ao backend em produção responderam com sucesso (HTTP 200).

### [2026-09-09] Publicação conjunta das pendências de agendamento
- Publicado o estado local com bloqueio de horários vencidos, envio HTTP com recibo idempotente e histórico independente na ficha do paciente. Convex `exuberant-guanaco-180`: dry-run e deploy passaram, sem exclusão de índices; criado `publicBookingReceipts.by_request`.
- Vercel `dpl_D1aptzgPEr7Ut5eVGgFnsSGwDwXb`: READY, alias https://altar-fisio.vercel.app. Os 206 testes Vitest e 3 testes de service worker passaram, assim como TypeScript e build; lint sem erros, com avisos. Build local usa a URL real de produção definida somente no processo, pois `.env.local` aponta ao backend local e a proteção do Vite rejeita esse destino em produção.
- Consultas públicas de configuração e de horários passaram em produção; data passada retornou zero horários. `/`, `/login`, `/portal`, `/agendar` e `/sw.js` responderam HTTP 200; bundle publicado do agendamento é idêntico ao build validado. Consulta de logs Vercel do novo deployment não retornou registros. Não foram criadas reservas reais nem repetidos fluxos autenticados. Publicação direta do workspace, sem commit/push.

### [2026-09-09] Ficha da paciente dependia do período selecionado na Agenda
- **Ponto de Fricção**: A ficha calculava turmas, presenças e histórico a partir de `ClinicDataContext.schedules`, que contém somente o dia, semana ou mês atualmente selecionado na Agenda. Assim, matrículas persistidas fora desse intervalo apareciam corretamente no Portal do Paciente, mas a ficha administrativa mostrava incorretamente "Avulso / Sem turma".
- **Mitigação / Regra**: Telas de perfil devem consultar participações pelo índice `scheduleParticipants.by_patient`, sem depender do filtro global da Agenda. A query `schedules.listSchedulesForPatient` agora carrega exclusivamente o histórico da paciente aberta e mantém o isolamento por autenticação de funcionário.
- **Validação**: Produção confirmou 6 participações da Stefanie na mesma série recorrente. A regressão automatizada cobre matrículas em datas diferentes; 196 testes Vitest, 3 testes de service worker, TypeScript e build passaram. Convex e Vercel foram publicados; a ficha autenticada confirmou 1 turma ativa, 5 aulas agendadas e 1 falta justificada.

### [2026-09-09] Mensagens claras no Portal do Paciente, ConvexError em Produção e Prevenção Ativa de Conflitos de Remarcação
- **Ponto de Fricção**: No Convex Cloud em produção, o lançamento de exceções com `throw new Error(...)` padrão é mascarado automaticamente pelo runtime como erro interno não tratado (`[CONVEX ...] Server Error Called by client`), ocultando a mensagem real do paciente. Além disso, a exibição direta de `err?.message` no frontend expunha o prefixo técnico em vez de mensagens humanizadas, e o modal de remarcação permitia que o paciente clicasse em horários que conflitavam com outras aulas dele já agendadas.
- **Mitigação / Regra**:
  1. Todas as mutações e queries do portal do paciente (`convex/patientPortal.ts` e `convex/lib/security.ts`) DEVEM lançar `throw new ConvexError("Mensagem amigável")` da biblioteca `convex/values`. Isso garante que o Convex transporte a mensagem legível até o cliente sem mascarar.
  2. No frontend, utilizar centralizadamente a função `portalErrorMessage(err)` em todos os blocos `catch` do portal. Ela prioriza `err.data`, descarta mensagens técnicas do Convex (`[CONVEX`, `Server Error`, `Request ID`) e oferece fallback amigável em português.
  3. Na consulta de vagas para remarcação (`listAvailableSlotsForBooking`), incluir verificação de sobreposição com a grade ativa do paciente (`hasConflict`) e com a própria turma (`isAlreadyEnrolled`). Na UI, horários conflitantes ou lotados são sinalizados visualmente com badges dedicadas (`"Já agendado"`, `"Horário conflitante"`), esmaecidos e bloqueados contra seleção.
  4. Na remarcação de agendamentos vinculados a pacote (`patientPackageId`), remover a verificação `remainingSessions < 1`: a sessão já estava alocada no plano e trata-se de uma troca de data/horário (swap), não consumindo um novo crédito.
- **Validação**: 29 arquivos de teste passaram (190 testes Vitest), typecheck TypeScript (`tsc -b`), build de produção com Vite e deploy para Convex e Vercel passaram 100%.

### [2026-09-09] Design refinado do modal de turmas mensais com ícones elegantes e acessibilidade
- **Ponto de Fricção**: Em botões de seleção de frequência com micro-etiquetas adicionais (ex: `1×` acompanhado de subtítulo `dia/sem`), o texto acessível derivado pelo DOM concatena os elementos filhos (`"1× dia/sem"`), quebrando testes de acessibilidade e consultas que buscam rigorosamente `screen.getByRole('button', { name: '1×' })`.
- **Mitigação / Regra**: Atribuir sempre `aria-label={`${n}×`}` no botão para ancorar o nome acessível exato na árvore W3C de acessibilidade, preservando rótulos visuais complementares para o usuário.
- **Hierarquia Visual**: O modal `MonthlyBookingDialog` agora conta com ícones elegantes da Lucide (`CalendarCheck2`, `Sparkles`, `Calendar`, `Repeat`, `Clock`, `User`, `MapPin`, `CalendarDays`, `Users`, `CheckCircle2`), cabeçalho com badge de clínica e `pr-10` contra colisão do botão fechar, grid responsivo para plano e mês, cards com indicadores circulares de seleção, badges semânticos de vagas e conferência de datas com chips de status (`já reservado`, `nova vaga`).
- **Validação**: 29 arquivos de teste passaram (190 testes Vitest + 3 testes de service worker), typecheck TypeScript (`tsc -b`) e build de produção com Vite passaram 100%.

### [2026-09-09] Exclusão protegida da trilha de auditoria e vazamento de texto em thead sticky translúcido
- O uso de `bg-muted/50` em `thead` com `sticky top-0` causa vazamento visual do conteúdo das linhas durante a rolagem vertical, pois a transparência de 50% faz o texto das células roladas se fundir com os rótulos do cabeçalho (ex: `"OperadokMoreira"`). Para qualquer cabeçalho de tabela fixo no topo, aplicar classe opaca `bg-card` (ou `bg-background`) tanto no `thead` quanto nas tags `th`, acompanhado de `z-10 shadow-xs`.
- A exclusão em lote da trilha de auditoria deve ser restrita a administradores (`requireStaff(ctx, sessionToken, ["admin"])`) e acompanhada de confirmação modal explícita com alerta irreversível, evitando disparos acidentais. A exportação profissional sob demanda via biblioteca `xlsx` (SheetJS) gera planilhas `.xlsx` nativas, com larguras de coluna ajustadas (`!cols`) e 0 KB de impacto no bundle inicial da aplicação.
- Validação: 28 arquivos de teste passaram (183 testes Vitest + 3 testes de service worker), typecheck TypeScript (`tsc -b`) e build de produção com Vite passaram 100%.

### [2026-09-09] Mockup realista de celular no construtor de agendamento e isolamento de scrollbar
- Simular celular com janela de navegador desktop (bolinhas vermelha/amarela/verde e barra de URL) causava estranheza visual e quebrava a imersão de smartphone. O mockup mobile agora possui carcaça com acabamento titânio escuro em camadas, botões físicos laterais 3D (Ação, Volume e Power), Dynamic Island com lente óptica/sensor, barra de status completa (horário, 5G, Wi-Fi e bateria) e Home Indicator no rodapé.
- Em navegadores desktop rodando no Windows, a barra de rolagem de 6px do sistema reduz a largura útil do iframe de 390px para ~375px, colidindo com badges no cabeçalho. As classes utilitárias `.scrollbar-none` e `.no-scrollbar` foram aplicadas globalmente com `::-webkit-scrollbar { display: none }` e `scrollbar-width: none`, preservando a navegação suave por scroll e toque sem barras de rolagem estáticas.
- A faixa de demonstração no agendamento foi redesenhada como um aviso fino e elegante (`h-fit py-1.5 backdrop-blur`), evitando ocupar espaço precioso da tela útil do celular. Controles rápidos de recarregar e abrir em tela cheia foram adicionados ao painel do construtor.
- Validação: Todos os testes Vitest (170/170), testes de service-worker (3/3), typecheck TypeScript (`tsc -b`) e build de produção com Vite passaram 100%.

### [2026-09-09] Turmas mensais e controle administrativo de agendamento pelo portal
- Turmas mensais geradas com calendário real por mês e dias selecionados (`monthDates`), sem aproximação por 4 semanas, com prévia e prevenção atômica de conflitos de sala ou profissional.
- Matrícula pelo portal com fluxo multi-etapas: plano -> mês -> frequência (1 a 5x) -> seleção de turmas do mesmo tratamento -> revisão com lista de encontros -> confirmação atômica e idempotente (`monthlyBookingReceipts`). Saldo livre deduz compromissos futuros e créditos de reposição válidos.
- Fechamento do portal pelo administrador com editor visual rico (`PortalBookingSettings`), sanitização estrita no servidor (somente parágrafos/listas, negrito/itálico e links https/tel/mailto seguros) e persistência em `clinicSettings`. Quando fechado, todas as escritas no backend são bloqueadas por `assertPortalBookingOpen` e na interface os controles de novas reservas, remarcações e reposições são substituídos pelo aviso em destaque, interrompendo janelas abertas imediatamente.
- Ambiente Node 25 em testes com jsdom: o global experimental `localStorage` do Node moderno exige stub com `vi.stubGlobal('localStorage', ...)` para evitar `TypeError: localStorage.getItem is not a function`.
- Validação: Todos os 26 arquivos de teste (170 testes Vitest + 3 testes de service worker), typecheck TypeScript (`tsc --noEmit`), build de produção com Vite e verificação com oxlint passaram 100%.
- Publicação: Commit `3f156bb` enviado para a branch `main` no GitHub (`origin/main`). Deploy Convex de produção concluído com sucesso no deployment `exuberant-guanaco-180` (`https://exuberant-guanaco-180.convex.cloud`), com validação de schema e novo índice `monthlyBookingReceipts.by_patient_request`.

### [2026-09-09] Convênio sem preço no agendamento público
- Valores ausentes de convênio não devem usar a tabela particular como fallback. Página e persistência agora usam zero; preços públicos aparecem somente em Particular, inclusive na confirmação.
- Ao apagar preços de convênio na edição do pacote, enviar zero explicitamente: valores undefined são omitidos no transporte e podem preservar o preço antigo na atualização parcial.
- Validação local: 37 testes de agenda/convênios, TypeScript e build passaram. Esta correção ainda não foi publicada.

### [2026-09-09] Exclusão de solicitações e horários pelo administrador
- Publicação concluída: Convex `exuberant-guanaco-180` e Vercel `dpl_HQL1hqDSs69iUL1bHq2ifw6Q3Enf` (READY), alias `https://altar-fisio.vercel.app`. Os 43 testes da cópia de publicação, TypeScript e build passaram; HTTP 200 e ambos os controles foram verificados nos assets publicados. Nenhum registro real foi excluído.
- Produção estava à frente do HEAD: a primeira simulação com `git archive HEAD` foi rejeitada por não aceitar `bookingFormConfig.insurancePartners`, já persistido. A cópia de publicação precisou preservar as alterações locais de convênios/construtor; o segundo dry-run passou e a consulta posterior confirmou seis convênios. Antes de isolar releases pelo Git, verificar também a compatibilidade com o schema publicado.
- Solicitações públicas e sessões são registros separados. `deletePublicBooking` exige admin, registra auditoria e preserva sessão, participantes e paciente. A confirmação explica essa separação.
- Os detalhes da Agenda agora expõem a exclusão do horário ao admin, reutilizando `schedules.deleteSchedule` sem excluir a série. Essa operação existente remove todos os participantes daquele horário; a confirmação informa a quantidade afetada. As permissões preexistentes dessa operação para recepção/profissional foram preservadas.
- Validação local: 31 testes passaram (exclusão, controles e agendamento em grupo), TypeScript e build passaram. Sem publicação ou exclusão de registros reais. O build usa URL HTTPS fictícia apenas para validação e deve ser regenerado com o destino correto antes de publicar.

### [2026-09-09] Logos e edição estrutural do construtor
- Logos com largura fixa ultrapassavam os cards ao distribuir sete colunas. A grade agora usa até cinco colunas e imagens limitadas à largura interna; conferência visual com dados de teste em 390 e 1920 px não apresentou overflow.
- Convênios ficam em `bookingFormConfig.insurancePartners`. `undefined` mantém compatibilidade com os padrões; `[]` significa exclusão explícita. Salvar textos ou perguntas deve preservar a lista existente. Uploads aceitam PNG/JPG/WebP até 150 KB, com limite total de 600 KB; imagens maiores podem usar URL HTTPS.
- Excluir uma etapa de perguntas exige excluir seus campos e remover condições dependentes. Horário e identificação continuam obrigatórios, com validação também no backend. A pergunta deve apontar para uma etapa de formulário existente.
- Validação desta alteração: testes de persistência com convex-test, controles com Testing Library, build e layout estático renderizado dos componentes reais. Isso não comprova publicação ou fluxo autenticado em produção.


### [2026-09-09] Construtor divergente da agenda pública
- Manter um mock manual da agenda dentro do construtor fez a prévia ficar desatualizada quando a página pública ganhou planos, preços e logos de convênios.
- O construtor agora incorpora a própria rota `/agendar?preview=builder`, com visualizações de celular e desktop. O parâmetro de prévia bloqueia a mutação final, evitando reservas acidentais durante a simulação.
- O navegador isolado de validação local encerrou WebSockets do Vite e Convex com código 1006. Nessa condição, validar estrutura e segurança com testes/build e confirmar as queries públicas de produção via HTTP; a conferência visual completa com dados reativos deve usar um navegador comum ou a versão publicada.

### [2026-09-09] Agendamento público: pré-seleção de convênio e logos interativas
- A etapa 2 (Sessão & Horário) da agenda pública agora inicia por padrão com `Tenho Plano de Saúde` (`patientBillingType: "convenio"`), garantindo visibilidade imediata das opções de reembolso e valores conveniados.
- Os 6 parceiros de convênio do site (`Unimed`, `Amil`, `Saúde Petrobras`, `Bradesco Saúde`, `SulAmérica`, `BraSeg`) foram copiados para `src/assets/convenios/` e `public/assets/convenios/`, com cards no formato pílula/cápsula branca idênticos ao design original do site Dr. Marcelo, suporte à opção "Outro Plano" para operadoras não listadas, e regressão unitária em `tests/public-booking-insurance.test.tsx`.


### [2026-09-09] Portal do paciente mostrava uma sessão de expediente inteiro
- A grade semanal e as sessões operacionais são conceitos diferentes: uma regra `08:00–17:00` com duração 30 gera slots virtuais, enquanto uma turma manual `08:00–17:00` ocupa sala e profissional por nove horas. O Portal de novo agendamento deve consultar a grade via motor compartilhado e materializar/reutilizar somente o slot escolhido.
- O plano atribuído ao paciente agora guarda `serviceId` como snapshot, restringindo horários ao serviço contratado mesmo após mudanças no catálogo. Definições comerciais com planos já atribuídos não podem ser excluídas; devem ser desativadas.
- Uma série vazia de 12 sessões `08:00–17:00` foi removida em produção com pré-condições exatas. As 7 regras semanais foram preservadas; sexta-feira de Pilates/RPG retorna 8 slots e segunda-feira retorna 18 slots de 30 minutos.

### [2026-09-08] Agenda pública com serviço indisponível
- Os logs remotos de `bookingBuilder:listPublicAvailableSlots` confirmaram `ConvexError: Serviço indisponível`. Planos públicos precisam ter serviço existente e ativo; a consulta de horários deve retornar lista vazia para seleções que ficaram indisponíveis, sem derrubar a página. A confirmação continua rejeitando a reserva. Regressões em `tests/group-booking.test.ts` cobrem serviço inativo/removido e plano inativo/oculto/removido.

### [2026-09-08] Build de produção e deploy Convex no Windows
- O `.env.local` deste projeto aponta para o backend local; o guard do Vite rejeita esse valor no build de produção. Para validar sem alterar segredos, carregar `VITE_CONVEX_URL` HTTPS apenas no processo do comando.
- Nesta versão da CLI Convex, `deploy --typecheck enable` retornou código 1 ao encontrar Node 25 e ausência de `convex/tsconfig.json`, embora o build local (`tsc -b`), testes, bundling e o `deploy --dry-run --typecheck disable` tenham passado. O deploy desta release foi feito com esse check desabilitado e a limitação deve ser resolvida em uma tarefa própria de tooling, preferencialmente com Node 24 e configuração Convex dedicada.

### [2026-09-08] Portal por senha: runtime e migração
- O CLI Convex no Windows pode imprimir o resultado concluído de `convex run` e depois encerrar com assertion `UV_HANDLE_CLOSING`, inclusive sob Node 24. Não repetir mutações cegamente por causa do exit code; conferir o resultado e o estado persistido. Nesta tarefa, migração idempotente e login real no backend local confirmaram a persistência.
- `convex codegen` nesta versão inicia o backend local e executa a análise de push necessária às bindings; a análise de actions Node falha com Node 25 no PATH. Executar o CLI e iniciar o backend com Node 24 no PATH. Funções auxiliares que importam `node:crypto` também precisam de `"use node"`.
- A migração `portalAuth:migrateExisting` é paginada e restrita ao operador do deployment. A versão de sessão invalida links antigos imediatamente; executar todas as páginas antes de liberar o novo frontend. Ver evidências e roteiro em `TASK_PORTAL_LOGIN.md`.

Este arquivo é lido no início de cada nova sessão e atualizado ao final de cada sessão para garantir auto-aprendizado contínuo.

---

### [2026-09-08] Duração fixa na agenda pública
- **Ponto de fricção**: A agenda pública calculava os horários a partir das regras de disponibilidade, mas exibia `55` minutos fixos no cabeçalho e nos cards. Assim, uma regra configurada para 30 minutos mostrava uma duração incorreta embora os intervalos fossem `07:00–07:30`.
- **Mitigação**: Exibir a duração derivada do intervalo real do slot com `getDurationMinutes`, cobrindo o cálculo com teste unitário. Não alterar o fallback de clínicas sem regra ativa, pois ele é um comportamento separado do caso configurado.

---

### [2026-09-02] Codificação de Caracteres em Scripts PowerShell no Windows
- **Ponto de Fricção**: No Windows PowerShell 5.1 / PowerShell Core, o comando padrão `Set-Content` sem flag de encoding grava em ANSI/Windows-1252, gerando o erro de build no Vite/Rolldown: `stream did not contain valid UTF-8`.
- **Mitigação / Regra**: Sempre salvar novos arquivos de código `.ts`, `.tsx`, `.json` e `.md` usando UTF-8 sem BOM explícito via `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))` ou ferramentas nativas do assistente.

---

### [2026-09-02] TypeScript 5.x+ e Bundler Mode
- **Ponto de Fricção**: Com `"moduleResolution": "bundler"`, a opção `"baseUrl": "."` é depreciada no TypeScript moderno e dispara aviso TS5101. Além disso, `"noUnusedLocals"` rigoroso bloqueia prototipação ágil se ícones não utilizados estiverem no import.
- **Mitigação / Regra**: Manter caminhos relativos em `paths: { "@/*": ["./src/*"] }` sem `baseUrl`, e gerenciar `"noUnusedLocals": false` durante etapas de desenvolvimento de UI.

---

### [2026-09-02] Convex MCP Server no Windows
- **Ponto de Fricção**: O Convex MCP é embutido na CLI oficial (`convex mcp start`), não necessitando de pacotes de terceiros.
- **Mitigação / Regra**: Configurado globalmente e no projeto via `npx -y convex@latest mcp start`. Para conexões com backend remoto, usar `npx convex dev` para parear com a conta Convex e gerar as credenciais locais.

---

### [2026-09-02] Resolução de Módulos Convex no Vite e Derivação de Estado Reativo
- **Ponto de Fricção**: Ao importar artefatos de `convex/_generated/api` a partir de componentes em `src/`, o TypeScript e o bundler precisam de resolução explícita de caminho, e chamar `setState` dentro de `useEffect` para sincronizar queries reativas dispara avisos de render cascata no React 19 / Oxlint.
- **Mitigação / Regra**: Configurar o alias `@convex/*` em `tsconfig.app.json` e `vite.config.ts` (com `"include": ["src", "convex"]`), e derivar dados reativos diretamente no corpo do componente/provider (`effectiveData = convexData ?? localData`) em vez de efeitos síncronos.

---

### [2026-09-02] Parâmetros de Deployment no Convex MCP e Criação de Arquivos
- **Ponto de Fricção**: As chamadas do MCP do Convex (`tables`, `run`, `runOneoffQuery`) exigem o parâmetro `deploymentSelector` extraído do retorno de `convex:status`, e os argumentos de mutação/query devem ser passados como string JSON (`"{}"`). Para criação de novos arquivos em `src/` ou `convex/`, ferramentas que esperam caminho de artefato não devem ser usadas no workspace, preferindo a escrita UTF-8 explícita via PowerShell.
- **Mitigação / Regra**: Sempre obter o `deploymentSelector` via `convex:status` antes de rodar queries no MCP e passar `args` serializados em JSON. Para novos arquivos no workspace, usar `[System.IO.File]::WriteAllText` com codificação UTF-8 sem BOM.

---

### [2026-09-02] Geração de Componentes Complexos sem Conflito de Escaping no PowerShell
- **Ponto de Fricção**: Ao tentar gerar arquivos de código extensos com JSX/TypeScript contendo aspas, chaves e template literals via PowerShell inline (`-Command @"..."@`), o parser do PowerShell frequentemente quebra com `TerminatorExpectedAtEndOfString`.
- **Mitigação / Regra**: Escrever um script gerador em `scratch/*.js` dentro do diretório de artefatos com `write_to_file` e executá-lo com `node scratch/script.js`. Isso garante manipulação de strings sem limites de buffer, compatibilidade total de aspas e escrita 100% UTF-8 sem BOM via `fs.writeFileSync(..., 'utf8')`.

---

### [2026-09-02] Processo Convex Dev Ativo na Porta 3210 e Hot Reloading
- **Ponto de Fricção**: Executar `npx convex dev --once` quando o backend local Convex já está rodando em segundo plano (na porta 3210) retorna erro de conflito de porta (`A local backend is still running on port 3210`).
- **Mitigação / Regra**: O processo em segundo plano monitora ativamente todos os arquivos em `convex/*.ts` e recompila as funções instantaneamente ao salvar. Não é necessário matar o processo nem rodar `--once`; para testar mutações ou queries atualizadas, basta chamá-las diretamente via Convex MCP.

---

### [2026-09-02] Convex Actions e Referências Circulares de Tipos no TypeScript
- **Ponto de Fricção**: Chamar `api.<modulo>.<action>` dentro do próprio arquivo `convex/<modulo>.ts` via `ctx.runAction` causa erro TS7022 de inferência circular ("implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer"). Além disso, o TypeScript com `verbatimModuleSyntax` exige importação type-only para tipos de contexto (`import { type ActionCtx }`).
- **Mitigação / Regra**: Para chamadas entre actions no mesmo módulo, extrair a lógica assíncrona em funções helpers locais (`sendWhatsAppDirectHelper(ctx, args)`) e chamá-las diretamente. Isso elimina referências circulares, melhora o desempenho eliminando overhead de IPC interno e garante compilação com zero erros.

---

### [2026-09-02] Code-Splitting Dinâmico com Named Exports e React 19
- **Ponto de Fricção**: Ao utilizar `React.lazy` com módulos que utilizam exportações nomeadas (`export const Page`), o TypeScript/Vite exige retorno com `{ default: Component }`, caso contrário a página falha silenciosamente em tempo de execução.
- **Mitigação / Regra**: Padronizar imports dinâmicos como `lazy(() => import("@/pages/...").then(m => ({ default: m.PageName })))` e envelopar a rota em `<Suspense fallback={<PageLoadingFallback />}>`. Isso fragmenta o bundle de 650 kB para chunks de 10-80 kB com carregamento sob demanda instantâneo.

---

### [2026-09-02] Impressão Nativa A4 vs Bibliotecas de PDF no Cliente
- **Ponto de Fricção**: Bibliotecas como `jspdf` e `html2canvas` aumentam o bundle em mais de 500 kB, degradam fontes em dispositivos móveis e quebram quebras de página dinâmicas em português.
- **Mitigação / Regra**: Usar impressão nativa CSS `@media print` isolando o container `#printable-document`. O navegador executa a renderização vetorial com fontes do sistema nativas e permite salvar em PDF com resolução A4 impecável com 0 KB adicionais no bundle.

---

### [2026-09-02] PWA Service Worker e Conexões WebSockets do Convex
- **Ponto de Fricção**: Interceptar chamadas fetch indistintamente no Service Worker (`fetch` handler) pode corromper ou bloquear a sincronização em tempo real do Convex (`.convex.cloud` ou `localhost:3210`).
- **Mitigação / Regra**: No `sw.js`, incluir uma cláusula de escape precoce (`if (event.request.url.includes("convex.cloud") || event.request.url.includes(":3210")) return`) para que o Service Worker gerencie exclusivamente assets estáticos locais (`index.html`, `assets/*`, `manifest.webmanifest`), delegando todo o tráfego reativo ao engine nativo do navegador.

---

### [2026-09-02] Funções Impuras no Render do React 19 e Compilador React
- **Ponto de Fricção**: Chamadas a funções que retornam valores não determinísticos durante a execução do JSX (como `Date.now()`, `Math.random()`) geram avisos `react(purity): Cannot call impure function during render`, impedindo otimizações do novo compilador do React.
- **Mitigação / Regra**: Estabilizar valores temporais ou hashes de documentos gerados usando `useMemo` com dependências do documento ou inicialização preguiçosa de estado (`useState(() => ...)`).

---

### [2026-09-02] Versionamento Git e Isolamento de Armazenamento Local Convex
- **Ponto de Fricção**: Ao inicializar o repositório Git no projeto, a pasta oculta `.convex/` que armazena os dados do banco local de desenvolvimento não pode ser incluída no controle de versão.
- **Mitigação / Regra**: Adicionar `.convex` explicitamente ao `.gitignore` junto com `*.local`, mantendo apenas o diretório de código `convex/` sob versionamento.

---

### [2026-09-02] Truncamento de Texto em Selects Nativos e Responsividade de Modais
- **Ponto de Fricção**: Elementos `<select>` padrão com classes genéricas frequentemente sofrem corte de texto à direita quando o padding lateral não reserva espaço para a seta do sistema operacional ou ícone customizado, agravando-se em modais restritos a `sm:max-w-md`.
- **Mitigação / Regra**: Utilizar o componente padronizado `<Select>` (`src/components/ui/select-native.tsx`) com `h-10`, `rounded-xl`, `pr-10` e ícone absoluto `ChevronDown`. Para modais com 2 colunas de formulário, dimensionar o container com `sm:max-w-xl` e rótulos semânticos destacados (`block text-xs font-semibold text-foreground/85 mb-1.5`).

---

### [2026-09-02] Desvio Temporal de Fuso Horário Negativo (America/Sao_Paulo UTC-3)
- **Ponto de Fricção**: O uso ingênuo de `new Date().toISOString().split("T")[0]` vira o dia do sistema às 21:00h de Brasília (quando o relógio UTC atinge 00:00h do dia seguinte). Além disso, `new Date("YYYY-MM-DD").toLocaleDateString()` pode atrasar 1 dia no navegador do cliente devido à meia-noite UTC.
- **Mitigação / Regra**: Utilizar exclusivamente as funções de `src/lib/dateUtils.ts` (`getTodayDateString()`, `formatDateBR()`, `formatDateTimeBR()`, `formatDateExtendedBR()`). Elas forçam `timeZone: "America/Sao_Paulo"` via `Intl.DateTimeFormat` e tratam strings de data por decomposição numérica pura (`[ano, mes, dia]`), garantindo exibição rigorosa em `dd/mm/aaaa` sem desvios.

---

### [2026-09-02] UAZAPI (uazapiGO v2.0): Autenticação Dupla, Payloads Interativos e Proteção Anti-Bloqueio
- **Ponto de Fricção**: A API uazapiGO utiliza esquemas de cabeçalho diferentes dependendo do escopo: endpoints administrativos (`/instance/create`, `/instance/all`) exigem o header `admintoken`, enquanto endpoints de instância (`/instance/connect`, `/instance/status`, `DELETE /instance`, `/send/*`) exigem `token`. Além disso, o envio interativo unificado (`/send/menu`) espera escolhas em strings delimitadas (`"Texto|reply:id"` para botões, `"[Seção]"` para listas e `"[Título\nDesc]"`, `"{imagem}"` para carrossel). Disparos simultâneos sem delay podem gerar bloqueios temporários de número pelo WhatsApp.
- **Mitigação / Regra**: Centralizar as chamadas HTTP em `convex/whatsapp.ts` com cabeçalhos dinâmicos conforme o endpoint. Para disparos em massa, incorporar intervalo anti-bloqueio compulsório (3.5 segundos entre mensagens) e persistir o status de cada envio na tabela `notificationLogs`.

---

### [2026-09-02] Sanitização e Normalização de Quebras de Linha (\n) em Mensagens do WhatsApp
- **Ponto de Fricção**: O uso de escape duplo `\\n` em strings de seed ou scripts grava os caracteres literais `\` e `n` (dois bytes) no banco de dados Convex em vez do caractere de quebra de linha real (ASCII 10). Na serialização JSON (`JSON.stringify`), isso se converte em `\\\\n`, fazendo com que a API externa da UAZAPI e os balões do WhatsApp recebam e exibam literalmente o texto `\n\n` na tela do celular e nos editores. Além disso, textareas e previews precisam preservar `whitespace-pre-wrap` para que quebras manuais (Enter) reflitam fielmente o espaçamento de parágrafos.
- **Mitigação / Regra**: Centralizar a função `normalizeWhatsAppText` em `convex/whatsapp.ts` convertendo `\\r\\n`, `\\n`, `\r\n` para quebras de linha reais (`\n`) no salvamento de templates e antes de cada chamada HTTP à UAZAPI (`sendUazapiInteractiveMessage` e `sendWhatsAppDirectHelper`). No frontend, utilizar a função `cleanLineBreaks` em tempo real nos inputs/textareas (`onChange`) e aplicar `whitespace-pre-wrap` e espaçamento visual nos balões de preview do WhatsApp.

---

### [2026-09-02] Encaixe de Folhas A4 em Contêineres Flexbox, Responsividade de Modais e Isolamento de Impressão
- **Ponto de Fricção**: Em contêineres flexbox com `overflow-y-auto` e `display: flex; justify-content: center;`, o alinhamento transversal padrão (`align-items: stretch`) força a folha `#printable-document` a se limitar à altura inicial calculada do container/grid. Quando o documento contém muito conteúdo (laudos extensos ou termos TCLE/LGPD com múltiplos itens), o texto extravasa para fora da folha no fundo cinza, cortando visualmente a folha ao meio. Além disso, botões absolutos de fechar (`DialogClose` em `top-4 right-4`) sobrepõem badges alinhados no topo direito, e a ausência de `@media print` adequado imprime o layout inteiro da tela em vez de isolar o documento limpo.
- **Mitigação / Regra**:
  1. Em contêineres de preview de documentos, aplicar sempre `items-start` no container flex e `h-fit` no elemento da folha (`#printable-document`), garantindo que o cartão branco acompanhe 100% da extensão do texto sem truncamento.
  2. Adicionar `pr-10` no cabeçalho do `DialogHeader` para garantir espaço livre de segurança contra sobreposição do botão "X".
  3. Adicionar `@media print` no CSS global com `body * { visibility: hidden; } #printable-document, #printable-document * { visibility: visible; }` e posicionamento absoluto no topo com margens A4 para exportação de PDFs vetoriais impecáveis.

---

### [2026-09-02] Token de Autenticação na CLI do Convex em Ambientes Automatizados
- **Ponto de Fricção**: A CLI oficial do Convex não utiliza `CONVEX_ACCESS_TOKEN` para Personal Access Tokens em execuções de terminal ou CI. O uso dessa variável resulta em falha de permissão (`You don't have access to the selected project`).
- **Mitigação / Regra**: A CLI do Convex espera a variável de ambiente `CONVEX_OVERRIDE_ACCESS_TOKEN` para tokens de acesso pessoal da plataforma (ou o arquivo de configuração persistente `$HOME\.convex\config.json` com `{"accessToken":"..."}`). Com o token válido e `CONVEX_DEPLOYMENT="prod:<deployment-name>"`, comandos como `npx convex deploy`, `npx convex run` e queries remotas funcionam de forma não-interativa e 100% estável.

---

### [2026-09-02] Roteamento SPA e Rewrites no Vercel CLI com Vite
- **Ponto de Fricção**: A presença de `"version": 2` e `"cleanUrls": true` com `destination: "/index.html"` no `vercel.json` faz a CDN da Vercel retornar 404 NOT_FOUND em rotas internas do Single Page Application acessadas diretamente (como `/agendamento` e `/login`).
- **Mitigação / Regra**: Utilizar configuração moderna sem `version` nem `cleanUrls`, com a regra canônica de rewrites SPA: `[ { "source": "/(.*)", "destination": "/" } ]`. Isso delega qualquer rota dinâmica ao `index.html` do Vite com retorno HTTP 200 garantido.

---

### [2026-09-02] Criação de Novos Arquivos de Código no Workspace via Scratch & Copy-Item
- **Ponto de Fricção**: A ferramenta nativa de criação de arquivos exige caminhos sob o diretório de artefatos (`<appDataDir>/brain/<id>/...`), enquanto o PowerShell inline sofre com limites de buffer e conflito de escaping de template literals e JSX.
- **Mitigação / Regra**: Criar o arquivo de código diretamente no subdiretório `scratch/` do diretório de artefatos com `write_to_file` (que preserva 100% da codificação UTF-8 sem BOM e suporta qualquer caractere sem escaping) e, em seguida, copiá-lo para o destino no workspace com `Copy-Item -Path "..." -Destination "..." -Force`. Isso garante geração instantânea e à prova de falhas de componentes extensos.

---

### [2026-09-02] Nomenclatura de Retornos de useMutation e Regras de Hooks no React (Oxlint)
- **Ponto de Fricção**: Nomear variáveis que recebem retornos do `useMutation(...)` com o prefixo `use` (por exemplo: `const useReplacementCreditMutation = useMutation(...)`) faz o linter e o React Hooks Rules interpretarem que uma chamada posterior `await useReplacementCreditMutation(...)` dentro de um callback/evento é uma chamada ilegal de Custom Hook fora do corpo principal do componente (`react-hooks/rules-of-hooks`).
- **Mitigação / Regra**: Sempre nomear funções mutadoras usando verbos de ação e sufixo descritivo sem o prefixo `use` (ex: `bookReplacementCreditMutation`, `cancelAppointmentMutation`, `deletePatientMutation`).

---

### [2026-09-02] Otimização Extrema de Banco Convex para Plano Gratuito (Hobby)
- **Ponto de Fricção**: O plano gratuito do Convex limita o banco a 1 GB de armazenamento, 10 GB de bandwidth de leitura mensal e 1.000.000 de chamadas de função. Consultas sem índice com `.collect()` ou `.filter()` realizam varreduras de tabela inteira (*table scans*), N+1 queries baixam payloads textuais maciços repetidamente, e ausência de retenção de logs estoura o armazenamento silenciosamente.
- **Mitigação / Regra**:
  1. Em tabelas com grande crescimento temporal (`schedules`, `financialTransactions`, `notificationLogs`), indexar por data (`by_dueDate`, `by_date`) e utilizar range queries (`.gte("dueDate", start).lte("dueDate", end)`) com `.take(limit)` para carregar estritamente o mês em visualização.
  2. Em consultas agregadas como prontuários (`listAllClinicalOverview`), buscar apenas a última evolução (`.order("desc").first()`) e limitar contagens amostrais, evitando baixar parágrafos SOAP de todas as sessões anteriores.
  3. Registrar rotina diária de manutenção (`convex/maintenance.ts` em `convex/crons.ts`) para purgar sessões expiradas, expurgar logs com mais de 60 dias e marcar créditos vencidos, além de deletar arquivos do `ctx.storage` quando fotos forem substituídas ou prontuários/pacientes forem excluídos.

---

### [2026-09-02] Vercel CLI Global Config no Windows em Execuções Automatizadas
- **Ponto de Fricção**: Em ambientes Windows automatizados, executar comandos `vercel` sem apontar a pasta de configuração global pode travar o terminal em prompt interativo de login, mesmo com o usuário já autenticado anteriormente.
- **Mitigação / Regra**: O Vercel CLI no Windows grava as credenciais em `$env:APPDATA\com.vercel.cli\Data\auth.json`. Passar o parâmetro `-Q "$env:APPDATA\com.vercel.cli\Data"` reaproveita a sessão ativa e executa comandos como `vercel --prod`, `vercel env ls` e `vercel alias` sem intervenção manual.

---

### [2026-09-02] Regeneração de Tipos Convex (npx convex codegen) Pré-Build
- **Ponto de Fricção**: Ao modificar tabelas ou campos em `convex/schema.ts`, executar diretamente `npm run build` (`tsc -b`) falha com `error TS2353: Object literal may only specify known properties` porque o arquivo `convex/_generated/dataModel.d.ts` ainda contém as tipagens antigas em cache.
- **Mitigação / Regra**: Sempre executar `npx convex codegen` antes de builds de produção ou typechecks após alterações estruturais de schema. O codegen sincroniza os tipos estáticos instantaneamente.

---

### [2026-09-02] IDs Convex entre Ambientes (Local vs Produção), Cache de Cliente e Error Boundaries
- **Ponto de Fricção**: Os IDs de documentos gerados pelo Convex contêm codificação interna da tabela específica daquele deployment (prefixo `j...` no banco de dev local e `k...` na nuvem de produção). O uso estrito do validador `v.id("tableName")` em queries/mutations públicas ou portais que recebem IDs do `localStorage` ou parâmetros de URL dispara `ArgumentValidationError: Found ID "..." from table '...', which does not match validator v.id(...)` caso o cliente possua um ID em cache de outro ambiente ou ID de aluno deletado. Como o React 19 / Convex `useQuery` propaga erros de servidor como exceções síncronas de renderização, isso crashava a aplicação inteira em tela branca. Além disso, browsers modernos emitem aviso de depreciação para `<meta name="apple-mobile-web-app-capable">` se desacompanhado de `<meta name="mobile-web-app-capable">`.
- **Mitigação / Regra**:
  1. Em endpoints de portais com entrada livre ou cache de cliente, utilizar `v.string()` nos validadores e normalizar o ID via `ctx.db.normalizeId("tableName", args.id)`. Caso o ID pertença a outro deployment ou formato inválido, `normalizeId` retorna `null` de forma silenciosa e segura sem estourar `ArgumentValidationError`.
  2. Nunca hardcodar IDs de documentos em atalhos ou botões de demonstração; consultar dinamicamente com queries (`getDemoPatients`) para obter os IDs reais do banco de dados ativo.
  3. No frontend, adicionar auto-recuperação de sessão: se `patientId` estiver presente no estado mas a query de dados retornar `null`, limpar automaticamente o `localStorage` e resetar a tela de login.
  4. Envolver páginas do portal com `ErrorBoundary` dedicado que expurga dados corrompidos do `localStorage` e exibe opção de recarregamento suave.
  5. Incluir `<meta name="mobile-web-app-capable" content="yes" />` no `index.html`.

---

### [2026-09-02] UAZAPI (uazapiGO v2.0): Sanitização de Endpoint Base, Vinculação por Nome/ID e Live QR Detection
- **Ponto de Fricção**: A documentação legada e formulários continham referências a `https://api.uazapi.com` ou `https://api.uazapi.com/v1`, que não possuem os endpoints do uazapiGO e retornavam HTTP 404 em todas as chamadas de `/instance/status`. Além disso, usuários frequentemente tentam conectar informando o nome da instância (ex: `drmarcelo`) em vez do UUID de 36 caracteres, resultando em erro de autorização. No frontend, os QR Codes da Uazapi expiram após 20-30 segundos sem que houvesse contagem regressiva ou auto-refresh, e após o escaneamento no celular, a tela não detectava a conexão automaticamente.
- **Mitigação / Regra**:
  1. Centralizar a função `sanitizeUazapiEndpoint` em `convex/whatsapp.ts`, garantindo que qualquer endpoint legado (`api.uazapi.com`), sufixos de rota (`/v1`, `/api`) ou barras finais sejam normalizados para o host oficial `https://whatpress.uazapi.com`.
  2. Implementar a action `listServerInstancesAction`, permitindo que o frontend liste todas as instâncias existentes no servidor UAZAPI e que o usuário vincule qualquer instância com apenas 1 clique.
  3. No `connectExistingTokenAction`, implementar busca com tolerância a falhas: caso o input informado seja um nome de instância (ex: `drmarcelo`) ou ID curto (`raf314...`), o backend consulta a listagem administrativa com o `admintoken` para resolver automaticamente o UUID real da instância.
  4. No modal de pareamento de QR Code (`WhatsAppInstanceManager.tsx`), implementar polling ativo a cada 3.5s (`checkInstanceStatusAction`), fechando o modal e emitindo aviso de sucesso assim que o celular conclui a leitura, e auto-refresh compulsório do QR Code a cada 20 segundos com indicador visual de contagem regressiva.

---

### [2026-09-03] Cache-First em Service Worker, Rewrites da Vercel e Erros de MIME Type ('text/html') em Assets
- **Ponto de Fricção**: Em Progressive Web Apps (PWA) construídas com bundlers que utilizam content-hashing (como Vite/Rollup), adotar a estratégia Cache-First indiscriminadamente para rotas de navegação (`/`, `/index.html`) congela a versão do HTML no dispositivo do usuário. Quando um novo deploy é realizado, o HTML stale do cliente continua solicitando os hashes antigos de CSS/JS (ex: `index-BaVe7OU_.css` e `index-BGbgOXfV.js`) que já não existem no servidor. Se a regra de rewrite do SPA no `vercel.json` for genérica (`/(.*)` para `/`), a CDN responde com HTTP 200 servindo o `index.html` para as requisições de assets inexistentes. Os navegadores rejeitam esses arquivos com `Refused to apply style... MIME type ('text/html')` e `Failed to load module script: Expected a JavaScript-or-Wasm module script`, além de persistir avisos de tags legadas (`<meta name="apple-mobile-web-app-capable">`) presentes no HTML antigo.
- **Mitigação / Regra**:
  1. No `sw.js`, requisições de documento/navegação (`event.request.mode === 'navigate'` ou `destination === 'document'`) DEVEM utilizar **Network-First** com fallback de cache apenas quando offline. Nunca usar Cache-First no `index.html`.
  2. No `sw.js`, interceptar respostas de assets e nunca salvar em cache responses com `text/html` para extensões `.js` ou `.css`.
  3. No `vercel.json`, restringir a regra de rewrites SPA para rotas sem extensão e fora da pasta `/assets/` via regex com negative lookahead: `[ { "source": "/((?!assets/|.*\\.[a-zA-Z0-9]+$).*)", "destination": "/" } ]`. Isso força a Vercel a retornar HTTP 404 limpo para assets antigos inexistentes em vez de HTML mascarado.
  4. No `vercel.json`, aplicar `Cache-Control: public, max-age=0, must-revalidate` explicitamente para `/sw.js` e `/index.html`.
  5. No `<head>` de `index.html`, registrar script de auto-recuperação resiliente no capture phase (`window.addEventListener('error', ..., true)`): ao detectar falhas de carregamento de recursos ou MIME errors, o cliente desregistra service workers, purga todos os caches da Cache Storage API e recarrega a página automaticamente uma vez. Adicionar também listener para o evento `vite:preloadError` do Vite.

---

### [2026-09-03] Priorização de Instâncias Ativas UAZAPI, Máscara Dinâmica de Telefone e Resiliência no Simulador de Disparos
- **Ponto de Fricção**:
  1. A query interna `getDefaultInstanceInternal` selecionava cegamente qualquer instância marcada com `isDefault: true`. Quando a instância padrão do banco ficava desconectada (`disconnected`) ou continha um token revogado/antigo enquanto outra instância conectada estava disponível (como a `Altar Tech`), todos os envios continuavam utilizando o token inválido, resultando em erros HTTP 401 ou 503 na UAZAPI.
  2. O disparador simulado dependia de dados fictícios de grade (`mockSchedule`), repassando IDs locais sintéticos (`s1`) que quebravam a validação de tipo do Convex (`v.id("schedules")`), provocando falha silenciosa capturada em catch com falso retorno positivo.
  3. O campo de telefone não possuía máscara de entrada para formatação instantânea de celulares brasileiros `(XX) XXXXX-XXXX`, permitindo envio de sequências numéricas cruas ou formatos truncados sem validação de DDD.
- **Mitigação / Regra**:
  1. No `convex/whatsapp.ts`, a query `getDefaultInstanceInternal` agora prioriza obrigatoriamente instâncias com `status: "connected"` (primeiro a default conectada, depois qualquer instância com sessão ativa). Se a instância default desconectar, o motor redireciona o tráfego automaticamente para a conexão ativa disponível.
  2. Implementada a função utilitária `formatPhoneBR` em `src/lib/utils.ts`, com formatação progressiva em tempo real para celulares (11 dígitos) e fixos (10 dígitos), aceitando colagens com ou sem DDI 55.
  3. Desacoplado o Simulador de Disparos de qualquer entidade de grade: o simulador chama a action diretamente (`sendWhatsAppNotificationAction`), com validação prévia de 10-11 dígitos, banner em tempo real informando se a instância UAZAPI está Online ou Desconectada, e toasts diferenciados visualmente entre sucesso (verde) e falha (vermelho).

---

### [2026-09-03] Exportação de Planilhas Excel (.xlsx) com Múltiplas Abas e Code-Splitting Sob Demanda
- **Ponto de Fricção**: A inclusão estática da biblioteca `xlsx` (SheetJS) no bundle principal do cliente adicionaria mais de 400 kB ao carregamento inicial da aplicação, impactando o First Contentful Paint (FCP) de todos os usuários, mesmo os que nunca usam a funcionalidade de exportação. Por outro lado, a geração simplificada de arquivos `.csv` não suporta múltiplas abas (ex: "Histórico Detalhado" e "Consolidado por Aluno") e o formato XML 2003 `.xls` dispara avisos de arquivo não seguro no Microsoft Excel moderno.
- **Mitigação / Regra**: Carregar a biblioteca `xlsx` estritamente sob demanda via import dinâmico assíncrono (`const XLSX = await import("xlsx")`) dentro do manipulador do clique de exportação (`handleExportExcel`). O Vite/Rollup isola a biblioteca automaticamente em um chunk separado (`xlsx-*.js`), mantendo o bundle principal da aplicação leve e veloz, enquanto entrega planilhas binárias `.xlsx` profissionais com formatação, larguras de colunas calculadas e múltiplas abas limpas.

---

### [2026-09-03] Upload de Assets Institucionais (Logotipo), Convex File Storage e Propagação Reativa no Layout
- **Ponto de Fricção**: Gravar imagens de marca (PNG, JPG, SVG, WebP) em Base64 Data URI diretamente na linha de configurações do banco Convex aumenta o payload JSON em ~33%, satura cotas de bandwidth e desacelera todas as telas do sistema que consomem `clinicSettings`. Por outro lado, o uso de File Storage requer resolução dinâmica de URL (`ctx.storage.getUrl`) e deleção ativa de arquivos anteriores (`ctx.storage.delete`) para evitar o acúmulo de imagens órfãs ao substituir ou excluir logos.
- **Mitigação / Regra**:
  1. No schema Convex (`convex/schema.ts`), armazenar `logoUrl: v.optional(v.string())` e `logoStorageId: v.optional(v.string())`.
  2. No backend (`convex/clinic.ts`), expor mutation `generateUploadUrl` para upload direto do cliente via POST HTTP binário, e implementar auto-limpeza em `updateSettings` e `removeLogo`: se o `logoStorageId` for alterado ou removido, invocar `await ctx.storage.delete(existing.logoStorageId).catch(() => {})`. Na query `getSettings`, resolver dinamicamente o link público atualizado do storage.
  3. No frontend (`SettingsPage.tsx`), criar área de upload com Drag & Drop, clique, validação de tipos MIME e limite de 5MB, pré-visualização instantânea via `URL.createObjectURL` e pré-visualização em escala real e em tamanho de sidebar (40x40). Fornecer também opção de remoção de logo e inserção via link direto.
  4. No `ThemeContext.tsx`, derivar a marca de forma reativa a partir de `useQuery(api.clinic.getSettings)` mantendo cache local de fallback (`localStorage`), propagando a logo em tempo real para a sidebar (expandida e recolhida), barra mobile, drawer, tela de login, portal do aluno e cabeçalhos de impressão timbrados.

---

### [2026-09-03] Alternância Dinâmica Grade/Lista, Prevenção de Conflitos de Nomenclatura e Responsividade Mobile Híbrida
- **Ponto de Fricção**: Ao implementar modos de visualização (Grade vs Lista) em telas complexas que já possuem estados como `viewMode` para chavear rotas ou subvisões internas (como em `ClinicalRecordPage`, onde `viewMode` controlava "overview" vs "patient"), reutilizar o mesmo nome quebra a navegação interna ou sobrescreve estados. Além disso, tabelas no modo lista com muitas colunas (Ações, Contatos, Badges) estouram a largura da tela em smartphones (375px–420px) se renderizadas puramente em `<table>` sem layout alternativo, e botões de filtro sem `flex-wrap` ou `flex-1` quebram linhas desordenadamente.
- **Mitigação / Regra**:
  1. Componentizar o alternador de visualização em `<ViewModeToggle>` (`src/components/ui/view-mode-toggle.tsx`) com ícones `LayoutGrid`/`List`, segmented control e rótulos responsivos (`hidden sm:inline`).
  2. Isolar o estado de layout por tela (ex: `overviewLayoutMode` em páginas com navegação própria) e memorizar preferências do usuário no `localStorage` sob chaves com prefixo específico (`altar_<modulo>_view_mode`).
  3. No Modo Lista, adotar design responsivo híbrido: em telas `>= 640px` (`hidden sm:block`), exibir tabela estruturada com cabeçalho limpo e colunas alinhadas; em telas `< 640px` (`sm:hidden`), renderizar cards condensados em linha (card-row) com separadores sutis, garantindo 100% de responsividade sem forçar rolagem lateral exaustiva no celular.

---

### [2026-09-03] Colisão de Elementos em Grades Responsivas, Micro-Tipografia e Respiro Visual em Cards de Horários
- **Ponto de Fricção**: Em grades com 3 colunas ativadas precocemente no breakpoint `md` (768px a 1023px) ou com padding lateral amplo, a largura interna útil de cada card é restrita (~190px). O uso simultâneo de badges com texto inflado (`uppercase tracking-wider`), ausência de `gap` explícito entre containers `flex justify-between`, ícone do turno e dígitos do horário resulta em colisão física horizontal (texto colado ou encostando na badge). Além disso, o uso de `leading-none` combinado a `mt-0.5` causa colapso do respiro vertical entre a hora de início e o horário de término ("até HH:MM"), e linhas divisórias com cor estática (`border-border`) degradam o contraste quando renderizadas sobre gradientes com cor de fundo ativa (ex: card selecionado).
- **Mitigação / Regra**:
  1. **Escalonamento de Grade**: Em layouts de cards com conteúdo denso (ícone + horário + subtítulo + badge), reservar 3 colunas para `lg` (`lg:grid-cols-3`), mantendo 2 colunas em telas intermediárias (`sm:grid-cols-2`) e 1 coluna em mobile (`grid-cols-1`).
  2. **Garantia de Gap Mínimo**: Em contêineres `flex justify-between`, sempre declarar um `gap-2.5` ou `gap-3` explícito com `min-w-0` no bloco textual e `shrink-0` nas badges/ícones, impedindo colisão sob qualquer largura.
  3. **Respiro Vertical e Micro-Tipografia**: Utilizar `leading-tight` com `mt-1` a `mt-1.5` entre títulos e legendas (`text-[11px] font-medium`), e normalizar badges com padding equilibrado (`px-2.5 py-1 text-[10px] font-extrabold tracking-wide`) e ícones de 3x3 ou 3.5x3.5.
  4. **Divisores Reativos ao Estado**: Em cards selecionados ou com fundo contrastante, aplicar bordas contextuais `${isSelected ? "border-white/20" : "border-border/60"}` para preservar elegância e nitidez.

---

### [2026-09-03] Tipagem de União Universal no `ctx.db.get` do Convex e Fatiamento Dinâmico de Slots
- **Ponto de Fricção**: Quando o argumento de ID passado para `ctx.db.get(id)` possui tipo `any` ou união genérica sem identificador de tabela específico, o compilador do TypeScript no Convex infere o retorno como a união discriminada de todas as tabelas do schema (Doc<"users"> | Doc<"auditLogs"> | ...). Ao acessar campos comuns de entidades de negócio como `.name` ou `.capacity`, o TypeScript acusa erro TS2339 porque tabelas de logs ou sessões não possuem esses campos. Além disso, a CLI do Convex no Windows pode disparar aviso de libuv (`!(handle->flags & UV_HANDLE_CLOSING)`) após a execução de comandos `run`, embora as mutações e queries persistam 100% no banco.
- **Mitigação / Regra**:
  1. Tipar a variável capturada como `any` (`const room: any = await ctx.db.get(slot.roomId)`) ou usar asserção explícita de tipo (`Doc<"rooms"> | null`).
  2. Para fatiamento dinâmico de horários sem poluir o banco com dezenas de milhares de registros, manter as tabelas enxutas de `availabilityRules` e `availabilityOverrides` e fatiar os slots sob demanda na query com `sliceTimeWindowIntoSlots`.

---

### [2026-09-03] Arquitetura Hierárquica em Cards de Grade e Eliminação de CTAs Duplicados em Fluxos Multi-Step
- **Ponto de Fricção**: Posicionar na mesma linha horizontal o ícone do período, os dígitos do horário e uma badge de status/vagas expandida ("✓ ESCOLHIDO") em contêineres com colunas restritas (~210px) causa colisão física direta com o texto do horário. Além disso, a discrepância entre a largura máxima do cabeçalho (`max-w-4xl`) e do corpo principal (`max-w-3xl`) estrangula as colunas de grade desnecessariamente, e incluir botões de ação redundantes ("Confirmar e Continuar" dentro do banner de resumo e "Continuar para Próxima Etapa" no rodapé fixo) polui o campo visual e confunde o usuário.
- **Mitigação / Regra**:
  1. **Anatomia em 3 Camadas no Card**:
     - **Linha Superior (Cabeçalho)**: Ícone do período com rótulo amigável à esquerda (ex: "Tarde") e Badge de Vagas ou Status à direita (ex: `✓ Selecionado`), garantindo amplo respiro (>100px) sem competição.
     - **Linha Central (Corpo)**: Horário principal em destaque exclusivo e isolado (`text-2xl sm:text-[26px] font-black leading-none`) e subtítulo temporal (`até HH:MM`). Nenhum elemento divide a horizontal com o horário.
     - **Linha Inferior (Base)**: Divisor limpo com o nome semântico da sala (limpo de subtítulos excessivos para evitar truncamento prematuro) e duração da sessão.
  2. **Harmonização de Largura de Container**: Manter alinhamento rigoroso entre a navbar/header e o corpo principal em `max-w-4xl`, permitindo colunas confortáveis no desktop.
  3. **CTA Único por Etapa**: Banners de seleção ativa devem funcionar como feedback visual enriquecido com opção de desmarcar ("Trocar horário"), mantendo o call-to-action principal concentrado exclusivamente no botão do rodapé da etapa.

---

### [2026-09-03] Range Queries Reativas no Convex, Queries Condicionais com "skip" e Visualização Semanal/Mensal
- **Ponto de Fricção**: Ao implementar múltiplos modos de visualização temporal (Dia, Semana, Mês), consultar o banco de forma ingênua ou disparar queries simultâneas para dezenas de dias sobrecarrega a rede e estoura os limites do plano gratuito do Convex. Além disso, executar queries que não pertencem ao período ativo gera requisições desnecessárias. Em dispositivos móveis (< 640px), renderizar 7 colunas simultâneas resulta em cards esmagados (~45px de largura) e textos ilegíveis.
- **Mitigação / Regra**:
  1. Centralizar consultas por período na query indexada `listSchedulesByDateRange` com `.withIndex("by_date", q => q.gte("date", start).lte("date", end))`, mantendo complexidade $O(K)$ sem *table scans*.
  2. No React/Convex, utilizar o modificador `"skip"` em `useQuery` quando a modalidade ativa for diferente (ex: `schedulePeriodMode === "day" ? { date } : "skip"`), desativando subscrições WebSocket ociosas.
  3. No mobile para a Visão Semanal, adotar seletor em pílulas horizontais dos dias da semana (`[Seg 31] [Ter 01]...`) com indicação numérica e contadores de agendamentos, exibindo os cards do dia selecionado em largura total confortável. Para a Visão Mensal, utilizar Drawer lateral responsivo que resume as sessões do dia com um clique e atalho para a visão diária.
---

### [2026-09-08] Bloqueios da revisão de produção (histórico, corrigidos localmente)
- **Pendências confirmadas**: proteção por perfil existe no React, mas falta nas funções públicas do Convex; login rápido emite sessão sem senha; branding público retorna campos secretos; portal identifica paciente sem comprovação de posse. Não considerar build aprovado como liberação para produção.
- **Integridade**: atualização parcial de paciente envia strings vazias para campos omitidos; gravações clínicas retornam sucesso visual antes da persistência; listas vazias do servidor reativam fallback local. Corrigir e testar antes da publicação.
- **Evidência reproduzível**: `REVISAO_PRODUCAO.md` registra escopo e bloqueios. `scripts/review-production.mjs` reproduz sete defeitos com dados fictícios, sem rede; sucesso desse diagnóstico confirma vulnerabilidades, não segurança. Converter em regressões negativas após remediação.
- **Limite operacional**: navegador autenticado, runtime remoto, entrega de mensagens e restauração de backup continuam sem validação nesta revisão. Nenhum deploy realizado.

### [2026-09-08] Homologação após as correções
- **Estado atual**: ver CORRECOES_PRODUCAO.md. O diagnóstico antigo foi convertido em regressões negativas; `npm test` exige rejeição das operações inválidas.
- **Migração operacional**: hashes/sessões legados foram desabilitados. Provisionar contas reais pela action interna no projeto escolhido antes de liberar o frontend; não recolocar login rápido para contornar o acesso.
- **Configuração**: build rejeita Convex local em produção. `.artifacts/build-validation` usa URL fictícia, serve somente para validação e não deve ser publicado.
- **Limites restantes**: 300 avisos de lint; nenhuma prova de fluxo autenticado remoto, entrega física de mensagem ou restauração de backup. Tokens removidos do código podem continuar no histórico Git e requerem rotação se utilizados.

### [2026-09-08] Deploy de produção
- **Convex**: deployment `exuberant-guanaco-180` recebeu schema/funções corrigidos; confirmar sempre o alvo pelo host da variável Vercel antes de publicar. `CONVEX_DEPLOYMENT` local pode apontar para backend anônimo e causar deploy no alvo errado.
- **Runtime**: Node 25 do sistema gerou falhas/assertions no CLI Convex no Windows. Usar Node 24 do runtime empacotado para `convex deploy`/`convex run`.
- **Vercel**: projeto já vinculado e variável `VITE_CONVEX_URL` de produção existente. Deploy direto do working tree publicou `READY`; sem commit/push.
- **Evidência**: smoke HTTP e login Convex confirmados; isso não comprova todos os fluxos de negócio, entrega de mensagens, backup/restauração ou comportamento em dispositivo físico.

### [2026-09-08] Runtime de provisionamento local
- Node 25 do sistema impede deploy de actions Node no Convex local. Usar Node 24 disponível em C:/Users/matte/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin antes de iniciar convex dev.
- Política atual, solicitada pelo responsável: senha mínima de 12 caracteres. Conta admin local provisionada e login real validado; produção remota permanece pendente.

### [2026-09-08] Exclusão de prontuário clínico e falso sucesso no fallback local
- **Ponto de fricção**: A mutation já retornava `{ success: false }` quando não havia prontuário, mas o contexto ignorava o retorno e a tela anunciava exclusão concluída. A atualização otimista também removia o fallback local antes da confirmação remota.
- **Mitigação / Regra**: Operações destrutivas devem aguardar o resultado do backend, rejeitar respostas negativas e só então atualizar o estado local. Para prontuários, excluir apenas `clinicalRecords` e fotos do Storage; preservar evoluções SOAP/laudos e registrar o ator em `auditLogs`.

### [2026-09-08] Presets incompletos no editor de modelos de mensagem
- **Ponto de fricção**: O seletor de categoria do `MessageTemplateBuilder` atualizava o rótulo, mas só carregava conteúdo padrão para `booking_confirmation`. As demais categorias deixavam título, texto e controles da categoria anterior, criando um editor visualmente incoerente.
- **Mitigação / Regra**: Manter presets centralizados para todas as categorias e aplicá-los apenas no modo de criação. Durante a edição de um modelo salvo, trocar a categoria não deve sobrescrever conteúdo manual. Cobrir os dois comportamentos com teste de componente.

### [2026-09-08] Build local com ambiente Vercel de produção
- **Ponto de fricção**: O `npm run build` local carrega o `.env.local` de desenvolvimento e a validação de produção rejeita `VITE_CONVEX_URL` apontando para `127.0.0.1`. O `vercel pull --environment=production` também pode gravar a URL com aspas literais no arquivo `.vercel/.env.production.local`, causando `Invalid URL` quando o valor é repassado diretamente ao Vite.
- **Mitigação / Regra**: Executar `vercel pull --yes --environment=production` com o projeto já vinculado, ler somente `VITE_CONVEX_URL` para o processo temporário de build, remover aspas externas e conferir que o host é o backend HTTPS de produção. Nunca commitar o arquivo de ambiente local.

### [2026-09-08] Confirmação assíncrona de deploy direto na Vercel
- **Ponto de fricção**: `vercel deploy --prod` pode terminar o upload exibindo `Building...` antes de o deployment estar pronto; o retorno do CLI não é prova de `Ready`, e deploy direto pela CLI pode não registrar `gitCommitSha` nos metadados da Vercel.
- **Mitigação / Regra**: Após o upload, executar `vercel inspect <deployment>`, aguardar `Ready`, consultar logs recentes e fazer smoke HTTP das rotas críticas. Confirmar separadamente que `origin/main` aponta para o commit publicado; não tratar alias ou HTTP 200 como prova de todos os fluxos de negócio.

### [2026-09-08] Limpeza seletiva de logs no Convex de produção
- **Ponto de fricção**: O `.env.local` aponta para um deployment local/anônimo; executar uma mutação destrutiva sem selecionar explicitamente a produção poderia atingir o alvo errado. A CLI Convex no Windows também exige o runtime Node 24 usado pelo projeto para evitar falhas do Node 25.
- **Mitigação / Regra**: Para limpeza autorizada, reconfirmar contagens e totais no host HTTPS de produção, executar uma `internalMutation` temporária com pré-condições exatas, verificar os zeros e a preservação das demais tabelas, remover a rotina destrutiva e publicar novamente o código limpo.


### [2026-09-08] Fila de espera: permissões de consulta e validação móvel
- Consultas usadas por `src/lib/staffConvex.ts` precisam constar também em `shared/accessPolicy.ts`. Sem o registro, a consulta é silenciosamente pulada e o painel permanece carregando, mesmo com a autorização correta no backend. As consultas da fila e de falhas de entrega foram registradas; `tests/waitlist-ui.test.tsx` cobre o wrapper real.
- O teste de agenda a 390px revelou overflow no cabeçalho de ações e na linha do título. Manter quebra de linha, `min-w-0` e horário sem encolhimento ao adicionar o botão da fila. Portal e agenda foram conferidos com largura do documento igual à viewport.
- Para testar sem mensagens a pacientes reais, usar backend Convex anônimo isolado em `.artifacts/fila-e2e`, sem copiar `.env*` ou instâncias UAZAPI. O fluxo autenticado local comprova o encaixe e a falha sinalizada, mas não comprova entrega física no WhatsApp.


### [2026-09-08] Validação local do agendamento em grupo por sala
- Listagem e confirmação precisam usar o mesmo par sala/profissional e o menor limite entre serviço, sala e sessão. A aprovação pela recepção também deve reutilizar a sessão e respeitar a fila de espera. As regressões estão cobertas em `tests/group-booking.test.ts` e `tests/group-booking-ui.test.tsx`.
- Pedidos pendentes continuam sem ocupar vaga até a aprovação; a confirmação revalida disponibilidade e capacidade. Novos pedidos guardam a especialidade; o campo é opcional para preservar registros anteriores. Sessões antigas classificadas como individuais não são convertidas automaticamente em turmas.
- Nesta tarefa, o build local foi validado com `VITE_CONVEX_URL=https://build-validation.convex.cloud` somente no processo, sem acesso ao backend. O `dist` resultante é de validação: antes de qualquer publicação futura, gerar novamente com a URL real do deployment. Nenhum cadastro ou deployment de produção foi alterado.

### [2026-09-08] Erro genérico ao salvar horário semanal
- A tela de disponibilidade mostrava criar/editar para todos os perfis, mas `availability.saveRule` sempre exigiu `admin` no backend. Em produção, erros `Error` do Convex apareciam apenas como `Server Error Called by client`, ocultando a causa para o usuário.
- A interface agora deixa as regras visíveis para consulta e esconde as ações de escrita para não-admin; o backend mantém a proteção e devolve `ConvexError` para permissão, conflito de sala/profissional e valores inválidos. A regressão está coberta em `tests/availability.test.ts`.

### [2026-09-09] Encaixe confirmava sem salvar o participante
- `addParticipantToClass` consultava `schedules` e `patients` locais vazios, enquanto a tela exibia as queries Convex; o retorno silencioso gerava falso sucesso sem chamar a mutação. A função agora aguarda diretamente o servidor e propaga falhas, usando as consultas reativas para participantes, vagas e créditos. Isso também cobre o horário recém-criado antes da atualização da query.
- Regressão reproduzida antes da correção. Seis testes do provider/tela cobrem os dois botões, atualização do participante/vagas, criação seguida de matrícula e propagação de erros. Total da verificação dirigida: 31 testes, TypeScript e build aprovados. Usar Node 24: o Node 25 do sistema expõe `localStorage` sem `getItem` no ambiente de teste.
- Frontend publicado em `https://altar-fisio.vercel.app`, deployment `dpl_GrveXszpZK3Qs2SXQ9GAFqrYgGgr` READY. Sem alteração no backend ou agendamento em paciente real; a validação de fluxo foi automatizada com mocks das chamadas Convex. A regra existente do servidor continua rejeitando sessões passadas.


### [2026-09-09] Erros claros no encaixe administrativo
- Logs remotos de `schedules:addParticipantToSchedule` às 12:56 confirmaram `Sessão indisponível`. A mutação bloqueia sessões não agendadas ou cujo início já passou; a reprodução automatizada com 09/09 às 08:00 confirmou o bloqueio temporal. A permissão de registro retroativo ainda depende da decisão do responsável.
- Regras da agenda, validação, autenticação de funcionários e créditos de reposição agora usam `ConvexError` para transportar motivos de negócio. `staffConvex` extrai somente os dados públicos de erros nas mutations/actions e usa orientação genérica nos imprevistos, preservando a causa técnica no erro. Não exibir diretamente a mensagem técnica do transporte Convex.
- Encaixe verifica paciente ativo e prioriza aviso de duplicidade antes de lotação. Testes cobrem persistência, duplicidade, lotação, horário passado, status, sessão expirada, crédito obrigatório e tratamento de erros. Os 147 testes Vitest passaram entre a suíte e a repetição dirigida dos três testes afetados por texto; três testes de service worker, TypeScript e build de validação passaram. Alterações locais, sem publicação ou agendamento em paciente real.

- Publicação autorizada e concluída: Convex `exuberant-guanaco-180` (dry-run e deploy aprovados) e Vercel `dpl_8ZfF1PK1e8W7VDkoAdg7soqPWM2P` READY no alias `https://altar-fisio.vercel.app`. Consulta remota com sessão inválida confirmou o novo `errorData` legível sem acessar pacientes. Bundle público contém o tratamento de erros e o host correto; `/`, `/login` e `/sw.js` responderam 200. Nenhum erro encontrado nos logs Vercel consultados. Horários passados continuam bloqueados; sem commit/push e sem agendamento real. Lint dirigido teve apenas aviso preexistente de import não utilizado.

### [2026-09-09] Revisão de saldo, capacidade e detalhes das turmas mensais
- O endpoint antigo de reserva ignorava créditos de reposição pendentes. O cálculo de saldo livre agora é compartilhado entre a matrícula mensal, a reserva avulsa do portal e o resumo dos planos; créditos disponíveis e válidos permanecem comprometidos, enquanto créditos vencidos não bloqueiam saldo.
- Reposição e fila verificavam apenas a capacidade gravada na sessão. Agora reservas, reposições, remarcações e listagens usam o menor limite atual entre sessão, sala e serviço, evitando excesso de pacientes após redução de capacidade.
- O resumo mensal mostrava somente datas e escondia mudanças pontuais de horário/profissional/sala. Cada encontro agora retorna e apresenta seus próprios detalhes na confirmação.
- Regressões reproduziram os três defeitos antes da correção, incluindo limites de sala e serviço separadamente. Validação local: 195 testes Vitest, 3 testes de service worker, TypeScript e build passaram. O build foi gerado com URL HTTPS fictícia de validação; deve ser regenerado com o destino correto antes de publicar. Nenhum deploy executado nesta correção.
- Publicação posterior autorizada: dry-run e deploy Convex concluídos em https://exuberant-guanaco-180.convex.cloud usando Node 24.19.0 e autenticação existente. Build Vercel regenerado com configuração real de produção; TypeScript e build passaram. Lint terminou sem erro, com avisos existentes.
- Frontend publicado como dpl_Gk7rKgZ2EMGmXL7nGPP1RdZBsL9U (READY), alias https://altar-fisio.vercel.app. Rotas /, /login, /portal, /agendar e /sw.js responderam HTTP 200. Asset do portal publicado é idêntico ao build local e referencia o backend correto. Consulta de configuração Convex passou; consulta do paciente sem autenticação foi rejeitada. Nenhum log de erro retornado pela consulta Vercel desse deployment. Não foram criadas reservas reais nem repetidos fluxos autenticados nesta publicação.

### [2026-09-09] Horários passados na agenda pública
- A confirmação já rejeitava reservas passadas, mas `getPublicSlots` continuava listando esses horários. A consulta agora filtra pelo início da sessão em `America/Sao_Paulo`; a página atualiza o relógio a cada segundo e ao recuperar foco/visibilidade, invalida a seleção vencida e revalida antes do envio. Removido o fallback de envio para 08:00 sem seleção.
- O calendário atualiza os dias na virada da data da clínica. Testes cobrem 19:39, início exato, virada UTC, meia-noite em São Paulo, amanhã e rejeição sem persistência com/sem aprovação. Verificação: 206 testes Vitest, 3 testes do service worker, TypeScript e build aprovados; repetição dirigida de 38 testes passou após alterações concorrentes no mesmo checkout.
- Correção local, sem deploy nesta tarefa. Build usa host fictício de validação e precisa ser regenerado com o ambiente real antes de publicar. Alterações de outra tarefa no formulário e demais arquivos foram preservadas.

### [2026-09-09] Resposta perdida no envio do agendamento público
- O cliente WebSocket do Convex rejeita actions em andamento ao reconectar com `Connection lost while action was in flight`; a gravação pode ter terminado. Logs de produção mostraram persistPublicBooking concluída em 39 ms e submitPublicBooking em 2242 ms às 19:40:30, sem permitir correlacionar essa execução ao paciente que relatou o erro.
- O envio público agora usa ConvexHttpClient via HTTP. Uma chave UUID por payload permite repetir a solicitação na mesma página; publicBookingReceipts salva a confirmação na mesma transação que a reserva, com hash dos argumentos para rejeitar reutilização com dados diferentes. A chave permanece durante repetição manual e uma repetição automática após erro de rede. Recarregar a página gera outra chave; confirmar com a recepção antes de escolher outro horário após uma resposta incerta.
- Validação local: regressões de resposta perdida, reenvios concorrentes, aprovação manual, unicidade de reserva/auditoria/notificação e mensagens de negócio passaram; TypeScript e build passaram. Não publicado nesta sessão. Existem alterações simultâneas de outras tarefas no workspace; preservar essas alterações ao preparar a publicação.

### [2026-09-09] Confirmação editável no construtor de agendamento
- A tela de sucesso tinha textos fixos e a prévia só abria o formulário. A configuração opcional `bookingFormConfig.confirmation` agora controla títulos, pagamento, endereço, orientações, rótulos e visibilidade de blocos/botões; edições das outras seções preservam esses valores.
- Prévia real em `/agendar?preview=builder&confirmation=confirmed` ou `pending`, com dados fictícios e links externos desativados. Sem `preview=builder`, o parâmetro não simula uma reserva. A prévia usa alterações salvas. Solicitações pendentes exibem mensagem própria e “Aguardando aprovação”.
- Ao editar arquivos por Python no Windows, declarar UTF-8 explicitamente e preservar quebras de linha; o padrão cp1252 pode gerar bytes inválidos em novas mensagens acentuadas. Ocorrência corrigida antes da validação.
- Validação local: 210 testes Vitest e 3 de service worker passaram; TypeScript e build aprovados. Sem publicação Convex/Vercel e sem reservas reais nesta tarefa.
- Publicação autorizada concluída: Convex `exuberant-guanaco-180` (dry-run, TypeScript, schema e deploy aprovados, sem exclusão de índices) e Vercel `dpl_9ubafrpCTmyUirKteuJBqmNoRZY7` READY, alias https://altar-fisio.vercel.app. Build de produção regenerado com Node 24 e backend correto. Assets do construtor e confirmação publicados idênticos ao build; consulta pública de configuração e rotas HTTP passaram. Navegador confirmou as prévias de confirmação e pendência, com dados fictícios e links externos desativados. Sem alteração de textos da clínica ou criação de reservas reais; salvamento autenticado segue coberto pelos testes locais, não foi repetido em produção. Sem commit/push nesta publicação.
