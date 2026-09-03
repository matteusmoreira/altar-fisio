# Documentação de Integração UAZAPI — Altar Fisio

## 1. Credenciais e Endpoints Oficiais

- **Servidor Uazapi**: `https://whatpress.uazapi.com`
- **Admin Token**: `jJRMdT508DTwShzdWcuxSHvIEiSDdyuIQXwj3j6XRqr5uktfV7`
- **Versão do Protocolo**: uazapiGO (v2.0 / OpenAPI 3.1.0)

## 2. Autenticação

- **Endpoints Administrativos** (criar instâncias, listar todas as instâncias do servidor):
  - Header: `admintoken: <Admin Token>`
- **Endpoints de Instância** (conectar, status, deletar, enviar mensagens):
  - Header: `token: <Instance Token>`

## 3. Endpoints Principais

### Gestão de Instâncias
- `POST /instance/create`: Cria instância com `{ "name": "NomeInstancia" }` (Header `admintoken`). Retorna `{ id, token, name, ... }`.
- `POST /instance/connect`: Conecta ao WhatsApp gerando QR Code (Header `token`). Retorna `{ qrcode: "data:image/png;base64,...", status: "connecting" }`.
- `GET /instance/status`: Verifica status de conexão e perfil (Header `token`). Retorna `{ instance: { status, profileName, ... }, status: { connected, loggedIn } }`.
- `POST /instance/disconnect`: Desconecta a sessão do WhatsApp (Header `token`).
- `DELETE /instance`: Exclui a instância do servidor (Header `token`).

### Envio de Mensagens Interativas
- `POST /send/text`: Envio simples de texto (`{ "number": "5511...", "text": "..." }`).
- `POST /send/menu`: Suporte a botões rápidos, listas e enquetes:
  - Header: `token: <Instance Token>`
- `POST /send/carousel`: Suporte a carrossel de cartões horizontais com imagens e botões de ação:
  - Header: `token: <Instance Token>`

## 4. Campanhas e Recorrência

- Campanhas em massa armazenadas na tabela `broadcastCampaigns`.
- Frequências suportadas:
  - `none`: Envio único imediato.
  - `daily`: Diário no horário configurado.
  - `weekly`: Semanal nos dias selecionados.
  - `biweekly`: A cada 15 dias.
  - `monthly`: Mensal no mesmo dia do mês.
- Intervalo seguro (anti-bloqueio WhatsApp): 3 a 6 segundos por envio.
