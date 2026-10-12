import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client.js';
import { useToast } from '../components/Toasts.jsx';

// Carrega dados e recarrega quando `deps` (valores serializáveis) mudam ou ao chamar reload().
// Enquanto recarrega, mantém os dados anteriores (sem piscar a tela).
export function useAsync(loader, deps = []) {
  const toast = useToast();
  const loaderRef = useRef(loader);
  const toastRef = useRef(toast);
  useLayoutEffect(() => {
    loaderRef.current = loader;
    toastRef.current = toast;
  });

  const [version, setVersion] = useState(0);
  const key = `${JSON.stringify(deps)}#${version}`;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => loaderRef.current())
      .then(
        (data) => !cancelled && setState({ key, data, error: null }),
        (error) => {
          if (cancelled) return;
          setState({ key, data: null, error });
          if (!(error instanceof ApiError && error.status === 404)) toastRef.current.fromError(error);
        },
      );
    return () => {
      cancelled = true; // resposta de uma chave antiga não sobrescreve a atual
    };
  }, [key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  return { data: state.data, error: state.error, loading: state.key !== key, reload, setData };
}

// Envio de formulário: erros por campo (422) ficam em `errors`, os demais viram toast
export function useSubmit(action, { onSuccess } = {}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async (...args) => {
    setBusy(true);
    setErrors({});
    try {
      const result = await action(...args);
      await onSuccess?.(result);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.details) {
        setErrors(Object.fromEntries(Object.entries(error.details).map(([k, v]) => [k, [].concat(v)[0]])));
      }
      toast.fromError(error);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  return { submit, busy, errors, setErrors };
}

// Valores vazios viram null (a API usa null para apagar campos opcionais)
export const emptyToNull = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]));

export const formatDate = (value, locale) => {
  if (!value) return '—';
  // datas sem hora chegam como AAAA-MM-DD: não converter para fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return locale === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
  }
  return new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};
