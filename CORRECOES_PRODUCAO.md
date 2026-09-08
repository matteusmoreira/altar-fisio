# Correções de produção — 2026-09-08

Implementação e verificação local concluídas. Escopo: 12 achados de REVISAO_PRODUCAO.md; correção prévia do PWA preservada. Não constitui liberação de produção: ambiente remoto e fluxos reais ainda não foram homologados.

## Decisões
- Manter sessões próprias, com guardas centralizadas, versões de sessão, expiração e limitação de login. Remover login/seed de demonstração.
- Portal: acesso por link secreto temporário emitido pela equipe após verificar identidade, sem identificação pública por nome/CPF. Não enviar mensagens automaticamente durante implementação.
- Branding público separado de configuração administrativa. Segredos persistidos apenas no servidor.
- Gravações aguardam confirmação e propagam erro; cache de dados sensíveis removido.

## Etapas
1. Guardas backend e clientes autenticados.
2. Portal, integrações e remoção de demonstração.
3. Persistência e validações de domínio.
4. Dependência, configuração e testes de regressão.
5. Revisão independente de bypasses e relatório final.

Sem deploy, commit, push ou dados remotos nesta etapa.

## Resultado por achado
| Achado | Correção aplicada |
| --- | --- |
| 1. API administrativa | Guardas centrais validam sessão, versão, expiração, usuário ativo e perfil antes do acesso. Cliente injeta sessão e limita consultas por perfil; provider monta após login. Identidade do audit log vem da sessão. |
| 2. Login/seed | Removidos login rápido, enumeração de perfis, seeds públicos e credenciais fixas. Senhas scrypt, tokens aleatórios, sessões de 8 horas e limite de tentativas. Provisionamento exclusivamente interno. |
| 3. Segredos | Branding público usa lista explícita de campos. Administração recebe indicadores de configuração; tokens de WhatsApp não retornam ao cliente. Endpoint restrito a HTTPS UAZAPI. Campos secretos vazios preservam configuração existente. |
| 4. Portal | Link individual aleatório com validade de 24 horas, hash no banco e vínculo obrigatório ao paciente em todas as operações. Nova emissão revoga link anterior; logout revoga acesso. Equipe emite link após conferir identidade. |
| 5. Integrações | Actions verificam perfil; tarefas de cron são internas. Operações recebem identificador local, resolvem token no servidor. Falha do provedor preserva instância local; erros HTTP não expõem corpo do provedor. E-mail sem configuração retorna falha, sem sucesso simulado. |
| 6. Persistência | Cadastro, prontuário, evolução e consentimento aguardam confirmação e propagam rejeição. Histórico e gráfico usam banco; upload de foto altera apenas campo correspondente. Formulário aguarda carregamento do prontuário. |
| 7. Atualização parcial | Campos omitidos permanecem intactos; alternar atividade não apaga cadastro. |
| 8. Agenda | Validação compartilhada de datas, horários, sala/profissional ativos, conflitos e capacidade. Reserva pública verifica vaga e preço no servidor. Portal rejeita reaproveitar cancelamento/remarcação e colisão de horários do paciente. |
| 9. Financeiro | Valores finitos, positivos e com precisão monetária; fechamento de comissão rejeita negativos. |
| 10. Cache | Dados clínicos e pacientes removidos do localStorage; chaves legadas limpas. Resposta vazia do servidor não reativa demonstração; sessões usam sessionStorage. |
| 11. Build | Build de produção rejeita URL ausente, local ou insegura do backend. |
| 12. XLSX | Distribuição oficial SheetJS 0.20.3, mantendo duas abas; exportações HTML escapam conteúdo e prefixos de fórmula. |

## Verificação final
- `npm test`: **26 testes aprovados** (23 Vitest + 3 Service Worker). Dados fictícios em convex-test e DOM simulado; sem chamadas a provedores reais.
- Cobertura dirigida: acessos anônimo/expirado/legado/inativo, perfis, segredos, ator de auditoria, limitação de login, provisionamento/login real com scrypt, portal e revogação, edição parcial, valores financeiros, colisões da agenda, repetição de remarcação, erros de persistência, exportação, falhas do WhatsApp e e-mail sem configuração.
- `npx tsc -b`: aprovado.
- Bundle Vite aprovado com URL fictícia HTTPS e saída isolada `.artifacts/build-validation`. Esse artefato **não deve ser publicado**. O ambiente local atual aponta para backend local; build normal bloqueia essa configuração intencionalmente.
- `npm audit --json`: zero vulnerabilidades reportadas. Não substitui auditoria de lógica nem garante cobertura de pacote distribuído fora do registry.
- `npm run lint`: exit 0, **300 avisos**, zero erros. Ainda há dívida de variáveis não usadas e hooks; não alegar lint sem avisos. Revisão inicial tinha 234 avisos; guardas e propagação de erros aumentaram o total apesar da limpeza parcial.
- `git diff --check`: aprovado.
- Revisão independente de bypasses e regressões concluída; corrigidos os quatro apontamentos: comissão negativa, repetição de remarcação, gráfico clínico local e erro de consentimento ocultado.

## Pós-publicação
1. Convex e Vercel já estão publicados no alvo correto; a assinatura das APIs mudou e clientes antigos devem ser atualizados junto.
2. Conta admin real já foi provisionada pela action interna `authActions:provisionUser`, com senha mínima de 12 caracteres. Contas com hash legado deixam de autenticar; sessões antigas não são aceitas.
3. Substituir credenciais de demonstração/integração que tenham sido usadas ou expostas. Remoção do código não remove valores do histórico Git. Configurar tokens UAZAPI/Resend pelo administrador.
4. Homologar login por perfil, cadastro, prontuário/fotos/consentimento, agendamento público, link do portal, cancelamento/reposição e financeiro. Confirmar browser autenticado, mobile, falhas de rede e entrega efetiva dos provedores.
5. Verificar backup e restauração antes de ampliar o uso com dados reais. Os testes locais e o smoke publicado não exercitam todos os limites do Convex remoto, equipamentos físicos ou disponibilidade contínua.

## Referências
- Distribuição oficial SheetJS: https://docs.sheetjs.com/docs/getting-started/installation/frameworks/
- Runtime Convex: https://docs.convex.dev/functions/runtimes

## Conta administrativa local — 2026-09-08
- Por solicitação expressa do responsável, mínimo de senha ajustado para 12 caracteres. Hash scrypt e demais controles mantidos.
- Conta matteusmoreira@gmail.com provisionada com perfil admin; login e identidade confirmados no backend local. Sessão do teste encerrada. Senha não registrada em arquivos.
- Funções e schema atualizados apenas no Convex local. Nenhuma publicação remota.
- Runtime local executado com Node 24 incluído no Codex, pois Node 25 do sistema não suporta as actions Node do backend local.

## Deploy de produção — 2026-09-08
- Convex publicado no deployment `exuberant-guanaco-180` (`https://exuberant-guanaco-180.convex.cloud`). Schema, índices e funções de autenticação/portal foram enviados.
- Verificação do deployment: `authActions:provisionUser` e `security:getSessionUser` presentes; `auth:fastLogin` ausente.
- Usuário `matteusmoreira@gmail.com` provisionado no banco Convex de produção com perfil `admin`. Login real confirmado; sessão de teste encerrada. Senha não foi registrada em arquivos ou logs.
- Vercel publicado em produção: [altar-fisio.vercel.app](https://altar-fisio.vercel.app). Deployment: `dpl_2EE4ZjpgCsR6D5jKkFvJscmMafLX`; estado `READY`; alias verificado.
- Smoke HTTP: `/`, `/login` e `/sw.js` retornaram 200. Logs Vercel não retornaram eventos para o deployment até a verificação.
- Variável de produção `VITE_CONVEX_URL` já apontava para o Convex acima; nenhum segredo foi impresso.
- Deploy feito a partir do working tree atual, que permanece sem commit/push. Nenhuma migração destrutiva ou alteração de dados além do usuário admin foi feita.
