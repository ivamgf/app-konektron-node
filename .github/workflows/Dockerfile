# Imagem de produção do app (build direto na VPS a partir da branch main).
# O contexto é a raiz do repositório; as exclusões ficam em Dockerfile.dockerignore, ao lado deste arquivo.
#   docker build -f .github/workflows/Dockerfile -t konektron-app .
#   docker run -d --name konektron-app -e VITE_API_URL=https://api.seudominio/api/v1 -p 8080:80 --restart unless-stopped konektron-app
#
# A URL da API (VITE_API_URL) e o ID do cliente do Google (VITE_GOOGLE_CLIENT_ID) são lidos quando o
# container sobe (runtime-config.sh), não no build: trocá-los exige só reiniciar o container.

# 1) Build do Vite
FROM node:24.21.0-alpine AS build

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# 2) Servidor: só os arquivos estáticos, no Nginx
FROM nginx:1.28-alpine

COPY .github/workflows/nginx.conf /etc/nginx/conf.d/default.conf
COPY .github/workflows/runtime-config.sh /docker-entrypoint.d/40-konektron-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-konektron-config.sh \
  && chmod +x /docker-entrypoint.d/40-konektron-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
