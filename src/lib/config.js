// Configuração de execução: o /config.js é gerado quando o container sobe
// (.github/workflows/runtime-config.sh). Sem ele, vale o build (VITE_*) ou o padrão de desenvolvimento.
const runtime = globalThis.__KONEKTRON_CONFIG__ ?? {};

export const API_BASE_URL = (runtime.apiUrl || import.meta.env.VITE_API_URL || '/api/v1').replace(
  /\/$/,
  '',
);

// ID do cliente OAuth do Google (público); vazio esconde o login com Google
export const GOOGLE_CLIENT_ID =
  runtime.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
