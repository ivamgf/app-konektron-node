# app-konektron-node

App web do KonekTron — Engenharia de Software e Análise de Dados.
React 19 · Vite 8 · Bootstrap 5.3 com os tokens do Design System KonekTron · React Router 7.

Consome a [API KonekTron](https://github.com/ivamgf/api-konektron-node) (`/api/v1`) e implementa
os requisitos da Especificação 3.3 (RF1–RF12). As mudanças em relação ao protótipo estão em
[docs/PROTOTIPO.md](docs/PROTOTIPO.md), com prints em [docs/prototipo/](docs/prototipo/).

## Rodando localmente

```bash
nvm use                 # Node 24 (.nvmrc)
cp .env.example .env    # padrão: /api/v1 encaminhado para http://localhost:3333
npm install
npm run dev             # http://localhost:5173
```

A API precisa estar rodando (`npm run dev` no repositório da API). Em desenvolvimento, o Vite
encaminha `/api` para `VITE_API_PROXY`, então não há CORS a configurar.

Outros scripts: `npm run build` (gera `dist/`), `npm run preview`, `npm test`, `npm run lint`.

## Estrutura

```
src/
├── main.jsx · router.jsx      rotas e migalhas de pão (handle.crumb)
├── api/                       client.js (fetch, tokens, renovação da sessão), endpoints.js
├── auth/                      AuthProvider (sessão), guards (RequireAuth, RequireAdmin, GuestOnly)
├── i18n/                      en.js (padrão), pt-BR.js — RNF5
├── components/                Layout (cabeçalho, menu, rodapé), ui, forms, ResourceManager, Toasts,
│                              sections (sub-navegação, arquivo, editor de linhas)
├── content/                   termos de uso, tarefas do CRISP-DM, planilhas do CommonKADS (PT/EN/ES)
├── lib/hooks.js               useAsync, useSubmit, formatação de datas
├── pages/
│   ├── public/                Início, Sobre, Contatos, Termos, 404
│   ├── auth/                  Entrar, Cadastrar, Recuperar, Nova senha, Confirmar e-mail
│   ├── app/                   Projetos, Engenharia, Perfil
│   ├── projects/              ProjectLayout, SystemAnalysis, CrispDm, Ontologies, Bpm, CommonKads,
│   │                          FunctionPoints, Scrum, Kanban, resources (configuração CRUD)
│   └── admin/                 Resumo, Usuários, Logs
└── styles/                    _tokens.scss (Design System), main.scss (Bootstrap + componentes)
```

**ResourceManager**: os 11 recursos com CRUD da API (requisitos, histórias, diagramas, objetivos,
datasets, campos, passos, modelos, métricas, endereços) usam um único componente guiado por
configuração (`pages/projects/resources.jsx`), com os mesmos enums e limites da API.

## Sessão

- `accessToken` (15 min) fica só em memória; o `refreshToken` (30 dias) fica no `localStorage`.
- Em 401, o cliente renova a sessão uma única vez e repete a requisição. A renovação é
  serializada entre abas (`navigator.locks`): a API trata o reuso de um refresh token como
  roubo e encerra todas as sessões.
- Sessão expirada leva ao login com `?next=` para voltar à página; sair pelo menu não guarda a página.

## Deploy

`npm run build` gera arquivos estáticos em `dist/`. Sirva-os com qualquer servidor web
(Nginx, ou um app estático no EasyPanel) com *fallback* para `index.html` (rotas do app).

- **Mesmo domínio da API** (recomendado): proxy de `/api` para a API e `VITE_API_URL=/api/v1`.
- **Domínios separados**: `VITE_API_URL=https://api.seudominio/api/v1` no build, e o domínio do
  app em `CORS_ORIGINS` e `APP_URL` no `.env` da API (`APP_URL` monta os links de e-mail).

**Docker (EasyPanel ou VPS):** o Dockerfile fica em `.github/workflows/Dockerfile`, com o contexto
do build na raiz. Ele gera o `dist/` com Node e o serve no Nginx (porta 80, *fallback* das rotas,
cache longo em `/assets/` e saúde em `/healthz`). A URL da API vem da variável `VITE_API_URL`
**quando o container sobe**: o `runtime-config.sh` grava o `/config.js`, lido pelo `index.html`
antes do app. Trocar a URL exige só reiniciar o container, sem novo build. No EasyPanel, defina
`VITE_API_URL` nas variáveis do serviço e a porta 80.

```bash
docker build -f .github/workflows/Dockerfile -t konektron-app .
docker run -d --name konektron-app -e VITE_API_URL=https://api.seudominio/api/v1 -p 8080:80 --restart unless-stopped konektron-app
```

**Login com Google:** defina `VITE_GOOGLE_CLIENT_ID` (o mesmo ID do cliente OAuth do
`GOOGLE_CLIENT_ID` da API), também lido quando o container sobe. Sem ele, o botão do Google não
aparece. No Google Cloud, o domínio do app (e `http://localhost:5173`, para desenvolvimento) vai em
"Origens JavaScript autorizadas" do cliente OAuth. O botão é o oficial do Google Identity Services;
conta nova pede o aceite dos Termos antes de ser criada, e conta só Google define a primeira senha
e confirma a exclusão com o e-mail no Perfil › Segurança.

## Testes

- `npm test`: Vitest — i18n (paridade de chaves pt-BR/en/es), conversão de formulários, o cliente
  HTTP (renovação única em chamadas simultâneas, sessão expirada, erros 422, upload e download) e
  as páginas de Ontologias, BPM e CommonKADS renderizadas pelo roteador com a API simulada.
- O fluxo completo (cadastro, projetos, CRISP-DM, perfil, admin, mobile) foi validado com
  Chrome headless contra a API e um banco de teste.
