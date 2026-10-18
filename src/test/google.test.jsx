import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// O ID do cliente vem do /config.js; precisa existir antes de o app ser importado
vi.hoisted(() => {
  globalThis.__KONEKTRON_CONFIG__ = { googleClientId: '1234-teste.apps.googleusercontent.com' };
});

const { session } = await import('../api/client.js');
const { AuthProvider } = await import('../auth/AuthProvider.jsx');
const { ToastProvider } = await import('../components/Toasts.jsx');
const { I18nProvider } = await import('../i18n/I18nProvider.jsx');
const { routes } = await import('../router.jsx');

const json = (status, body) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  });

// ID token de mentira: só o payload importa para o app (a API é que confere a assinatura)
const b64url = (obj) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const CREDENTIAL = `${b64url({ alg: 'RS256' })}.${b64url({ email: 'nova@exemplo.com' })}.assinatura`;
const USER = {
  id: 'u1',
  email: 'nova@exemplo.com',
  role: 'client',
  plan: 'free',
  emailVerified: true,
  hasPassword: false,
  googleLinked: true,
};

let gsi;
let googleCalls;

function renderAt(path) {
  render(
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('login com Google', () => {
  beforeEach(() => {
    session.clear();
    googleCalls = [];
    // Google Identity Services simulado: guarda o callback e desenha um botão que o dispara
    gsi = { initialize: vi.fn(), renderButton: vi.fn() };
    gsi.renderButton.mockImplementation((node, options) => {
      node.innerHTML = `<button type="button">Google ${options.text}</button>`;
      node.firstChild.onclick = () =>
        gsi.initialize.mock.lastCall[0].callback({ credential: CREDENTIAL });
    });
    vi.stubGlobal('google', { accounts: { id: gsi } });
    vi.stubGlobal(
      'fetch',
      vi.fn((url, init) => {
        const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
        if (path === '/auth/google') {
          const body = JSON.parse(init.body);
          googleCalls.push(body);
          if (!body.acceptTerms) {
            return json(422, {
              error: 'Aceite os Termos de Uso',
              details: { acceptTerms: ['Você deve aceitar os Termos de Uso'] },
            });
          }
          return json(201, {
            user: USER,
            accessToken: 'a',
            refreshToken: 'refresh-1234567890',
            created: true,
          });
        }
        return json(
          200,
          path === '/auth/me' ? USER : { data: [], total: 0, page: 1, pageSize: 20 },
        );
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('entrar: conta nova pede o aceite dos termos e então é criada', async () => {
    renderAt('/signin');
    const button = await screen.findByRole('button', { name: 'Google signin_with' });
    expect(gsi.initialize.mock.lastCall[0].client_id).toBe('1234-teste.apps.googleusercontent.com');

    fireEvent.click(button);
    expect(
      await screen.findByText(/Ainda não existe conta para nova@exemplo.com/),
    ).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Criar conta' });
    expect(create).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Aceito os/));
    fireEvent.click(create);
    await waitFor(() => expect(session.refreshToken).toBe('refresh-1234567890'));
    expect(googleCalls).toEqual([
      { credential: CREDENTIAL },
      { credential: CREDENTIAL, acceptTerms: true },
    ]);
    expect(await screen.findByText('Conta criada com o Google!')).toBeInTheDocument();
  });

  it('cadastro: com a caixa de termos marcada, cria a conta sem perguntar de novo', async () => {
    renderAt('/signup');
    const button = await screen.findByRole('button', { name: 'Google continue_with' });
    fireEvent.click(screen.getByLabelText(/Aceito os/));
    fireEvent.click(button);
    await waitFor(() => expect(session.refreshToken).toBe('refresh-1234567890'));
    expect(googleCalls).toEqual([{ credential: CREDENTIAL, acceptTerms: true }]);
  });
});

describe('perfil de conta só Google (sem senha)', () => {
  let writes;
  beforeEach(() => {
    writes = [];
    session.set({ refreshToken: 'refresh-guardado-123' }); // a sessão é restaurada no carregamento
    vi.stubGlobal(
      'fetch',
      vi.fn((url, init) => {
        const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
        const method = init?.method ?? 'GET';
        if (path === '/auth/refresh')
          return json(200, { accessToken: 'a', refreshToken: 'refresh-novo-1234' });
        if (method !== 'GET') {
          writes.push({ method, path, body: JSON.parse(init.body) });
          return method === 'DELETE'
            ? Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) })
            : json(200, { accessToken: 'b', refreshToken: 'refresh-outro-1234' });
        }
        return json(
          200,
          path === '/auth/me' ? USER : { data: [], total: 0, page: 1, pageSize: 20 },
        );
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('define a primeira senha sem a atual e confirma a exclusão com o e-mail', async () => {
    renderAt('/profile?tab=security');
    expect(await screen.findByRole('heading', { name: 'Definir senha' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();
    expect(screen.getByText('Vinculada')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } });
    fireEvent.change(screen.getByLabelText('Confirme a senha'), {
      target: { value: 'novaSenha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      path: '/auth/change-password',
      body: { password: 'novaSenha123', confirmPassword: 'novaSenha123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ }));
    expect(screen.getByText(/Digite o e-mail da conta para confirmar/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' nova@exemplo.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(writes.some((w) => w.method === 'DELETE')).toBe(true));
    expect(writes.find((w) => w.method === 'DELETE')).toEqual({
      method: 'DELETE',
      path: '/auth/me',
      body: { confirmEmail: 'nova@exemplo.com' },
    });
  });
});
