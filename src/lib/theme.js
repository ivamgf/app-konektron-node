// Tema claro/escuro: data-bs-theme no <html> (Bootstrap 5.3) + escolha salva no navegador.
// Sem escolha salva, segue o sistema operacional.
import { useCallback, useState } from 'react';

export const THEMES = ['light', 'dark'];
const STORAGE_KEY = 'kt.theme';

export function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    // sem armazenamento: segue o sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b2633' : '#019bcd');
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute('data-bs-theme') ?? initialTheme());
  const setTheme = useCallback((next) => {
    applyTheme(next);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // preferência só nesta aba
    }
  }, []);
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  return { theme, setTheme, toggle };
}
