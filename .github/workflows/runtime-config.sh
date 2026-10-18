#!/bin/sh
# Roda pelo /docker-entrypoint.sh do Nginx a cada vez que o container sobe.
# Grava a URL da API em /config.js, lido pelo index.html antes do app: trocar a
# VITE_API_URL no painel exige só reiniciar o container, sem novo build.
set -eu

CONFIG=/usr/share/nginx/html/config.js
API_URL="${VITE_API_URL:-}"

if [ -z "$API_URL" ]; then
  echo "runtime-config: VITE_API_URL vazia, o app usa a URL do build (ou /api/v1)"
  printf 'window.__KONEKTRON_CONFIG__ = {};\n' > "$CONFIG"
  exit 0
fi

case "$API_URL" in
  http://* | https://* | /*) ;;
  *)
    echo "runtime-config: VITE_API_URL inválida ($API_URL); use https://... ou /api/v1" >&2
    exit 1
    ;;
esac

# escapa \ e " para gravar como string JavaScript
ESCAPED=$(printf '%s' "$API_URL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
printf 'window.__KONEKTRON_CONFIG__ = { apiUrl: "%s" };\n' "$ESCAPED" > "$CONFIG"
echo "runtime-config: API em $API_URL"
