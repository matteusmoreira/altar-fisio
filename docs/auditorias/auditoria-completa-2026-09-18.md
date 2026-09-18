# Relatório Consolidado de Auditoria Técnica e de Experiência
**Projeto:** Altar Fisio — Clínica, Pilates & RPG (Dr. Marcelo Henrique)  
**Data da Execução:** 18 de setembro de 2026  
**Auditor Responsável:** Auditoria Técnica Sênior de Aplicações  
**Modo de Execução:** Auditoria Estrita (Sem modificações no código da aplicação)  

---

## A. Resumo Executivo

O **Altar Fisio** é uma plataforma clínica e de studio integrada moderna, construída sobre **React 19**, **Vite 8**, **TypeScript** e **Convex Cloud**. O sistema engloba três frentes operacionais:
1. **Painel Clínico e Administrativo:** Agenda de salas, gestão de turmas recorrentes, cadastro de pacientes, prontuário eletrônico no padrão SOAP com registro de fotos posturais, laudos médicos/fisioterapêuticos com hash auditável, controle financeiro (fluxo de caixa e comissões) e disparador de mensagens WhatsApp (UAZAPI).
2. **Portal do Paciente:** Autoatendimento mobile com visualização de agendamentos, cancelamentos com geração de créditos de reposição e fila de espera inteligente.
3. **Agendamento Público & Triagem:** Formulário público de autoagendamento para novos pacientes com triagem de queixas e escolha de planos/pacientes.

### Situação Geral do Sistema
O sistema apresenta **excelente maturidade de segurança, arquitetura e blindagem de backend**, destacando-se positivamente pelo uso de transações ACID no Convex, hashing criptográfico de senhas com algoritmo `scrypt` em parâmetros de alto custo, autorização RBAC rigorosa no servidor por função (`requireStaff` e `requirePatient`), sanitização contra ataques SSRF nas integrações de WhatsApp e proteção contra submissões concorrentes duplicadas por meio de recibos criptográficos idempotentes.

Entretanto, para que a aplicação esteja plenamente **pronta para produção comercial**, foram identificados **dois bloqueadores regulatórios/legais de saúde e privacidade**, **um bloqueador de acessibilidade mobile** e **uma fragilidade na suíte de testes automatizados**, detalhados a seguir:

1. **Bloqueador Regulatório / Médico-Legal (COFFITO e CFM):** A função de exclusão de pacientes (`deletePatient`) executa a deleção física imediata (*hard delete*) do prontuário clínico e das evoluções diárias SOAP. As resoluções do COFFITO (nº 414/2012) e a legislação federal (Lei 13.787/2018) exigem a guarda obrigatória do prontuário médico-fisioterapêutico por no mínimo **20 anos**. O sistema deve aplicar exclusão lógica (*soft delete* / arquivamento).
2. **Bloqueador de Privacidade / Marco Civil (LGPD):** A rotina diária de limpeza (`runDailyMaintenance`) expurga a trilha de auditoria (`auditLogs`) com mais de 60 dias. O Marco Civil da Internet (Art. 15) e as boas práticas da LGPD exigem a retenção de registros de acesso a dados sensíveis de saúde por no mínimo **6 meses (180 dias)**.
3. **Bloqueador de Acessibilidade Mobile (WCAG 2.2 AA — Critério 1.4.4):** A tag `<meta name="viewport">` no `index.html` contém `maximum-scale=1.0, user-scalable=no`, bloqueando o zoom de pinça em dispositivos móveis e violando normas de acessibilidade para usuários com baixa visão.
4. **Fragilidade em Teste Automatizado:** 51 dos 52 arquivos de teste passaram (286 testes unitários e de integração aprovados), mas `tests/quick-booking-enhancements.test.tsx` falhou devido ao acoplamento a datas estáticas (`2026-09-17` no mock vs `2026-09-18` da data atual da execução).

---

## B. Escopo e Cobertura da Auditoria

| Frente Auditada | Análise Estática de Código | Teste Automatizado Executado | Resultado | Detalhes & Limitações |
| :--- | :---: | :---: | :---: | :--- |
| **Tipagem & Compilação** | PASSOU | `tsc -b` | **PASSOU** | 0 erros de TypeScript no código de produção e testes. |
| **Linting & Boas Práticas** | PASSOU | `oxlint` | **PASSOU** | 0 erros; 320 advertências (imports não utilizados e avisos do React Compiler). |
| **Build de Produção** | PASSOU | `npm run build` | **PASSOU** | Gerado com sucesso em 1.39s com isolamento de chunks e proteção de URL de produção. |
| **Suíte de Testes Geral** | PASSOU | `vitest run` | **FALHOU (1 teste)** | 51 arquivos passaram (286 testes OK); 1 falhou por data estática de mock. |
| **Service Worker & PWA** | PASSOU | `node --test` | **PASSOU** | 3/3 testes aprovados (estratégia Network-first e fallbacks offline). |
| **Segurança & RBAC Backend** | PASSOU | `production-security.test.ts`| **PASSOU** | 20/20 testes de segurança aprovados (sessões, segredos, RBAC, DoS, SSRF). |
| **Banco de Dados & Transações**| PASSOU | Inspeção de Schemas e Queries | **PASSOU** | Índices adequados, transações ACID nativas, idempotência em agendamentos. |
| **Conformidade Médico-Legal** | PASSOU | Inspeção de `deletePatient` | **FALHOU** | Exclusão física de prontuário viola prazo de 20 anos do COFFITO. |
| **Conformidade LGPD (Logs)** | PASSOU | Inspeção de `maintenance.ts` | **FALHOU** | Expurgos de logs de auditoria aos 60 dias violam o piso de 180 dias. |
| **Acessibilidade (WCAG 2.2 AA)** | PASSOU | Inspeção de Viewport e CSS | **FALHOU** | Zoom bloqueado no mobile (`user-scalable=no`) e contraste reduzido no dark mode. |
| **SEO & Metadados Públicos** | PASSOU | Inspeção de `public/` e HTML | **FALHOU** | Ausência de `robots.txt`, `sitemap.xml`, meta description e tags Open Graph. |
| **Integração WhatsApp & Email** | PASSOU | Inspeção de `whatsapp.ts` | **PASSOU** | SSRF protegido, segredos isolados, formatação e deduplicação de envios. |
| **Operação Real em Nuvem** | NÃO EXECUTADO| Sem acesso a painéis externos | **NÃO EXEC.** | Deploy Convex em nuvem e painel Vercel dependem de conferência externa. |

---

## C. Inventário Consolidado de Achados

### [ACHADO-01] Exclusão Física de Prontuários e Evoluções Clínicas no `deletePatient`
- **Categoria:** Conformidade Regulatória / Integridade de Dados / Saúde
- **Prioridade:** **P0 (Bloqueador de Produção)**
- **Tipo de Evidência:** Inspeção de Código Confirmada
- **Localização:** `convex/patients.ts`, linhas 164–186
- **Cenário / Reprodução:** Um administrador exclui um cadastro de paciente através de `deletePatient`. A mutação executa `ctx.db.delete` nos registros de `clinicalRecords` e em todas as instâncias de `clinicalEvolutions` associadas.
- **Comportamento Observado:** O prontuário e as evoluções clínicas SOAP assinadas pelo fisioterapeuta são apagados definitivamente do banco de dados.
- **Comportamento Esperado:** Conforme a **Resolução COFFITO nº 414/2012** e a **Lei Federal nº 13.787/2018**, o prontuário eletrônico deve ser guardado por no mínimo 20 anos a partir do último registro. O paciente deve ser desativado logicamente (`active: false`) ou arquivado, preservando as evoluções clínicas para respaldo do profissional.
- **Impacto:** Risco de infração ética perante o CREFITO/COFFITO e desproteção jurídica da clínica em caso de processos judiciais ou perícias.
- **Correção Recomendada:** Alterar a lógica do `deletePatient` para efetuar *soft delete* (marcar `active: false` e revogar sessões do portal com `revokePatientSessions`), mantendo as evoluções e prontuários intactos; ou exigir confirmação específica para arquivamento com preservação da tabela `clinicalRecords`.
- **Risco da Mudança:** Mínimo.
- **Esforço Relativo:** Baixo (~15 minutos).
- **Como Comprovar:** Criar teste unitário em `tests/patient-fields.test.ts` verificando que desativar um paciente preserva suas evoluções SOAP no banco.

---

### [ACHADO-02] Expurgo Prematuro dos Logs de Auditoria LGPD aos 60 Dias
- **Categoria:** Segurança / Privacidade / Conformidade LGPD
- **Prioridade:** **P1 (Alta Prioridade)**
- **Tipo de Evidência:** Inspeção de Código Confirmada
- **Localização:** `convex/maintenance.ts`, linhas 46–51
- **Cenário / Reprodução:** O cron diário `manutencao-limpeza-banco` executa `runDailyMaintenance` e calcula `sixtyDaysAgoMs = now - 60 * 24 * 60 * 60 * 1000`, apagando todos os registros de `auditLogs` anteriores a essa marca.
- **Comportamento Observado:** Logs de auditoria (quem visualizou prontuário, quem exportou atestados, quem gerou TCLE) são destruídos após 60 dias.
- **Comportamento Esperado:** Conforme o Artigo 15 do Marco Civil da Internet (Lei 12.965/2014) e as diretrizes de responsabilidade da LGPD (Art. 37), registros de acesso e auditoria a aplicações devem ser retidos por no mínimo **6 meses (180 dias)**.
- **Impacto:** Impossibilidade de auditar vazamentos ou acessos indevidos a prontuários ocorridos há mais de 2 meses.
- **Correção Recomendada:** Ajustar o filtro de retenção em `maintenance.ts` para no mínimo 180 dias (`oneHundredEightyDaysAgoMs = now - 180 * 24 * 60 * 60 * 1000`) ou 365 dias, considerando que logs de auditoria em texto ocupam espaço desprezível no banco.
- **Risco da Mudança:** Nenhum.
- **Esforço Relativo:** Mínimo (1 linha).
- **Como Comprovar:** Teste unitário conferindo que logs com 90 dias não são expurgados pela rotina.

---

### [ACHADO-03] Bloqueio de Zoom no Viewport Mobile (`user-scalable=no`)
- **Categoria:** Acessibilidade / UX Mobile
- **Prioridade:** **P1 (Bloqueador de Acessibilidade)**
- **Tipo de Evidência:** Inspeção de Código Confirmada
- **Localização:** `index.html`, linha 7
- **Cenário / Reprodução:** O cabeçalho HTML declara:  
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />`
- **Comportamento Observado:** O navegador móvel bloqueia o gesto de pinça para ampliar o tamanho de textos e botões.
- **Comportamento Esperado:** Em conformidade com a diretriz **WCAG 2.2 AA (Critério 1.4.4 — Resize Text)**, o usuário deve ser capaz de dar zoom de até 200% sem perda de funcionalidade.
- **Impacto:** Pacientes idosos ou com deficiência visual ficam impossibilitados de ampliar o texto no portal do paciente ou na página de agendamento.
- **Correção Recomendada:** Substituir por:  
  `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
- **Risco da Mudança:** Baixo (verificar se modais específicos sofrem distorção com zoom).
- **Esforço Relativo:** Mínimo (1 linha).
- **Como Comprovar:** Inspecionar no Chrome DevTools com emulação móvel e testar pinch-to-zoom.

---

### [ACHADO-04] Quebra de Teste Automatizado por Dependência de Data Estática
- **Categoria:** Testes & Qualidade
- **Prioridade:** **P2 (Qualidade de CI/CD)**
- **Tipo de Evidência:** Execução de Comando Confirmada (`npx vitest run tests/quick-booking-enhancements.test.tsx`)
- **Localização:** `tests/quick-booking-enhancements.test.tsx`, linhas 74–94 e 375
- **Cenário / Reprodução:** O teste mockou o slot da grade semanal com data estática `day: '2026-09-17'`. No componente `QuickBookingPage`, o dia selecionado é inicializado com `getTodayDateString()`, que no dia 18/09/2026 retorna `2026-09-18`. Ao filtrar `daySlots = slots.filter(s => s.day === selectedDay)`, o slot de 17/09 foi omitido da grade, impedindo que o seletor `screen.getByText('2/8')` encontrasse o elemento.
- **Comportamento Observado:** O teste falha com `TestingLibraryElementError: Unable to find an element with the text: 2/8`.
- **Comportamento Esperado:** Testes que dependem de datas relativas devem utilizar data dinâmica derivada de `getTodayDateString()` ou congelar o relógio com `vi.useFakeTimers({ now: new Date('2026-09-17T12:00:00Z') })`.
- **Impacto:** Falso positivo na esteira de integração contínua (CI/CD), quebrando builds automáticos em dias subsequentes.
- **Correção Recomendada:** No mock do teste, gerar o `day` do slot dinamicamente a partir de `getTodayDateString()` ou configurar o timer fake do Vitest.
- **Risco da Mudança:** Nenhum na aplicação (apenas no arquivo de teste).
- **Esforço Relativo:** Mínimo (2 linhas).
- **Como Comprovar:** Executar `npm test` e verificar aprovação de 100% dos testes.

---

### [ACHADO-05] Ausência de Arquivos de SEO (`robots.txt`, `sitemap.xml` e Metadados Sociais)
- **Categoria:** SEO & Descoberta Pública
- **Prioridade:** **P2 (Visibilidade do Produto)**
- **Tipo de Evidência:** Inspeção de Diretório Confirmada (`public/` e `index.html`)
- **Localização:** Raiz de `public/` e `index.html`
- **Cenário / Reprodução:** O diretório `public/` não contém `robots.txt` nem `sitemap.xml`. O `index.html` não contém meta tag de descrição (`<meta name="description">`) nem Open Graph / Twitter Card.
- **Comportamento Observado:** Mecanismos de busca (Google, Bing) podem indexar rotas internas do painel com títulos genéricos da SPA ou não priorizar a página pública `/agendar`. Links compartilhados no WhatsApp não geram preview rico da clínica.
- **Comportamento Esperado:**  
  1. `public/robots.txt` orientando robôs a indexarem rotas públicas (`/agendar`, `/portal`) e desautorizando rotas do painel restrito (`/dashboard`, `/pacientes`, `/financeiro`, `/clinical`).  
  2. `public/sitemap.xml` com as URLs públicas canônicas.  
  3. Meta tags de descrição e Open Graph no `index.html`.
- **Impacto:** Perda de pacientes orgânicos no Google e aparência amadora ao compartilhar links no WhatsApp.
- **Correção Recomendada:** Criar os arquivos estáticos `robots.txt` e `sitemap.xml` em `public/` e enriquecer o `<head>` do `index.html`.
- **Risco da Mudança:** Nenhum.
- **Esforço Relativo:** Baixo.
- **Como Comprovar:** Inspecionar os endpoints `/robots.txt` e `/sitemap.xml` no servidor de desenvolvimento.

---

### [ACHADO-06] Contraste de Cores em Botões Primários no Modo Escuro
- **Categoria:** Acessibilidade / Design System
- **Prioridade:** **P3 (Refinamento Visual)**
- **Tipo de Evidência:** Análise de Tokens CSS (`src/index.css`)
- **Localização:** `src/index.css`, linhas 58–59 e `src/components/ui/button.tsx`
- **Cenário / Reprodução:** No modo escuro (`.dark`), o token `--primary` é `158 64% 45%` (esmeralda claro vibrante) e `--primary-foreground` é `0 0% 100%` (branco puro).
- **Comportamento Observado:** A relação de contraste de texto branco sobre verde esmeralda claro atinge cerca de ~1.9:1, quando a norma WCAG 2.2 AA exige no mínimo 4.5:1 para texto normal.
- **Comportamento Esperado:** Para fundos primários claros no tema escuro, a cor do texto do botão deve ser escura (ex: `--primary-foreground: 224 71% 4%`), ou o verde do botão deve ter luminosidade reduzida para garantir legibilidade.
- **Impacto:** Dificuldade de leitura para colaboradores que utilizam o sistema no tema escuro.
- **Correção Recomendada:** Ajustar `--primary-foreground` no bloco `.dark` de `src/index.css` para um tom escuro de alto contraste.
- **Risco da Mudança:** Mínimo.
- **Esforço Relativo:** Mínimo.
- **Como Comprovar:** Inspecionar com a ferramenta de contraste do navegador.

---

## D. Plano de Ação em Ordem de Prioridade

### 🚨 Bloqueadores Imediatos para Publicação (Executar nesta ordem):
1. **Ajustar `deletePatient` para Soft Delete Clínico (`convex/patients.ts`):**  
   *Ação:* Impedir que a exclusão de paciente apague o histórico clínico de prontuários e evoluções SOAP. Marcar `active: false`, registrar na trilha de auditoria e revogar sessões.  
   *Verificação:* Executar os testes de pacientes e conferir que o prontuário permanece no banco.
2. **Ampliar Retenção de Logs de Auditoria em `convex/maintenance.ts`:**  
   *Ação:* Alterar a janela de expurgo de `auditLogs` de 60 dias para 180 dias (Marco Civil da Internet / LGPD).  
   *Verificação:* Rodar testes de manutenção e validar a retenção de registros.
3. **Liberar Zoom no Viewport Mobile em `index.html`:**  
   *Ação:* Remover `maximum-scale=1.0, user-scalable=no` da meta tag viewport.  
   *Verificação:* Testar em dispositivo móvel ou emulador Chrome DevTools.
4. **Corrigir Mock de Data em `tests/quick-booking-enhancements.test.tsx`:**  
   *Ação:* Utilizar data dinâmica derivada de `getTodayDateString()` no slot de mock para reestabelecer 100% de aprovação na suíte de testes.  
   *Verificação:* Executar `npm test` e obter 52/52 arquivos e 287/287 testes aprovados.

### ⚡ Outras Correções & Melhorias Recomendadas:
5. **Adicionar `public/robots.txt` e `public/sitemap.xml`:**  
   *Ação:* Proteger rotas privadas contra indexação e declarar as URLs públicas (`/agendar`, `/portal`) com metadados e tags Open Graph.
6. **Ajustar Contraste do Botão Primário no Dark Mode (`src/index.css`):**  
   *Ação:* Atualizar `--primary-foreground` no `.dark` para garantir relação de contraste ≥ 4.5:1.

---

## E. Verificações Executadas e Pendências

### Comandos Efetivamente Executados na Auditoria:
| Comando | Código de Saída | Resultado Observado |
| :--- | :---: | :--- |
| `git status` | 0 | Branch `main`, working tree limpo e atualizado com origin. |
| `git log -n 1 --oneline` | 0 | Commit `50d159a` inspecionado. |
| `npx oxlint` | 0 | 0 erros, 320 avisos pontuais. |
| `npx tsc -b` | 0 | 0 erros de tipagem TypeScript. |
| `npm test` | 1 | 51 arquivos passaram, 1 falhou por data estática de mock. |
| `npx vitest run tests/production-security.test.ts` | 0 | 20 testes de segurança aprovados em 2.83s. |
| `node --test scripts/service-worker.test.mjs` | 0 | 3 testes de Service Worker aprovados. |
| `$env:VITE_CONVEX_URL="..."; npm run build` | 0 | Build Vite concluído com sucesso em 1.39s. |

### Pendências que Dependem de Painel Externo / Decisão Humana:
- **Painel Convex Cloud:** Confirmar se as variáveis de produção (`UAZAPI_ADMIN_TOKEN`, `RESEND_API_KEY`) estão devidamente preenchidas no ambiente `exuberant-guanaco-180`.
- **Painel Vercel:** Confirmar se a variável `VITE_CONVEX_URL` está configurada como `https://exuberant-guanaco-180.convex.cloud` nas *Environment Variables* da Vercel.
- **Rotina de Backup Externo:** Definir política de extração de cópias locais/frias do banco (`npx convex export`) para guarda independente de longo prazo fora do provedor único.

---

## F. Parecer de Publicação

**Classificação Oficial:**  
### ⚠️ NÃO RECOMENDADO ATÉ RESOLVER OS BLOQUEADORES

**Justificativa Técnica:**  
A aplicação apresenta excelente engenharia de software, alta performance e arquitetura segura. No entanto, não é recomendada a publicação imediata em produção comercial até que os **4 bloqueadores prioritários** sejam ajustados:
1. Eliminar o *hard delete* de prontuários em `deletePatient` (exigência médico-legal de 20 anos pelo COFFITO);
2. Ajustar a retenção de logs de auditoria para 180 dias em `maintenance.ts` (Marco Civil / LGPD);
3. Liberar o zoom de tela no `index.html` (WCAG 2.2 AA);
4. Tornar dinâmica a data do teste unitário em `quick-booking-enhancements.test.tsx` para garantir esteira de CI/CD verde e confiável.

Após a resolução cirúrgica desses 4 itens (estimada em menos de 1 hora de trabalho técnico), o sistema estará **plenamente recomendado para publicação**.
