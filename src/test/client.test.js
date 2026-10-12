import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, session } from '../api/client.js';

const json = (status, body) =>
  Promise.resolve({ ok: status < 400, status, statusText: String(status), json: () => Promise.resolve(body) });

describe('cliente da API', () => {
  beforeEach(() => {
    localStorage.clear();
    session.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renova a sessão uma única vez em 401 e repete a requisição', async () => {
    session.set({ accessToken: 'velho', refreshToken: 'r1' });
    const calls = [];
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      calls.push([url, init.headers.Authorization]);
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'novo', refreshToken: 'r2' });
      return init.headers.Authorization === 'Bearer novo' ? json(200, { ok: true }) : json(401, { error: 'Token inválido' });
    }));

    // duas chamadas simultâneas não podem gastar o refresh token duas vezes
    const [a, b] = await Promise.all([api.get('/auth/me'), api.get('/projects')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(calls.filter(([u]) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(session.refreshToken).toBe('r2');
  });

  it('encerra a sessão e avisa quando o refresh falha', async () => {
    session.set({ accessToken: 'velho', refreshToken: 'r1' });
    const expired = vi.fn();
    const off = session.onExpired(expired);
    vi.stubGlobal('fetch', vi.fn(() => json(401, { error: 'Sessão expirada' })));

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    expect(session.refreshToken).toBeNull();
    off();
  });

  it('expõe os erros por campo do 422', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(422, { error: 'Dados inválidos', details: { email: ['E-mail inválido'] } })));
    const err = await api.post('/auth/login', {}, { auth: false }).catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ email: ['E-mail inválido'] });
  });

  it('monta a query sem parâmetros vazios', async () => {
    const fetchMock = vi.fn(() => json(200, []));
    vi.stubGlobal('fetch', fetchMock);
    await api.get('/projects', { page: 2, type: '', search: undefined });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/projects?page=2');
  });
});
