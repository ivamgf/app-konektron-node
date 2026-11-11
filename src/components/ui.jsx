// Componentes visuais do protótipo / Design System KonekTron
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useTheme } from '../lib/theme.js';

// Símbolo KoneKtron (Brand Icons). variant: 'color' | 'mono'
export function BrandMark({ size = 200, variant = 'color', className = '', title = 'KoneKtron' }) {
  const orange = variant === 'mono' ? '#808080' : '#fe7d05';
  const blue = variant === 'mono' ? '#ffffff' : '#019bcd';
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`kt-mark ${className}`}
      role="img"
      aria-label={title}
    >
      <path d="M0 0H31V35H66V66H31V100H0Z" fill={orange} />
      <path d="M35 0H100V66H70V31H35Z" fill={blue} />
      <path d="M35 70H100V100H35Z" fill={blue} />
    </svg>
  );
}

// Alterna tema claro/escuro (a escolha vale para o app inteiro e fica salva)
export function ThemeToggle({ className = 'btn-outline-light' }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className={`btn btn-sm kt-theme-toggle ${className}`} onClick={toggle} aria-pressed={dark}
      title={t(dark ? 'theme.toLight' : 'theme.toDark')}>
      <i className={`bi ${dark ? 'bi-sun' : 'bi-moon-stars'} me-1`} aria-hidden="true" />
      {t(dark ? 'theme.light' : 'theme.dark')}
    </button>
  );
}

export function Loading({ small = false, label }) {
  const { t } = useI18n();
  return (
    <div className={`kt-loading ${small ? 'kt-loading-sm' : ''}`} role="status" aria-live="polite">
      <div className="kt-loading-label">{label ?? t('common.loading')}</div>
      <span className="kt-spinner" aria-hidden="true" />
    </div>
  );
}

// Cartão com faixa laranja (Signin, Signup, Recover, Terms)
export function Panel({ title, wide = false, children }) {
  return (
    <section className={`kt-panel ${wide ? 'kt-panel-wide' : ''}`} aria-labelledby="kt-panel-title">
      <h1 className="kt-panel-header" id="kt-panel-title">
        {title}
      </h1>
      <div className="kt-panel-body">{children}</div>
    </section>
  );
}

// Cartão azul com ícone (About, Contacts e áreas logadas)
export function ContentCard({ icon, title, footer, actions, children, bodyClassName = '', as: Heading = 'h2' }) {
  return (
    <section className="card kt-card">
      <div className="card-header">
        {icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
        <Heading className="flex-grow-1">{title}</Heading>
        {actions}
      </div>
      <div className={`card-body ${bodyClassName}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

// Campo do protótipo: rótulo grande e ícone azul à esquerda
export function IconInput({ label, icon, error, id, className = '', ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={`mb-4 ${className}`}>
      <label className="kt-field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="input-group kt-input-icon has-validation">
        <span className="input-group-text" aria-hidden="true">
          <i className={`bi bi-${icon}`} />
        </span>
        <input
          id={inputId}
          className={`form-control ${error ? 'is-invalid' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {error && (
          <div className="invalid-feedback" id={errorId}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="d-flex align-items-center justify-content-between mt-3" aria-label="pagination">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <i className="bi bi-arrow-left" aria-hidden="true" /> {t('common.previous')}
      </button>
      <span className="small text-body-secondary">{t('common.pageOf', { page, pages })}</span>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        {t('common.next')} <i className="bi bi-arrow-right" aria-hidden="true" />
      </button>
    </nav>
  );
}

// Modais abertos, do mais antigo ao mais novo: Esc e Tab valem só para o de cima (ex.: IA sobre um cadastro)
const modalStack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Modal acessível sem o JS do Bootstrap (padrão de diálogo do WAI-ARIA): foco inicial, Tab preso no
// diálogo, Esc fecha, fundo bloqueado e o foco volta para quem abriu. Fica num portal no <body>,
// fora de formulários da página.
export function Modal({ title, onClose, children, footer, size = '' }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Só ao abrir: focar de novo a cada renderização roubaria o foco de quem digita
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialogRef.current;
    const token = {};
    modalStack.push(token);
    node?.querySelector('input, select, textarea, button:not(.btn-close)')?.focus();
    const onKey = (e) => {
      if (modalStack.at(-1) !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (!node.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      if (!modalStack.length) document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <>
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className={`modal-dialog modal-dialog-scrollable ${size}`} ref={dialogRef}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h4" id={titleId}>
                {title}
              </h2>
              <button type="button" className="btn-close" aria-label={t('common.close')} onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}

export function EmptyState({ children }) {
  return <p className="text-body-secondary text-center py-4 mb-0">{children}</p>;
}
