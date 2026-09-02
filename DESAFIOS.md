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