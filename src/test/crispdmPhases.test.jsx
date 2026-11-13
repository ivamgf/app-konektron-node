import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const P = 'p1';
const NAMES = [
  ['business_understanding', 'Entendimento do negócio', ['background']],
  ['data_understanding', 'Entendimento dos dados', ['dataQualityReport']],
  ['data_preparation', 'Preparação dos dados', ['dataCleaningReport']],
  ['modeling', 'Modelagem', ['derivedAttributes']],
  ['evaluation', 'Avaliação', ['decision']],
  ['deployment', 'Implantação', ['mergedData']],
];
const PHASES = NAMES.map(([phase, name, tasks], i) => ({
  id: `ph${i}`, projectId: P, phase, order: i + 1, label: { 'pt-BR': name, en: name }, tasks,
  status: i === 0 ? 'in_progress' : 'not_started', content: {}, notes: null, startedAt: null, completedAt: null,
  updatedAt: '2026-11-12T10:00:00Z',
}));

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
}

const header = (name) => screen.getByRole('button', { name: new RegExp(name) });
const expanded = () =>
  screen.getAllByRole('button').filter((b) => b.classList.contains('accordion-button') && b.getAttribute('aria-expanded') === 'true')
    .map((b) => b.textContent);

describe('CRISP-DM: etapas em acordeão', () => {
  beforeAll(() => {
    window.scrollTo = () => {};
    Element.prototype.scrollIntoView = vi.fn();
  });
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (path === '/auth/refresh') return json(200, { accessToken: 'acc', refreshToken: 'ref2' });
      if (path === '/auth/me') return json(200, { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'master', emailVerified: true });
      if (path === `/projects/${P}`) {
        return json(200, { id: P, name: 'Churn', type: 'data_analysis', version: '1.0', access: 'owner', sections: SECTION_KEYS, createdAt: 'x', updatedAt: 'x' });
      }
      if (path === `/projects/${P}/crisp-dm/phases`) return json(200, PHASES);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('abre com Entendimento do negócio; clicar noutra etapa fecha a aberta e abre a clicada', async () => {
    renderAt(`/projects/${P}/phases`);
    await screen.findByRole('button', { name: /1\. Entendimento do negócio/ });
    expect(expanded()).toHaveLength(1);
    expect(expanded()[0]).toMatch(/^1\. Entendimento do negócio/);
    expect(document.getElementById('business_understanding-body').classList.contains('show')).toBe(true);
    expect(document.getElementById('data_understanding-body').classList.contains('show')).toBe(false);

    fireEvent.click(header('2\\. Entendimento dos dados'));
    expect(expanded()).toHaveLength(1);
    expect(expanded()[0]).toMatch(/^2\. Entendimento dos dados/);
    expect(document.getElementById('business_understanding-body').classList.contains('show')).toBe(false);
    expect(document.getElementById('data_understanding-body').classList.contains('show')).toBe(true);

    fireEvent.click(header('5\\. Avaliação'));
    expect(expanded()[0]).toMatch(/^5\. Avaliação/);
    expect(expanded()).toHaveLength(1);

    // clicar na aberta fecha
    fireEvent.click(header('5\\. Avaliação'));
    expect(expanded()).toHaveLength(0);
  });

  it('o que foi digitado numa etapa fechada não se perde', async () => {
    renderAt(`/projects/${P}/phases`);
    const field = await screen.findByLabelText('Contexto', { selector: 'textarea' });
    fireEvent.change(field, { target: { value: 'Clientes cancelam após 6 meses' } });
    fireEvent.click(header('2\\. Entendimento dos dados'));
    fireEvent.click(header('1\\. Entendimento do negócio'));
    await waitFor(() => expect(field.value).toBe('Clientes cancelam após 6 meses'));
    expect(document.body.contains(field)).toBe(true);
  });

  it('link da visão geral (#etapa) abre a etapa indicada', async () => {
    renderAt(`/projects/${P}/phases#modeling`);
    await screen.findByRole('button', { name: /4\. Modelagem/ });
    expect(expanded()).toHaveLength(1);
    expect(expanded()[0]).toMatch(/^4\. Modelagem/);
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });
});
