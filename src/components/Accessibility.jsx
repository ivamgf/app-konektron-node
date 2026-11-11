// Painel de acessibilidade (WCAG 2.2 / WAI-ARIA): botão fixo no canto da tela, em todas as páginas,
// com alto contraste, tamanho do texto, zoom e as demais opções de lib/a11y.js. Atalho: Alt+Shift+A.
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  activeCount, applyPrefs, DEFAULTS, FONT_SIZES, formatPercent, isDefault, nextFontSize, nextZoom, readPrefs,
  savePrefs, TOGGLES, ZOOM_LEVELS,
} from '../lib/a11y.js';

const ICONS = {
  contrast: 'circle-half',
  grayscale: 'droplet-half',
  readableFont: 'fonts',
  spacing: 'text-paragraph',
  underlineLinks: 'link-45deg',
  strongFocus: 'bounding-box',
  bigCursor: 'cursor',
  readingGuide: 'distribute-vertical',
  noMotion: 'pause-circle',
};

// Abre o painel de outro lugar (ex.: link junto do "Pular para o conteúdo")
export const OPEN_EVENT = 'kt-open-a11y';
export const openAccessibility = () => document.dispatchEvent(new Event(OPEN_EVENT));

const isShortcut = (e) => e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA';

// Link no topo, junto do "Pular para o conteúdo": aparece ao receber o foco do teclado
export function AccessibilityLink() {
  const { t } = useI18n();
  return (
    <button type="button" className="btn btn-link visually-hidden-focusable kt-a11y-skip" onClick={openAccessibility}>
      {t('a11y.open')} (Alt+Shift+A)
    </button>
  );
}

// Controle de escala (A− A A+) com o valor atual anunciado
function Stepper({ id, label, value, scale, base, onStep, onReset, locale, t, minusLabel, plusLabel, resetLabel, glyph }) {
  return (
    <div className="mb-3" role="group" aria-labelledby={id}>
      <div id={id} className="small fw-semibold mb-1">
        {label}: <span>{formatPercent(value, locale)}</span>
      </div>
      <div className="btn-group w-100">
        <button type="button" className="btn btn-outline-secondary" disabled={value === scale[0]} aria-label={t(minusLabel)} onClick={() => onStep(-1)}>
          {glyph}<sup aria-hidden="true">−</sup>
        </button>
        <button type="button" className="btn btn-outline-secondary" disabled={value === base} aria-label={t(resetLabel)} onClick={onReset}>
          {glyph}
        </button>
        <button type="button" className="btn btn-outline-secondary" disabled={value === scale.at(-1)} aria-label={t(plusLabel)} onClick={() => onStep(1)}>
          {glyph}<sup aria-hidden="true">+</sup>
        </button>
      </div>
    </div>
  );
}

export default function Accessibility() {
  const { t, locale } = useI18n();
  const [prefs, setPrefs] = useState(readPrefs);
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();

  const change = (next, message) => {
    setPrefs(next);
    applyPrefs(next);
    savePrefs(next);
    setAnnounce(message);
  };
  const toggle = (key) => {
    const on = !prefs[key];
    change({ ...prefs, [key]: on }, `${t(`a11y.options.${key}.label`)}: ${t(on ? 'a11y.on' : 'a11y.off')}`);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // atalho Alt+Shift+A e o evento de abrir
  useEffect(() => {
    const onKey = (e) => {
      if (!isShortcut(e)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    document.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // aberto: foco no título; Esc fecha (sem fechar um modal atrás); clique fora fecha
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector('[data-initial-focus]')?.focus();
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onOutside = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onEsc, true);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onEsc, true);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [open]);

  const active = activeCount(prefs);

  return (
    <div className="kt-a11y kt-no-print">
      <button
        ref={buttonRef}
        type="button"
        className="kt-a11y-button btn btn-primary rounded-circle shadow"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-keyshortcuts="Alt+Shift+A"
        title={`${t('a11y.title')} (Alt+Shift+A)`}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-universal-access-circle" aria-hidden="true" />
        <span className="visually-hidden">
          {t('a11y.title')}{active ? ` (${t('a11y.active', { count: active })})` : ''}
        </span>
        {active > 0 && <span className="kt-a11y-count badge rounded-pill text-bg-warning" aria-hidden="true">{active}</span>}
      </button>
      <div ref={panelRef} id={`${id}-panel`} role="dialog" aria-labelledby={`${id}-title`} className="kt-a11y-panel card shadow" hidden={!open}>
        <div className="card-header d-flex align-items-center gap-2">
          <h2 id={`${id}-title`} className="h5 mb-0 me-auto" tabIndex={-1} data-initial-focus>
            <i className="bi bi-universal-access-circle me-1" aria-hidden="true" />
            {t('a11y.title')}
          </h2>
          <button type="button" className="btn-close" aria-label={t('a11y.close')} onClick={close} />
        </div>
        <div className="card-body">
          <Stepper id={`${id}-font`} label={t('a11y.fontSize')} value={prefs.fontSize} scale={FONT_SIZES} base={100} locale={locale} t={t}
            glyph="A" minusLabel="a11y.fontSmaller" plusLabel="a11y.fontLarger" resetLabel="a11y.fontReset"
            onStep={(d) => {
              const v = nextFontSize(prefs.fontSize, d);
              change({ ...prefs, fontSize: v }, `${t('a11y.fontSize')}: ${formatPercent(v, locale)}`);
            }}
            onReset={() => change({ ...prefs, fontSize: 100 }, `${t('a11y.fontSize')}: ${formatPercent(100, locale)}`)} />
          <Stepper id={`${id}-zoom`} label={t('a11y.zoom')} value={prefs.zoom} scale={ZOOM_LEVELS} base={100} locale={locale} t={t}
            glyph={<i className="bi bi-zoom-in" aria-hidden="true" />} minusLabel="a11y.zoomOut" plusLabel="a11y.zoomIn" resetLabel="a11y.zoomReset"
            onStep={(d) => {
              const v = nextZoom(prefs.zoom, d);
              change({ ...prefs, zoom: v }, `${t('a11y.zoom')}: ${formatPercent(v, locale)}`);
            }}
            onReset={() => change({ ...prefs, zoom: 100 }, `${t('a11y.zoom')}: ${formatPercent(100, locale)}`)} />
          <ul className="list-unstyled mb-3 d-grid gap-2">
            {Object.keys(TOGGLES).map((key) => (
              <li key={key} className="form-check form-switch mb-0">
                <input className="form-check-input" type="checkbox" role="switch" id={`${id}-${key}`} checked={prefs[key]}
                  aria-describedby={`${id}-${key}-help`} onChange={() => toggle(key)} />
                <label className="form-check-label" htmlFor={`${id}-${key}`}>
                  <i className={`bi bi-${ICONS[key]} me-1`} aria-hidden="true" />{t(`a11y.options.${key}.label`)}
                </label>
                <div id={`${id}-${key}-help`} className="small text-body-secondary">{t(`a11y.options.${key}.help`)}</div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-outline-secondary btn-sm w-100" disabled={isDefault(prefs)}
            onClick={() => change({ ...DEFAULTS }, t('a11y.restored'))}>
            <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />{t('a11y.reset')}
          </button>
          <p className="small text-body-secondary mt-2 mb-0">{t('a11y.footer')}</p>
        </div>
      </div>
      <div className="visually-hidden" role="status" aria-live="polite">{announce}</div>
      {prefs.readingGuide && <ReadingGuide />}
    </div>
  );
}

// Faixa horizontal que acompanha o ponteiro e escurece o resto da tela
function ReadingGuide() {
  const [y, setY] = useState(null);
  useEffect(() => {
    // dentro do #root ampliado, as posições são multiplicadas pelo zoom: divide para seguir o ponteiro
    const onMove = (e) => setY(e.clientY / (Number(document.documentElement.style.getPropertyValue('--kt-zoom')) || 1));
    document.addEventListener('pointermove', onMove);
    return () => document.removeEventListener('pointermove', onMove);
  }, []);
  if (y === null) return null;
  return (
    <>
      <div className="kt-guide-shade" style={{ top: 0, height: Math.max(0, y - 28) }} aria-hidden="true" />
      <div className="kt-guide-band" style={{ top: y - 28 }} aria-hidden="true" />
      <div className="kt-guide-shade" style={{ top: y + 28, bottom: 0 }} aria-hidden="true" />
    </>
  );
}
