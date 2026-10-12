import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

const ToastContext = createContext(null);
const DURATION = 6000;

// Avisos no topo da página, sobre o cabeçalho (protótipo: erro rosa, sucesso azul-claro)
export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind, message, extra) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, kind, message, extra }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      // Mensagem legível para qualquer erro vindo da API
      fromError: (err) => {
        if (err instanceof ApiError) {
          if (err.status === 0) return push('error', t('errors.network'));
          const extra = err.requestId ? t('errors.requestId', { id: err.requestId }) : null;
          return push('error', err.status >= 500 ? t('errors.generic') : err.message, extra);
        }
        push('error', t('errors.generic'));
      },
    }),
    [push, t],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="kt-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show mb-2 kt-toast-${toast.kind}`}
            role={toast.kind === 'error' ? 'alert' : 'status'}
          >
            <div className="d-flex align-items-center px-3 py-2 gap-3">
              <i
                className={`bi fs-4 ${toast.kind === 'error' ? 'bi-x-circle' : 'bi-check-lg'}`}
                aria-hidden="true"
              />
              <div className="flex-grow-1 text-center">
                {toast.message}
                {toast.extra && <div className="small opacity-75">{toast.extra}</div>}
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label={t('common.close')}
                onClick={() => dismiss(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
