import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { formatMoney, maskCpfCnpj } from '../pages/billing/Billing.jsx';
import { blockedFor } from '../pages/projects/Share.jsx';
import { PLAN_SECTIONS, SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

const P = '7a2c3b1e-0000-4000-8000-000000000001';
const stamp = { createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z', lastUsedAt: '2026-11-10T10:00:00Z' };
const project = (over = {}) => ({
  id: P, ownerId: 'u1', name: 'Projeto X', type: 'software', version: '1.0.0', description: null, access: 'owner',
  ownerEmail: null, purgeAt: '2027-02-10T10:00:00Z', sections: PLAN_SECTIONS.free, ...stamp, ...over,
});
const CATALOG = {
  enabled: true, sandbox: true, currency: 'BRL', interval: 'MONTH',
  plans: [
    { plan: 'free', amount: 0, sections: PLAN_SECTIONS.free, ai: true, projectLimit: 3 },
    { plan: 'standard', amount: 4990, sections: PLAN_SECTIONS.standard, ai: true, projectLimit: null },
    { plan: 'master', amount: 7990, sections: SECTION_KEYS, ai: true, projectLimit: null },
  ],
};

let ROUTES;
let writes;
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

describe('utilitários da assinatura', () => {
  it('máscara de CPF e CNPJ e valores em reais', () => {
    expect(maskCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(maskCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatMoney(7990, 'pt-BR').replace(/\s/g, ' ')).toBe('R$ 79,90');
    expect(formatMoney(17900, 'pt-BR').replace(/\s/g, ' ')).toBe('R$ 179,00');
  });

  it('seções bloqueadas para o participante: as do plano do dono fora do plano dele', () => {
    expect(blockedFor('master', 'free').sort()).toEqual(['bpm', 'commonkads', 'crisp-dm', 'data-diagnosis', 'function-point', 'ontologies']);
    expect(blockedFor('free', 'master')).toEqual([]);
  });
});

describe('planos, cota do Free, assinatura e compartilhamento', () => {
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    writes = [];
    ROUTES = {
      '/auth/refresh': { accessToken: 'acc', refreshToken: 'ref2' },
      '/auth/me': { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'free', emailVerified: true },
      '/billing/plans': CATALOG,
      '/billing/subscription': { ...CATALOG, plan: 'free', exempt: false, cpfCnpj: null, current: null, openInvoiceUrl: null, withdrawal: false, payments: [] },
      '/projects': { data: [project()], page: 1, pageSize: 12, total: 1, quota: { plan: 'free', limit: 3, used: 3, canCreate: false } },
      [`/projects/${P}`]: project(),
      [`/projects/${P}/members`]: { owner: { userId: 'u1', email: 'ana@ex.com', plan: 'free', fullName: 'Ana' }, data: [] },
    };
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (init?.method && init.method !== 'GET' && path !== '/auth/refresh') {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
        writes.push({ method: init.method, path, body });
        if (path === '/billing/subscribe') {
          return json(201, { subscription: { id: 's1', plan: body.plan, status: 'pending' }, invoiceUrl: 'https://sandbox.asaas.com/i/abc123', startsAt: null });
        }
        if (path === `/projects/${P}/members`) {
          return json(201, { id: 'm1', userId: 'u2', email: body.email, plan: 'free', access: body.access, blockedSections: [] });
        }
        return json(200, body ?? {});
      }
      if (path in ROUTES) return json(200, ROUTES[path]);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('Free com 3 projetos criados: botão Novo projeto desabilitado e convite para assinar', async () => {
    renderAt('/projects');
    const button = await screen.findByRole('button', { name: /Novo projeto/ });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText(/O plano Free permite criar até 3 projetos/)).toBeInTheDocument();
    expect(screen.getByText('3 de 3 projetos do Free')).toBeInTheDocument();
    expect(screen.getByText(/Excluído em 10\/02\/2027 sem uso/)).toBeInTheDocument();
  });

  it('com vaga, o botão Novo projeto fica habilitado', async () => {
    ROUTES['/projects'] = { ...ROUTES['/projects'], quota: { plan: 'free', limit: 3, used: 1, canCreate: true } };
    renderAt('/projects');
    expect(await screen.findByText('1 de 3 projetos do Free')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo projeto/ })).toBeEnabled();
  });

  it('página de planos: três planos com preço e IA em todos', async () => {
    renderAt('/plans');
    expect(await screen.findByRole('heading', { name: 'Planos', level: 1 })).toBeInTheDocument();
    const standard = screen.getByRole('article', { name: 'Standard' });
    await waitFor(() => expect(within(standard).getByText(/49,90/)).toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'Master' })).getByText(/79,90/)).toBeInTheDocument();
    expect(screen.getAllByText('Integração com IA')).toHaveLength(3);
    expect(within(screen.getByRole('article', { name: 'Free' })).getByText('Seu plano atual')).toBeInTheDocument();
    expect(within(standard).getByRole('link', { name: 'Assinar' })).toHaveAttribute('href', '/checkout/standard');
  });

  it('assinar: CPF + aceite geram a fatura no Asaas', async () => {
    renderAt('/checkout/standard');
    const cpf = await screen.findByLabelText(/CPF ou CNPJ do pagador/);
    const submit = screen.getByRole('button', { name: /Gerar fatura/ });
    expect(submit).toBeDisabled();
    fireEvent.change(cpf, { target: { value: '52998224725' } });
    expect(cpf).toHaveValue('529.982.247-25');
    fireEvent.click(screen.getByLabelText(/autorizo a cobrança mensal de R\$\s49,90/));
    fireEvent.click(submit);
    const link = await screen.findByRole('link', { name: /Abrir a fatura/ });
    expect(link).toHaveAttribute('href', 'https://sandbox.asaas.com/i/abc123');
    expect(writes.find((w) => w.path === '/billing/subscribe').body).toEqual({ plan: 'standard', cpfCnpj: '529.982.247-25', acceptTerms: true });
  });

  it('dono compartilha o projeto pelo e-mail com acesso só ao Kanban', async () => {
    renderAt(`/projects/${P}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Compartilhar projeto' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('E-mail da conta'), { target: { value: 'bruno@ex.com' } });
    fireEvent.change(within(dialog).getByLabelText('Acesso'), { target: { value: 'kanban' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Convidar/ }));
    await waitFor(() =>
      expect(writes.find((w) => w.path === `/projects/${P}/members`)?.body).toEqual({ email: 'bruno@ex.com', access: 'kanban' }),
    );
  });

  it('participante não vê excluir nem configurações; aba fora do plano com cadeado', async () => {
    ROUTES[`/projects/${P}`] = project({ access: 'project', ownerEmail: 'dono@ex.com', ownerId: 'u9', purgeAt: null });
    renderAt(`/projects/${P}`);
    expect(await screen.findByText(/Compartilhado por dono@ex.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir projeto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurações do projeto' })).not.toBeInTheDocument();
    const fp = screen.getByRole('link', { name: /Pontos de Função/ });
    expect(within(fp).getByLabelText('Fora do seu plano')).toBeInTheDocument();
  });

  it('administrador concede o Master vitalício (sem cobrança) no painel', async () => {
    ROUTES['/auth/me'] = { id: 'u1', email: 'ana@ex.com', role: 'admin', plan: 'master', emailVerified: true };
    ROUTES['/admin/users'] = {
      data: [{ id: 'u2', email: 'bruno@ex.com', role: 'client', plan: 'free', lifetime: false, isActive: true, emailVerifiedAt: '2026-11-01T10:00:00Z', lastLoginAt: null, createdAt: '2026-11-01T10:00:00Z' }],
      page: 1, pageSize: 20, total: 1,
    };
    renderAt('/admin/users');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar bruno@ex.com' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Master vitalício (sem cobrança)'));
    expect(within(dialog).getByLabelText('Plano')).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(writes.find((w) => w.path === '/admin/users/u2')?.body).toEqual({ role: 'client', plan: 'master', isActive: true, lifetime: true }),
    );
  });
});
