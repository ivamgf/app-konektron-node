import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { FAQ } from '../content/faq.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { FREE_INACTIVE_MONTHS, FREE_PROJECT_LIMIT, TUTORIAL_URL } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

const json = (status, body) =>
  Promise.resolve({ ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: () => Promise.resolve(body) });

function open(path, locale = 'pt-BR') {
  localStorage.setItem('kt.locale', locale);
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

describe('conteúdo do FAQ', () => {
  it('os três idiomas têm os mesmos grupos e o mesmo número de perguntas', () => {
    const shape = (loc) => FAQ[loc].map((g) => g.items.length);
    expect(shape('en')).toEqual(shape('pt-BR'));
    expect(shape('es')).toEqual(shape('pt-BR'));
    for (const loc of Object.keys(FAQ)) {
      for (const g of FAQ[loc]) {
        for (const [q, a] of g.items) {
          expect(q.trim().length, `${loc}: ${q}`).toBeGreaterThan(5);
          expect(a.trim().length, `${loc}: ${q}`).toBeGreaterThan(30);
        }
      }
    }
  });

  it('o tutorial em PDF existe em public/docs', () => {
    const file = join(process.cwd(), 'public', TUTORIAL_URL);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('páginas de ajuda', () => {
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    localStorage.clear();
    session.clear();
    // visitante: sem sessão; planos vêm do valor padrão
    vi.stubGlobal('fetch', vi.fn(() => json(404, { error: 'não encontrado' })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('a página inicial oferece o tutorial em PDF e o link para o FAQ', async () => {
    open('/');
    const section = (await screen.findByRole('heading', { name: /Aprenda a usar o KoneKtron/ })).closest('section');
    const pdf = within(section).getByRole('link', { name: /Baixar tutorial \(PDF\)/ });
    expect(pdf.getAttribute('href')).toBe(TUTORIAL_URL);
    expect(pdf.hasAttribute('download')).toBe(true);
    expect(within(section).getByRole('link', { name: /Perguntas frequentes/ }).getAttribute('href')).toBe('/faq');
  });

  it('o FAQ abre a primeira resposta, expande outras e preenche as regras do Free', async () => {
    open('/faq');
    expect(await screen.findByRole('heading', { level: 1, name: 'Perguntas frequentes' })).toBeTruthy();
    const first = screen.getByRole('button', { name: 'O que é o KoneKtron?' });
    expect(first.getAttribute('aria-expanded')).toBe('true');

    const free = screen.getByRole('button', { name: 'O que o plano Free inclui?' });
    expect(free.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(free);
    expect(free.getAttribute('aria-expanded')).toBe('true');
    const answer = document.getElementById(free.getAttribute('aria-controls'));
    expect(answer.textContent).toContain(`até ${FREE_PROJECT_LIMIT} projetos`);
    expect(answer.textContent).toContain(`${FREE_INACTIVE_MONTHS} meses`);
    expect(answer.textContent).not.toMatch(/\{limit\}|\{months\}/);

    // tutorial e contato no fim da página
    expect(screen.getAllByRole('link', { name: /Baixar tutorial \(PDF\)/ })[0].getAttribute('href')).toBe(TUTORIAL_URL);
  });

  it('a busca ignora acentos e mostra aviso quando nada é encontrado', async () => {
    open('/faq');
    const search = await screen.findByLabelText('Buscar nas perguntas');
    fireEvent.change(search, { target: { value: 'RELATORIO' } });
    const hit = screen.getByRole('button', { name: 'Como gero o relatório do projeto?' });
    expect(hit.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Esqueci minha senha.' })).toBeNull();

    fireEvent.change(search, { target: { value: 'xyzabc' } });
    expect(screen.getByRole('status').textContent).toMatch(/Nenhuma pergunta encontrada/);
  });

  it('o FAQ segue o idioma escolhido', async () => {
    open('/faq', 'en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What is KoneKtron?' })).toBeTruthy();
  });

  it('o menu lateral tem o item Perguntas frequentes', async () => {
    open('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir menu' }));
    const nav = await screen.findByRole('navigation', { name: 'Menu' });
    expect(within(nav).getByRole('link', { name: /Perguntas frequentes/ }).getAttribute('href')).toBe('/faq');
  });
});
