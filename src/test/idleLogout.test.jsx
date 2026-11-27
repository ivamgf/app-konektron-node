import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ACTIVITY_KEY, IDLE_LIMIT_MS, IDLE_WARNING_MS, idleExpired, idleFor, markActivity } from '../auth/idle.js';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { routes } from '../router.jsx';

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const MIN = 60 * 1000;

describe('registro de atividade', () => {
  beforeEach(() => localStorage.clear());

  it('aviso aos 6 minutos, fim aos 7', () => {
    expect(IDLE_WARNING_MS).toBe(6 * MIN);
    expect(IDLE_LIMIT_MS).toBe(7 * MIN);
  });

  it('conta o tempo desde a última interação, inclusive de outra aba', () => {
    markActivity(1_000);
    expect(idleFor(1_000 + 5 * MIN)).toBe(5 * MIN);
    expect(idleExpired(1_000 + 7 * MIN - 1)).toBe(false);
    expect(idleExpired(1_000 + 7 * MIN)).toBe(true);
    localStorage.setItem(ACTIVITY_KEY, String(1_000 + 6 * MIN)); // outra aba mexeu depois
    expect(idleExpired(1_000 + 7 * MIN)).toBe(false);
  });
});

describe('sessão encerrada por inatividade', () => {
  let calls;
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    calls = [];
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      calls.push(path);
      if (path === '/auth/refresh') return json(200, { accessToken: 'acc', refreshToken: 'ref2' });
      if (path === '/auth/logout') return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) });
      if (path === '/auth/me') return json(200, { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'free', emailVerified: true });
      if (path === '/projects') return json(200, { items: [], total: 0 });
      return json(200, []);
    }));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderAt = (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>,
    );
    return router;
  };
  const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
  const warning = () => screen.queryByRole('dialog', { name: 'Sua sessão vai expirar' });

  it('avisa aos 6 minutos, encerra aos 7 e volta ao login com a página atual', async () => {
    const router = renderAt('/profile');
    await screen.findByText('ana@ex.com', { selector: '.kt-header-user span' });
    await advance(6 * MIN - 2000);
    expect(warning()).toBeNull();
    await advance(3000);
    expect(warning()).toBeTruthy();
    expect(warning().textContent).toMatch(/desconectado em 0:5\d/);
    await advance(MIN);
    expect(warning()).toBeNull();
    expect(calls).toContain('/auth/logout');
    expect(session.refreshToken).toBeNull();
    expect(router.state.location.pathname).toBe('/signin');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/profile')}`);
    expect(await screen.findByText(/encerrada após 7 minutos sem uso/)).toBeTruthy();
  });

  it('interação antes dos 7 minutos fecha o aviso e zera o contador', async () => {
    renderAt('/profile');
    await screen.findByText('ana@ex.com', { selector: '.kt-header-user span' });
    await advance(6 * MIN + 1000);
    expect(warning()).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    expect(warning()).toBeNull();
    // o prazo recomeça: 6 minutos depois da tecla, nada foi encerrado
    await advance(6 * MIN - 2000);
    expect(warning()).toBeNull();
    expect(calls).not.toContain('/auth/logout');
    // e o botão do aviso também mantém a sessão
    await advance(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar conectado' }));
    expect(warning()).toBeNull();
    await advance(5 * MIN);
    expect(calls).not.toContain('/auth/logout');
  });

  it('não restaura a sessão de quem voltou depois do prazo', async () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 8 * MIN));
    const router = renderAt('/profile');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
    expect(calls).toContain('/auth/logout');
    expect(calls).not.toContain('/auth/refresh');
    expect(session.refreshToken).toBeNull();
  });
});
