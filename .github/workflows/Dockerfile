# Imagem de produção do app (build direto na VPS a partir da branch main).
# O contexto é a raiz do repositório; as exclusões ficam em Dockerfile.dockerignore, ao lado deste arquivo.
#   docker build -f .github/workflows/Dockerfile --build-arg VITE_API_URL=https://api.seudominio/api/v1 -t konektron-app .
#   docker run -d --name konektron-app -p 8080:80 --restart unless-stopped konektron-app

# 1) Build: o Vite embute a URL da API nos arquivos, por isso ela entra como build arg
FROM node:24.21.0-alpine AS build

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .

ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "Defina o build arg VITE_API_URL (ex.: https://api.seudominio/api/v1)"; exit 1; } \
  && VITE_API_URL="$VITE_API_URL" npm run build

# 2) Servidor: só os arquivos estáticos, no Nginx
FROM nginx:1.28-alpine

COPY .github/workflows/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
