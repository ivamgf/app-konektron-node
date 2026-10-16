import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches, useNavigate } from 'react-router';
import { session } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LANGUAGES, useI18n } from '../i18n/I18nProvider.jsx';
import { useTheme } from '../lib/theme.js';
import { useToast } from './Toasts.jsx';
import { BrandMark, Loading } from './ui.jsx';
import { UnsavedProvider } from './unsaved.jsx';

const API_DOCS_URL = `${(import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')}/docs/`;
export const SITE_URL = 'www.orkneytech-lab.com';
export const CONTACT_EMAIL = 'konektron@orkneytech-lab.com';

// Rótulos dinâmicos de migalhas (ex.: nome do projeto), definidos pela própria página
const CrumbContext = createContext(null);
export function useCrumbLabel(routeId, label) {
  const setLabel = useContext(CrumbContext);
  useEffect(() => {
    if (label) setLabel(routeId, label);
  }, [routeId, label, setLabel]);
}

function Breadcrumbs({ labels }) {
  const { t } = useI18n();
  const matches = useMatches().filter((m) => m.handle?.crumb);
  const labelOf = (m) => labels[m.id] ?? t(m.handle.crumb);
  // título da aba: página atual e a de cima (ex.: "Tarefas · CommonKADS · KoneKtron")
  const title = [...matches.slice(1).slice(-2).reverse().map(labelOf), 'KoneKtron'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
  if (!matches.length) return null;
  // "Voltar" (à direita da barra) leva sempre ao nível acima na hierarquia (funciona mesmo vindo de um link direto)
  const parent = matches.length > 1 ? matches[matches.length - 2] : null;
  const backLabel = parent && t('nav.backTo', { page: labelOf(parent) });
  return (
    <nav className="kt-breadcrumbs kt-no-print d-flex flex-wrap align-items-center gap-2 gap-sm-3" aria-label={t('nav.breadcrumb')}>
      <ol className="breadcrumb">
        {matches.map((m, i) => {
          const last = i === matches.length - 1;
          const label = labelOf(m);
          return (
            <li key={m.id} className={`breadcrumb-item ${last ? 'active' : ''}`} aria-current={last ? 'page' : undefined}>
              {last ? label : <Link to={m.pathname}>{label}</Link>}
            </li>
          );
        })}
        <li className="breadcrumb-item" aria-hidden="true" />
      </ol>
      {parent && (
        <Link to={parent.pathname} className="btn btn-sm btn-outline-primary kt-back ms-auto" title={backLabel} aria-label={backLabel}>
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />{t('nav.back')}
        </Link>
      )}
    </nav>
  );
}

// Iniciais para o avatar (ex.: "ana.souza@ex.com" → "AS")
export const initialsOf = (email = '') => {
  const parts = email.split('@')[0].split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
};

// Menu lateral: quem está logado, navegação em grupos, preferências (tema e idioma) e sair
function SideMenu({ open, onClose }) {
  const { t, locale, setLocale } = useI18n();
  const { status, user, isAdmin, logout } = useAuth();
  const { theme: themeState, setTheme } = useTheme();
  // o tema também muda fora do menu (Home): vale o que está aplicado na página
  const theme = document.documentElement.getAttribute('data-bs-theme') ?? themeState;
  const toast = useToast();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const authed = status === 'authenticated';

  // aberto: foco no painel, Esc fecha, Tab fica dentro do painel e a página atrás não rola
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector('.kt-sidemenu-close')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !panel) return undefined;
      const focusable = [...panel.querySelectorAll('a[href], button:not([disabled])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return undefined;
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  const item = (to, icon, key, { end = false, external = false } = {}) => (
    <li key={key}>
      {external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          <span className="kt-sidemenu-icon"><i className={`bi bi-${icon}`} aria-hidden="true" /></span>
          <span className="kt-sidemenu-label">{t(key)}</span>
          <i className="bi bi-box-arrow-up-right kt-sidemenu-trail" aria-hidden="true" />
          <span className="visually-hidden"> ({t('nav.newTab')})</span>
        </a>
      ) : (
        <NavLink to={to} onClick={onClose} end={end}>
          <span className="kt-sidemenu-icon"><i className={`bi bi-${icon}`} aria-hidden="true" /></span>
          <span className="kt-sidemenu-label">{t(key)}</span>
          <i className="bi bi-chevron-right kt-sidemenu-trail" aria-hidden="true" />
        </NavLink>
      )}
    </li>
  );
  const group = (titleKey, items) => (
    <section className="kt-sidemenu-group" aria-labelledby={`kt-menu-${titleKey}`}>
      <h3 className="kt-sidemenu-heading" id={`kt-menu-${titleKey}`}>{t(`nav.groups.${titleKey}`)}</h3>
      <ul className="list-unstyled kt-sidemenu-nav mb-0">{items}</ul>
    </section>
  );

  const signOut = async () => {
    onClose();
    await logout();
    toast.success(t('auth.signedOut'));
    navigate('/signin');
  };

  return (
    <>
      <aside
        ref={panelRef}
        className={`offcanvas offcanvas-end kt-sidemenu ${open ? 'show' : ''}`}
        style={{ visibility: open ? 'visible' : 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kt-menu-title"
        aria-hidden={!open}
        id="kt-sidemenu"
      >
        <div className="kt-sidemenu-top">
          <div className="d-flex align-items-center gap-2">
            <BrandMark size={28} variant="mono" title="" />
            <h2 className="kt-sidemenu-title" id="kt-menu-title">KoneKtron</h2>
            <button type="button" className="kt-sidemenu-close ms-auto" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
          {authed ? (
            <Link to="/profile" className="kt-sidemenu-user" onClick={onClose}>
              <span className="kt-avatar" aria-hidden="true">{initialsOf(user?.email)}</span>
              <span className="kt-sidemenu-user-text">
                <span className="kt-sidemenu-email">{user?.email}</span>
                <span className="kt-sidemenu-badges">
                  <span className="kt-sidemenu-badge">{t('nav.plan', { plan: t(`plans.${user?.plan}`) })}</span>
                  {isAdmin && <span className="kt-sidemenu-badge is-admin">{t('roles.admin')}</span>}
                </span>
              </span>
              <i className="bi bi-chevron-right ms-auto" aria-hidden="true" />
            </Link>
          ) : (
            <div className="kt-sidemenu-guest">
              <p className="mb-2">{t('nav.guestText')}</p>
              <div className="d-flex gap-2">
                <Link to="/signin" className="btn btn-light btn-sm fw-semibold flex-fill" onClick={onClose}>
                  <i className="bi bi-box-arrow-in-right me-1" aria-hidden="true" />{t('nav.signin')}
                </Link>
                <Link to="/signup" className="btn btn-outline-light btn-sm fw-semibold flex-fill" onClick={onClose}>
                  <i className="bi bi-person-plus me-1" aria-hidden="true" />{t('nav.signup')}
                </Link>
              </div>
            </div>
          )}
        </div>

        <nav className="kt-sidemenu-body" aria-label={t('nav.menu')}>
          {group('navigate', [
            item('/', 'house', 'nav.home', { end: true }),
            item(authed ? '/projects' : '/signin', 'folder2-open', 'nav.myProjects'),
            item('/engineering', 'grid-3x3-gap', 'nav.engineering'),
          ])}
          {authed && group('account', [
            item('/profile', 'person-circle', 'nav.profile'),
            isAdmin && item('/admin', 'shield-lock', 'nav.admin'),
            <li key="signout">
              <button type="button" className="kt-sidemenu-signout" onClick={signOut}>
                <span className="kt-sidemenu-icon"><i className="bi bi-box-arrow-right" aria-hidden="true" /></span>
                <span className="kt-sidemenu-label">{t('nav.signout')}</span>
              </button>
            </li>,
          ])}
          {group('help', [
            item('/about', 'info-circle', 'nav.about'),
            item('/contacts', 'chat-dots', 'nav.contacts'),
            item('/terms', 'file-earmark-text', 'nav.terms'),
            item(API_DOCS_URL, 'code-slash', 'nav.apiDocs', { external: true }),
          ])}
        </nav>

        <div className="kt-sidemenu-bottom" role="group" aria-label={t('nav.groups.preferences')}>
          <div className="kt-segmented" role="group" aria-label={t('nav.theme')}>
            {[['light', 'sun'], ['dark', 'moon-stars']].map(([value, icon]) => (
              <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}
                aria-label={t(`theme.${value}`)} title={t(`theme.${value}`)}>
                <i className={`bi bi-${icon}`} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="kt-segmented flex-fill" role="group" aria-label={t('nav.language')}>
            {LANGUAGES.map(({ code, short }) => (
              <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)} lang={code}
                title={t(`enums.locale.${code}`)}>
                {short}
              </button>
            ))}
          </div>
        </div>
      </aside>
      {open && <div className="offcanvas-backdrop fade show kt-sidemenu-backdrop" onClick={onClose} />}
    </>
  );
}

// Seletor de idioma do cabeçalho: botão com o idioma atual e lista com os três
function LanguageMenu() {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      rootRef.current?.querySelector('.kt-lang-toggle')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="kt-lang-menu" ref={rootRef}>
      <button
        type="button"
        className="kt-lang-toggle"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${t('nav.language')}: ${t(`enums.locale.${current.code}`)}`}
        title={t('nav.language')}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-globe2" aria-hidden="true" />
        <span>{current.short}</span>
        <i className="bi bi-chevron-down small" aria-hidden="true" />
      </button>
      {open && (
        <ul className="kt-lang-list" role="menu" aria-label={t('nav.language')}>
          {LANGUAGES.map(({ code, short }) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === code}
                lang={code}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                <span className="kt-lang-short">{short}</span>
                {t(`enums.locale.${code}`)}
                {locale === code && <i className="bi bi-check2 ms-auto" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Botão flutuante para voltar ao topo nas páginas longas
function BackToTop() {
  const { t } = useI18n();
  const [show, setShow] = useState(() => window.scrollY > 600);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('kt-main')?.focus({ preventScroll: true });
  };
  return (
    <button type="button" className="btn kt-to-top kt-no-print" onClick={toTop} aria-label={t('nav.toTop')} title={t('nav.toTop')}>
      <i className="bi bi-arrow-up" aria-hidden="true" />
    </button>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="kt-footer kt-no-print">
      <div className="container-xl d-flex flex-wrap align-items-center justify-content-between gap-4">
        <div className="d-flex flex-wrap align-items-center gap-4">
          <div>
            <p className="mb-3">
              <a href={`https://${SITE_URL}`} target="_blank" rel="noopener noreferrer">
                {SITE_URL}
              </a>
            </p>
            <p className="mb-0">
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
          <div className="kt-footer-divider d-none d-md-block" />
          <div className="d-flex gap-5">
            <div className="kt-footer-logo">
              <BrandMark size={80} variant="mono" title="" />
              KoneKtron
            </div>
            <div className="kt-footer-logo">
              <img src="/brand/orkneytech-footer.png" alt="" width="80" height="80" />
              OrkneyTech
            </div>
          </div>
        </div>
        <div className="kt-credits">
          <p className="mb-3">{t('footer.developer')}</p>
          <p className="mb-0">{t('footer.design')}</p>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { t } = useI18n();
  const { status, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // o menu pertence à página em que foi aberto: navegar o fecha
  const [menuPath, setMenuPath] = useState(null);
  const menuOpen = menuPath === location.pathname;
  const [labels, setLabels] = useState({});

  const setLabel = useCallback((id, label) => setLabels((prev) => (prev[id] === label ? prev : { ...prev, [id]: label })), []);
  const closeMenu = useCallback(() => setMenuPath(null), []);

  // Sessão expirou em segundo plano: avisa e leva ao login
  useEffect(
    () =>
      session.onExpired(() => {
        toast.error(t('errors.session'));
        navigate(`/signin?next=${encodeURIComponent(location.pathname)}`);
      }),
    [toast, t, navigate, location.pathname],
  );

  const crumbValue = useMemo(() => setLabel, [setLabel]);

  // a cada navegação o foco vai para o conteúdo (teclado e leitor de tela começam pela página nova)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('kt-main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <CrumbContext.Provider value={crumbValue}>
      <div className="kt-app">
        <a href="#kt-main" className="visually-hidden-focusable">
          {t('app.skip')}
        </a>
        <header className="kt-header kt-no-print">
          <div className="h-100 d-flex align-items-center justify-content-between px-3">
            <Link to="/" className="kt-brand">
              KoneKtron
            </Link>
            <div className="d-flex align-items-center gap-3">
              {user && (
                <Link to="/profile" className="kt-header-user d-none d-md-inline-flex" title={t('nav.profile')}>
                  <span className="kt-avatar is-sm" aria-hidden="true">{initialsOf(user.email)}</span>
                  <span className="text-truncate">{user.email}</span>
                </Link>
              )}
              <LanguageMenu />
              <button
                type="button"
                className="kt-menu-toggle"
                aria-label={t('nav.openMenu')}
                aria-expanded={menuOpen}
                aria-controls="kt-sidemenu"
                onClick={() => setMenuPath(location.pathname)}
              >
                <i className="bi bi-list" aria-hidden="true" />
                <span className="d-none d-sm-inline" aria-hidden="true">{t('nav.menu')}</span>
              </button>
            </div>
          </div>
        </header>
        <Breadcrumbs labels={labels} />
        <main id="kt-main" className="kt-main" tabIndex={-1}>
          <UnsavedProvider>{status === 'loading' ? <Loading /> : <Outlet />}</UnsavedProvider>
        </main>
        <Footer />
        <SideMenu open={menuOpen} onClose={closeMenu} />
        <BackToTop />
        <ScrollRestoration />
      </div>
    </CrumbContext.Provider>
  );
}
