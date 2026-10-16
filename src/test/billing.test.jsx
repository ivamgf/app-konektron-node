import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { formatMoney } from '../pages/billing/Billing.jsx';
import { routes } from '../router.jsx';

const stamp = { createdAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
const catalog = {
  enabled: true, currency: 'BRL', interval: 'MONTH',
  plans: [{ plan: 'standard', amount: 4990, sections: [] }, { plan: 'master', amount: 9990, sections: [] }],
};
const active = { id: 's1', plan: 'standard', amount: 4990, status: 'active', payUrl: null, nextInvoiceAt: '2026-11-15', ...stamp };
let user;
let routesMap;
const writes = [];

const json = (status, body) =>
  Promise.resolve({ ok: status < 400, status, statusText: String(status), json: () => Promise.resolve(body) });

function renderAt(path) {
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
}

describe('assinaturas', () => {
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    writes.length = 0;
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    user = { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'free', emailVerified: true };
    routesMap = {
      '/billing/plans': () => catalog,
      '/auth/refresh': () => ({ accessToken: 'acc', refreshToken: 'ref2' }),
      '/auth/me': () => user,
      '/billing/subscription': () => ({ ...catalog, plan: user.plan, role: user.role, current: null, history: [] }),
      '/billing/checkout': () => ({ id: 's2', payUrl: 'https://pagamento.pagbank.com.br/pagamento?code=x', expiresAt: stamp.createdAt }),
      '/billing/subscriptions/s1/refresh': () => {
        user = { ...user, plan: 'standard' };
        return { subscription: active, plan: 'standard' };
      },
      '/billing/subscription/cancel': () => {
        user = { ...user, plan: 'free' };
        return { subscription: { ...active, status: 'canceled' }, plan: 'free' };
      },
      '/profiles/me': () => ({ socialNetworks: [], locale: 'pt-BR' }),
    };
    vi.stubGlobal('fetch', (url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (init?.method && init.method !== 'GET' && path !== '/auth/refresh') {
        writes.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined });
      }
      return routesMap[path] ? json(200, routesMap[path]()) : json(404, { error: `sem mock: ${path}` });
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const signIn = () => localStorage.setItem('kt.refreshToken', 'ref');

  it('mensalidade formatada por idioma', () => {
    expect(formatMoney(4990, 'pt-BR')).toMatch(/R\$\s?49,90/);
    expect(formatMoney(9990, 'en')).toMatch(/R\$\s?99\.90/);
  });

  it('visitante vê o preço e o "Assinar" leva ao cadastro e depois ao checkout', async () => {
    renderAt('/plans');
    const links = await screen.findAllByRole('link', { name: 'Assinar' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/signup?next=${encodeURIComponent('/checkout/standard')}`,
      `/signup?next=${encodeURIComponent('/checkout/master')}`,
    ]);
    expect(screen.getAllByText(/49,90/).length).toBeGreaterThan(0);
  });

  it('checkout: cria a cobrança no PagBank para o plano escolhido', async () => {
    signIn();
    renderAt('/checkout/master');
    const go = await screen.findByRole('button', { name: /Ir para o pagamento/ });
    expect(screen.getAllByText(/99,90/).length).toBeGreaterThan(0);
    // sem o aceite dos termos e da cobrança recorrente o botão fica desligado
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/autorizo a cobrança mensal automática de .*99,90/));
    expect(go.disabled).toBe(false);
    expect(screen.getByText(/Direito de arrependimento/)).toBeTruthy();
    fireEvent.click(go);
    await waitFor(() => expect(writes).toEqual([{ method: 'POST', path: '/billing/checkout', body: { plan: 'master', acceptTerms: true } }]));
  });

  it('volta do PagBank: confirma o pagamento e libera o plano', async () => {
    signIn();
    renderAt('/billing/return?ref=s1');
    expect(await screen.findByText(/Pagamento confirmado! O plano Standard já está liberado/)).toBeTruthy();
    expect(writes.filter((w) => w.path === '/billing/subscriptions/s1/refresh')).toHaveLength(1);
  });

  it('perfil: no prazo de 7 dias o cancelamento avisa do estorno integral', async () => {
    user.plan = 'standard';
    const recent = { ...active, activatedAt: new Date().toISOString() };
    routesMap['/billing/subscription'] = () => ({ ...catalog, plan: user.plan, current: recent, history: [recent] });
    signIn();
    renderAt('/profile?tab=subscription');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    expect(await screen.findByText(/prazo de arrependimento/)).toBeTruthy();
  });

  it('perfil: cancela a assinatura ativa', async () => {
    user.plan = 'standard';
    routesMap['/billing/subscription'] = () => ({ ...catalog, plan: user.plan, current: user.plan === 'free' ? null : active, history: [active] });
    signIn();
    renderAt('/profile?tab=subscription');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    const buttons = await screen.findAllByRole('button', { name: 'Cancelar assinatura' });
    fireEvent.click(buttons.at(-1)); // o do modal
    await waitFor(() => expect(writes.some((w) => w.path === '/billing/subscription/cancel')).toBe(true));
    expect(await screen.findByText(/Assinatura cancelada/)).toBeTruthy();
  });
});
