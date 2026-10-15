import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import en from './en.js';
import es from './es.js';
import ptBR from './pt-BR.js';

// RNF5: português (padrão), inglês e espanhol
export const LOCALES = { 'pt-BR': ptBR, en, es };
export const DEFAULT_LOCALE = 'pt-BR';
// Ordem e rótulos curtos do seletor de idioma
export const LANGUAGES = [
  { code: 'pt-BR', short: 'PT' },
  { code: 'en', short: 'EN' },
  { code: 'es', short: 'ES' },
];
const STORAGE_KEY = 'kt.locale';

const lookup = (messages, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), messages);

export function translate(locale, key, vars) {
  const raw = lookup(LOCALES[locale], key) ?? lookup(LOCALES[DEFAULT_LOCALE], key) ?? key;
  if (typeof raw !== 'string' || !vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}

function initialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {
    // sem armazenamento: idioma padrão
  }
  return DEFAULT_LOCALE;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const first = initialLocale();
    document.documentElement.lang = first;
    return first;
  });

  const setLocale = useCallback((next) => {
    if (!LOCALES[next]) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // preferência só nesta aba
    }
    document.documentElement.lang = next;
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n fora do I18nProvider');
  return ctx;
}
