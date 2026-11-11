// Preferências de acessibilidade da interface (WCAG 2.2). Ficam neste navegador e valem para todas as
// telas, com ou sem login. São aplicadas como atributos no <html>, lidos pelo main.scss
// (mesmo desenho do Konektron Research).
//
// - contrast: alto contraste (fundo preto, texto branco, links e foco em amarelo) — 1.4.3 / 1.4.6
// - fontSize: tamanho do texto de 90% a 200% — 1.4.4
// - zoom: ampliação da página inteira (texto, ícones e imagens) de 100% a 200% — 1.4.4 / 1.4.10
// - spacing: altura de linha e espaço entre letras, palavras e parágrafos — 1.4.12
// - readableFont: fonte sem serifa mais aberta (baixa visão, dislexia)
// - underlineLinks: links sempre sublinhados (não dependem só da cor) — 1.4.1
// - grayscale: tons de cinza (reduz a carga visual; ajuda a conferir que nada depende só da cor)
// - bigCursor: ponteiro do mouse maior
// - strongFocus: moldura de foco mais grossa — 2.4.13
// - noMotion: sem animações e transições — 2.3.3
// - readingGuide: faixa que acompanha o ponteiro e destaca a linha lida

export const FONT_SIZES = [90, 100, 112.5, 125, 150, 175, 200];
export const ZOOM_LEVELS = [100, 110, 125, 150, 175, 200];
const DEFAULT_FONT = 100;
const DEFAULT_ZOOM = 100;

// Opções liga/desliga → atributo no <html>
export const TOGGLES = {
  contrast: 'data-kt-contrast',
  grayscale: 'data-kt-grayscale',
  readableFont: 'data-kt-readable-font',
  spacing: 'data-kt-spacing',
  underlineLinks: 'data-kt-underline',
  strongFocus: 'data-kt-focus',
  bigCursor: 'data-kt-cursor',
  readingGuide: 'data-kt-guide',
  noMotion: 'data-kt-no-motion',
};

export const DEFAULTS = Object.freeze({
  ...Object.fromEntries(Object.keys(TOGGLES).map((k) => [k, false])),
  fontSize: DEFAULT_FONT,
  zoom: DEFAULT_ZOOM,
});

export const STORAGE_KEY = 'kt.a11y';

export function readPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...DEFAULTS };
    const p = { ...DEFAULTS };
    for (const k of Object.keys(TOGGLES)) p[k] = saved[k] === true;
    p.fontSize = FONT_SIZES.includes(Number(saved.fontSize)) ? Number(saved.fontSize) : DEFAULT_FONT;
    p.zoom = ZOOM_LEVELS.includes(Number(saved.zoom)) ? Number(saved.zoom) : DEFAULT_ZOOM;
    return p;
  } catch {
    return { ...DEFAULTS };
  }
}

export const isDefault = (p) => Object.keys(DEFAULTS).every((k) => p[k] === DEFAULTS[k]);

export function savePrefs(p) {
  try {
    if (isDefault(p)) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // sem armazenamento: vale só enquanto a página estiver aberta
  }
}

// Aplica no <html> (chamado antes de montar o app, para a tela não piscar)
export function applyPrefs(p, root = document.documentElement) {
  for (const [k, attr] of Object.entries(TOGGLES)) {
    if (p[k]) root.setAttribute(attr, '');
    else root.removeAttribute(attr);
  }
  root.style.fontSize = p.fontSize === DEFAULT_FONT ? '' : `${p.fontSize}%`;
  if (p.zoom === DEFAULT_ZOOM) {
    root.removeAttribute('data-kt-zoom');
    root.style.removeProperty('--kt-zoom');
  } else {
    root.setAttribute('data-kt-zoom', '');
    root.style.setProperty('--kt-zoom', String(p.zoom / 100));
  }
}

// Próximo valor da escala (passo +1 aumenta, -1 diminui), sem sair dela
export function step(scale, current, delta, fallback) {
  const i = scale.indexOf(current);
  const j = Math.min(scale.length - 1, Math.max(0, (i < 0 ? scale.indexOf(fallback) : i) + delta));
  return scale[j];
}
export const nextFontSize = (current, delta) => step(FONT_SIZES, current, delta, DEFAULT_FONT);
export const nextZoom = (current, delta) => step(ZOOM_LEVELS, current, delta, DEFAULT_ZOOM);

export const formatPercent = (value, locale = 'pt-BR') =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;

export const activeCount = (p) => Object.keys(DEFAULTS).filter((k) => p[k] !== DEFAULTS[k]).length;
