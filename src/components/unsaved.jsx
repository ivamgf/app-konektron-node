// Alterações não salvas: cada formulário informa se está "sujo"; o provedor (no Layout) pergunta
// antes de sair da página — por link, botão Voltar ou fechando a aba. Um único bloqueio para a
// página inteira, pois o React Router aceita só um useBlocker ativo por vez.
import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { useBlocker } from 'react-router';
import { useI18n } from '../i18n/I18nProvider.jsx';

const UnsavedContext = createContext(null);

export function UnsavedProvider({ children }) {
  const { t } = useI18n();
  const [dirtyForms, setDirtyForms] = useState({});
  const register = useCallback(
    (id, dirty) => setDirtyForms((prev) => (Boolean(prev[id]) === dirty ? prev : { ...prev, [id]: dirty })),
    [],
  );
  const hasUnsaved = Object.values(dirtyForms).some(Boolean);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => hasUnsaved && currentLocation.pathname !== nextLocation.pathname,
      [hasUnsaved],
    ),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('common.unsavedConfirm'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);

  // recarregar ou fechar a aba: o navegador mostra o próprio aviso
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [hasUnsaved]);

  return <UnsavedContext.Provider value={register}>{children}</UnsavedContext.Provider>;
}

export function useUnsavedChanges(dirty) {
  const register = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    register?.(id, Boolean(dirty));
    return () => register?.(id, false);
  }, [register, id, dirty]);
}

// Compara valores de formulário (strings, listas, objetos simples)
export const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Ctrl+S / ⌘S envia o formulário em que está o foco
export function saveShortcut(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    e.currentTarget.requestSubmit?.();
  }
}

// Botão de salvar com a indicação de alterações pendentes e a dica do atalho
export function SaveButton({ busy, dirty, label, className = '' }) {
  const { t } = useI18n();
  return (
    <span className={`d-inline-flex flex-wrap align-items-center gap-2 ${className}`}>
      <button type="submit" className="btn btn-primary" disabled={busy} title={t('common.saveShortcut')}>
        {busy ? t('common.saving') : (label ?? t('common.save'))}
      </button>
      {dirty && !busy && (
        <span className="small text-warning-emphasis" role="status">
          <i className="bi bi-circle-fill me-1 kt-dot" aria-hidden="true" />{t('common.unsaved')}
        </span>
      )}
    </span>
  );
}
