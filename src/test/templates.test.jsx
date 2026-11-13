import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

const json = (status, body) =>
  Promise.resolve({ ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: () => Promise.resolve(body) });

const P = 'p1';
const SA = `/projects/${P}/system-analysis`;
const TEMPLATE = {
  key: 'ers-auth-profile',
  name: 'ERS – Cadastro, Autenticação e Perfil de Usuário',
  description: 'Especificação de Requisitos de Software do módulo base.',
  counts: { requirements: 50, userStories: 10, diagrams: 14 },
};

describe('modelo de projeto na Análise de Sistemas', () => {
  let analysis;
  let writes;
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    writes = [];
    analysis = { goal: null, scope: null, technicalDescription: null, notes: null, updatedAt: null };
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      const method = init?.method ?? 'GET';
      if (path === '/auth/refresh') return json(200, { accessToken: 'acc', refreshToken: 'ref2' });
      if (path === '/auth/me') return json(200, { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'free', emailVerified: true });
      if (path === `/projects/${P}`) {
        return json(200, { id: P, name: 'Loja', type: 'software', version: '1.0', access: 'owner', sections: SECTION_KEYS, createdAt: 'x', updatedAt: 'x' });
      }
      if (path === `${SA}/templates`) return json(200, [TEMPLATE]);
      if (path === `${SA}/templates/${TEMPLATE.key}/apply` && method === 'POST') {
        writes.push(path);
        // a API preenche os campos vazios da análise
        analysis = { ...analysis, goal: 'Objetivo do documento\nEste documento descreve... Loja', updatedAt: '2026-11-12T10:00:00Z' };
        return json(200, {
          template: TEMPLATE, analysis: { filled: ['goal', 'scope', 'technicalDescription', 'notes'] },
          requirements: { created: 50, skipped: 0 }, userStories: { created: 10, skipped: 0 }, diagrams: { created: 14, skipped: 0 },
        });
      }
      if (path === `${SA}/analysis`) return json(200, analysis);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('o botão na análise aplica o modelo e recarrega o formulário com os textos', async () => {
    const router = createMemoryRouter(routes, { initialEntries: [`/projects/${P}/analysis`] });
    render(
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Usar modelo/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Iniciar a partir de um modelo' });
    const radio = await within(dialog).findByRole('radio', { name: /ERS – Cadastro, Autenticação e Perfil/ });
    expect(radio.checked).toBe(true);
    expect(within(dialog).getByText('50 requisitos · 10 casos de uso · 14 diagramas')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: /Aplicar modelo/ }));
    await waitFor(() => expect(writes).toEqual([`${SA}/templates/${TEMPLATE.key}/apply`]));
    expect(await screen.findByText('Modelo aplicado: 50 requisitos, 10 casos de uso e 14 diagramas criados.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByLabelText('Objetivo').value).toContain('Este documento descreve... Loja'));
  });
});
