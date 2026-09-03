# DESAFIOS.md — Registro de Desafios e Pontos de Fricção

Este arquivo é lido no início de cada nova sessão e atualizado ao final de cada sessão para garantir auto-aprendizado contínuo.

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
- **Mitigação / Regra**: A CLI do Convex espera a variável de ambiente `CONVEX_OVERRIDE_ACCESS_TOKEN` para tokens de acesso pessoal da plataforma. Com ela definida e `CONVEX_DEPLOYMENT="prod:<deployment-name>"`, comandos como `npx convex deploy`, `npx convex run` e queries remotas funcionam de forma não-interativa e estável.

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