# DESAFIOS.md — Registro de Desafios e Pontos de Fricção

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
