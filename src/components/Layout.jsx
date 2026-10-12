import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches, useNavigate } from 'react-router';
import { session } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from './Toasts.jsx';
import { BrandMark, Loading } from './ui.jsx';

const API_DOCS_URL = `${(import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')}/docs/`;
export const SITE_URL = 'www.konektron.orkneytech.com.br';
export const CONTACT_EMAIL = 'konektron@konektron.orkneytech.com.br';

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
  if (!matches.length) return null;
  return (
    <nav className="kt-breadcrumbs kt-no-print" aria-label={t('nav.breadcrumb')}>
      <ol className="breadcrumb">
        {matches.map((m, i) => {
          const last = i === matches.length - 1;
          const label = labels[m.id] ?? t(m.handle.crumb);
          return (
            <li key={m.id} className={`breadcrumb-item ${last ? 'active' : ''}`} aria-current={last ? 'page' : undefined}>
              {last ? label : <Link to={m.pathname}>{label}</Link>}
            </li>
          );
        })}
        <li className="breadcrumb-item" aria-hidden="true" />
      </ol>
    </nav>
  );
}

function SideMenu({ open, onClose }) {
  const { t, locale, setLocale } = useI18n();
  const { status, isAdmin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const authed = status === 'authenticated';

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panelRef.current?.querySelector('.btn-close')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  const item = (to, icon, key) => (
    <li>
      <NavLink to={to} onClick={onClose} end={to === '/'}>
        {t(key)} <i className={`bi bi-${icon}`} aria-hidden="true" />
      </NavLink>
    </li>
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
        aria-labelledby="kt-menu-title"
        aria-hidden={!open}
        id="kt-sidemenu"
      >
        <div className="offcanvas-header">
          <h2 className="offcanvas-title" id="kt-menu-title">
            {t('nav.menu')}
          </h2>
          <button type="button" className="btn-close" aria-label={t('common.close')} onClick={onClose} />
        </div>
        <div className="offcanvas-body d-flex flex-column px-4">
          <nav aria-label={t('nav.menu')}>
            <ul className="list-unstyled kt-sidemenu-nav mb-0">
              {item('/', 'house', 'nav.home')}
              {item('/about', 'file-text', 'nav.about')}
              {item(authed ? '/projects' : '/signin', 'tools', 'nav.projects')}
              {item('/engineering', 'box', 'nav.engineering')}
              {item('/terms', 'file-earmark-text', 'nav.terms')}
              <li>
                <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                  {t('nav.docs')} <i className="bi bi-folder" aria-hidden="true" />
                </a>
              </li>
              {item('/contacts', 'envelope', 'nav.contacts')}
            </ul>
            <div className="kt-sidemenu-sep" />
            <ul className="list-unstyled kt-sidemenu-nav mb-0">
              {authed ? (
                <>
                  {item('/profile', 'person-circle', 'nav.profile')}
                  {isAdmin && item('/admin', 'speedometer2', 'nav.admin')}
                  <li>
                    <button type="button" onClick={signOut}>
                      {t('nav.signout')} <i className="bi bi-box-arrow-right" aria-hidden="true" />
                    </button>
                  </li>
                </>
              ) : (
                <>
                  {item('/signin', 'box-arrow-in-right', 'nav.signin')}
                  {item('/signup', 'person-plus', 'nav.signup')}
                </>
              )}
            </ul>
          </nav>
          <div className="kt-sidemenu-sep" />
          <div className="kt-lang d-flex justify-content-end align-items-center gap-2" role="group" aria-label={t('nav.language')}>
            {['en', 'pt-BR'].map((code) => (
              <button
                key={code}
                type="button"
                className={`btn btn-sm btn-outline-light ${locale === code ? 'active' : ''}`}
                aria-pressed={locale === code}
                onClick={() => setLocale(code)}
                lang={code}
              >
                {code === 'en' ? 'EN' : 'PT'}
              </button>
            ))}
          </div>
          <img
            src="/brand/konektron-engineering-design.png"
            alt="KoneKtron Engineering & Design"
            width="124"
            height="90"
            className="mt-auto mx-auto d-block pt-4"
          />
        </div>
      </aside>
      {open && <div className="offcanvas-backdrop fade show" onClick={onClose} />}
    </>
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
              {user && <span className="kt-header-user d-none d-sm-inline">{user.email}</span>}
              <button
                type="button"
                className="kt-menu-toggle"
                aria-label={t('nav.openMenu')}
                aria-expanded={menuOpen}
                aria-controls="kt-sidemenu"
                onClick={() => setMenuPath(location.pathname)}
              >
                <i className="bi bi-list" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <Breadcrumbs labels={labels} />
        <main id="kt-main" className="kt-main" tabIndex={-1}>
          {status === 'loading' ? <Loading /> : <Outlet />}
        </main>
        <Footer />
        <SideMenu open={menuOpen} onClose={closeMenu} />
        <ScrollRestoration />
      </div>
    </CrumbContext.Provider>
  );
}
