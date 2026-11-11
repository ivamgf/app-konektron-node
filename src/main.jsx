
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/main.scss';
import { AuthProvider } from './auth/AuthProvider.jsx';
import Accessibility from './components/Accessibility.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import { I18nProvider } from './i18n/I18nProvider.jsx';
import { applyPrefs, readPrefs } from './lib/a11y.js';
import { applyTheme, initialTheme } from './lib/theme.js';
import { router } from './router.jsx';

// antes de renderizar, para a página não abrir clara e depois escurecer
applyTheme(initialTheme());
// acessibilidade (contraste, tamanho do texto, zoom...) também antes, para a tela não piscar
applyPrefs(readPrefs());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
      <Accessibility />
    </I18nProvider>
  </StrictMode>,
);
