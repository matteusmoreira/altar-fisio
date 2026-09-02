# 🚀 Guia de Publicação & Deploy na Vercel — Altar Fisio

Este guia fornece o passo a passo completo para realizar a publicação oficial da aplicação frontend **Altar Fisio** na plataforma **Vercel**, conectada ao backend **Convex**.

---

## 1. Pré-Requisitos
1. Conta ativa na [Vercel](https://vercel.com) (plano gratuito Hobby ou Pro).
2. Repositório Git com o código do projeto (GitHub, GitLab ou Bitbucket).
3. URL do Backend Convex de Produção (ex: `https://rapid-otter-123.convex.cloud`).

---

## 2. Passo a Passo do Deploy na Vercel (Via Dashboard)

### Passo 1: Conectar o Repositório
1. Acesse o [Dashboard da Vercel](https://vercel.com/dashboard) e clique em **"Add New..."** ➔ **"Project"**.
2. Selecione o repositório Git do **Altar Fisio**.

### Passo 2: Configurar o Projeto (Build & Output)
A Vercel detectará automaticamente as configurações definidas no arquivo `vercel.json`:
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build` (ou `tsc -b && vite build`)
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Passo 3: Adicionar a Variável de Ambiente
Na seção **"Environment Variables"**, adicione a variável:
| Nome da Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `VITE_CONVEX_URL` | `https://seu-app.convex.cloud` | Endpoint público do backend Convex |

### Passo 4: Clicar em "Deploy"
1. Clique no botão azul **"Deploy"**.
2. A Vercel executará o pipeline de build em aproximadamente 45 segundos.
3. Sua aplicação estará no ar com domínio seguro HTTPS gratuito (ex: `altar-fisio.vercel.app`).

---

## 3. Configuração de Domínio Personalizado (Opcional)
1. No painel do projeto na Vercel, acesse **Settings** ➔ **Domains**.
2. Insira o domínio desejado da clínica (ex: `app.altarfisio.com.br` ou `clinica.altarfisio.com.br`).
3. Adicione o registro CNAME ou A indicado pela Vercel na sua zona DNS (ex: Registro.br ou Cloudflare).
4. O certificado SSL Let's Encrypt é emitido e renovado automaticamente de forma gratuita.

---

## 4. O que o arquivo `vercel.json` já resolve automaticamente:
- **Roteamento SPA (Single Page Application)**: Regra de `rewrites` garantindo que recarregar a página em qualquer rota interna não resulte em erro 404.
- **Cache de Assets**: Headers HTTP de cache imutável de 1 ano para arquivos estáticos com hash em `dist/assets/*`.
- **Cabeçalhos de Segurança (Security Headers)**: `X-Frame-Options`, `X-Content-Type-Options` e `Permissions-Policy` protegendo contra ataques de clickjacking e spoofing.
- **Progressive Web App (PWA)**: Manifesto e Service Worker prontos para instalação em iPads e tablets.
