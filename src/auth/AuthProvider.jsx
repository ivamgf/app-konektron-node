import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshSession, session } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

const AuthContext = createContext(null);

// status: 'loading' (restaurando a sessão) | 'anonymous' | 'authenticated'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  // saída pedida pelo usuário: não guardar a página atual para depois do login
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  const applySession = useCallback((result) => {
    session.set(result);
    setSignedOutByUser(false);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const signOutLocally = useCallback(() => {
    session.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Restaura a sessão com o refresh token guardado
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session.refreshToken) return setStatus('anonymous');
      try {
        await refreshSession();
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) signOutLocally();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOutLocally]);

  useEffect(() => session.onExpired(signOutLocally), [signOutLocally]);

  const value = useMemo(
    () => ({
      user,
      status,
      signedOutByUser,
      // administração: só administrador com plano Master (a API confere de novo)
      isAdmin: user?.role === 'admin' && user?.plan === 'master',
      login: async (credentials) => applySession(await authApi.login(credentials)),
      register: async (data) => applySession(await authApi.register(data)),
      // Devolve { user, created }: created = conta criada agora pelo Google
      loginWithGoogle: async (body) => {
        const result = await authApi.google(body);
        return { user: applySession(result), created: Boolean(result.created) };
      },
      // Após trocar a senha a API devolve tokens novos (as outras sessões caem)
      replaceTokens: (tokens) => session.set(tokens),
      reloadUser: async () => {
        const me = await authApi.me();
        setUser(me);
        return me;
      },
      logout: async ({ allDevices = false } = {}) => {
        try {
          await authApi.logout(allDevices ? { allDevices: true } : { refreshToken: session.refreshToken });
        } catch {
          // mesmo se a API falhar, a sessão local é encerrada
        }
        setSignedOutByUser(true);
        signOutLocally();
      },
      signOutLocally,
    }),
    [user, status, signedOutByUser, applySession, signOutLocally],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
