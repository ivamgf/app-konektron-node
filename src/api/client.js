// Cliente HTTP da API KonekTron: JSON, token de acesso e renovação automática da sessão.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');
const REFRESH_KEY = 'kt.refreshToken';

export class ApiError extends Error {
  constructor(message, status, details, requestId) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details ?? null; // { campo: ['motivo'] } nos erros 422
    this.requestId = requestId ?? null;
  }
}

let accessToken = null;
const listeners = new Set();

export const session = {
  get accessToken() {
    return accessToken;
  },
  get refreshToken() {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set({ accessToken: access, refreshToken }) {
    accessToken = access ?? null;
    try {
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    } catch {
      // armazenamento indisponível: a sessão dura até fechar a aba
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // nada a limpar
    }
  },
  // Avisado quando a sessão expira e não pode ser renovada
  onExpired(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function buildUrl(path, query) {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path, { method = 'GET', body, query, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  if (res.status === 204) return { res, data: null };
  const data = await res.json().catch(() => null);
  return { res, data };
}

function toError(res, data) {
  return new ApiError(data?.error ?? res.statusText, res.status, data?.details, data?.requestId);
}

// Uma renovação por vez, inclusive entre abas: o refresh token é de uso único na API
// e reusá-lo encerra todas as sessões do usuário.
let refreshing = null;

async function doRefresh() {
  const run = async () => {
    const current = session.refreshToken;
    if (!current) throw new ApiError('session', 401);
    const { res, data } = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current } });
    if (!res.ok) throw toError(res, data);
    session.set(data);
    return data.accessToken;
  };
  return globalThis.navigator?.locks ? navigator.locks.request('kt-refresh', run) : run();
}

export function refreshSession() {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function request(path, { auth = true, ...options } = {}) {
  let { res, data } = await send(path, { ...options, token: auth ? accessToken : undefined });

  if (res.status === 401 && auth && session.refreshToken) {
    try {
      await refreshSession();
    } catch {
      session.clear();
      listeners.forEach((fn) => fn());
      throw toError(res, data);
    }
    ({ res, data } = await send(path, { ...options, token: accessToken }));
  }

  if (!res.ok) throw toError(res, data);
  return data;
}

export const api = {
  get: (path, query, opts) => request(path, { ...opts, query }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: body ?? {} }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body }),
};
