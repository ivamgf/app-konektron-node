#!/bin/sh
# Roda pelo /docker-entrypoint.sh do Nginx a cada vez que o container sobe.
# Grava em /config.js, lido pelo index.html antes do app:
#   VITE_API_URL          -> URL da API (vazia: a do build, ou /api/v1)
#   VITE_GOOGLE_CLIENT_ID -> ID do cliente OAuth do Google (vazio: sem login com Google)
# Trocar essas variáveis no painel exige só reiniciar o container, sem novo build.
set -eu

CONFIG=/usr/share/nginx/html/config.js
API_URL="${VITE_API_URL:-}"
GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}"

# escapa \ e " para gravar como string JavaScript
js_string() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

FIELDS=""

if [ -n "$API_URL" ]; then
  case "$API_URL" in
    http://* | https://* | /*) ;;
    *)
      echo "runtime-config: VITE_API_URL inválida ($API_URL); use https://... ou /api/v1" >&2
      exit 1
      ;;
  esac
  FIELDS="apiUrl: \"$(js_string "$API_URL")\""
  echo "runtime-config: API em $API_URL"
else
  echo "runtime-config: VITE_API_URL vazia, o app usa a URL do build (ou /api/v1)"
fi

if [ -n "$GOOGLE_CLIENT_ID" ]; then
  case "$GOOGLE_CLIENT_ID" in
    *.apps.googleusercontent.com) ;;
    *)
      echo "runtime-config: VITE_GOOGLE_CLIENT_ID inválido; use o ID do cliente OAuth (...apps.googleusercontent.com)" >&2
      exit 1
      ;;
  esac
  FIELDS="${FIELDS:+$FIELDS, }googleClientId: \"$(js_string "$GOOGLE_CLIENT_ID")\""
  echo "runtime-config: login com Google habilitado"
else
  echo "runtime-config: VITE_GOOGLE_CLIENT_ID vazio, login com Google oculto"
fi

printf 'window.__KONEKTRON_CONFIG__ = { %s };\n' "$FIELDS" > "$CONFIG"
