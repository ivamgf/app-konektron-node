// Exportação dos relatórios para PDF, DOCX e CSV, feita no navegador.
// O relatório que está na tela é lido (títulos, campos preenchidos, tabelas, listas e checklists) e vira um
// modelo simples de documento; cada formato desenha esse modelo. Assim os relatórios de leitura (Análise de
// Sistemas, CRISP-DM, CommonKADS) e os documentos editáveis do Diagnóstico de dados exportam igual.
// pdfmake e docx são carregados só quando o usuário pede o arquivo.

const SKIP_TAGS = new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'svg', 'DETAILS', 'NAV', 'TEMPLATE', 'DATALIST', 'OPTION']);
const SKIP_CLASSES = ['kt-no-print', 'visually-hidden', 'form-text', 'kt-ai-button', 'invalid-feedback', 'btn', 'kt-sheet-n'];

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleanBlock = (s) => String(s ?? '').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

function skipped(el) {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.hidden || el.getAttribute('aria-hidden') === 'true' || el.dataset?.export === 'skip') return true;
  return SKIP_CLASSES.some((c) => el.classList?.contains(c));
}

// Valor visível de um controle de formulário
export function controlValue(el, { yes = 'Sim', no = 'Não', formatDate = (v) => v } = {}) {
  if (el.tagName === 'SELECT') {
    if (el.value === '') return '';
    return clean(el.selectedOptions?.[0]?.textContent ?? el.value);
  }
  if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? yes : no;
  if (el.type === 'date') return el.value ? formatDate(el.value) : '';
  if (el.tagName === 'TEXTAREA') return cleanBlock(el.value);
  return clean(el.value);
}

// Texto de um nó, com os valores dos controles no lugar deles e sem botões/ícones
function textOf(node, opts, block = false) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return '';
  const el = node;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return controlValue(el, opts);
  if (skipped(el)) return '';
  if (el.tagName === 'BR') return '\n';
  const inner = [...el.childNodes].map((c) => textOf(c, opts, block)).join('');
  return ['P', 'DIV', 'LI', 'TR'].includes(el.tagName) && block ? `${inner}\n` : inner;
}

const isHeading = (el) => /^H[1-6]$/.test(el.tagName);
const controlIn = (el) => el.querySelector('input:not([type="checkbox"]):not([type="radio"]), select, textarea');

function parseTable(table, opts) {
  const rowsEl = [...table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr')];
  const cells = rowsEl.map((tr) => [...tr.children].map((c) => ({ header: c.tagName === 'TH', text: cleanBlock(textOf(c, opts, true)) })));
  const headRows = table.tHead ? table.tHead.rows.length : 0;
  let head = headRows ? cells[0].map((c) => c.text) : null;
  let body = cells.slice(headRows).map((r) => r.map((c) => c.text));
  // colunas sem título e sem conteúdo (ações, barras do cronograma) saem
  const width = Math.max(head?.length ?? 0, ...body.map((r) => r.length));
  const keep = [...Array(width).keys()].filter((i) => (head?.[i] ?? '') !== '' || body.some((r) => (r[i] ?? '') !== ''));
  head = head ? keep.map((i) => head[i] ?? '') : null;
  body = body.map((r) => keep.map((i) => r[i] ?? '')).filter((r) => r.some(Boolean));
  const caption = table.caption && !table.caption.classList.contains('visually-hidden') ? clean(table.caption.textContent) : '';
  return { type: 'table', caption, head, rows: body };
}

/**
 * Lê o relatório da tela.
 * @returns {Array} blocos: {type:'heading',level,text} | {type:'paragraph',text} | {type:'field',label,value}
 *   | {type:'table',caption,head,rows} | {type:'list',ordered,items} | {type:'check',checked,text}
 */
export function domToBlocks(root, opts = {}) {
  const blocks = [];
  const walk = (el) => {
    if (el.nodeType !== 1 || skipped(el)) return;
    // indicador pronto (ex.: cartões de resumo): data-export-label + data-export-value
    if (el.dataset?.exportLabel !== undefined) {
      blocks.push({ type: 'field', label: el.dataset.exportLabel, value: el.dataset.exportValue ?? '' });
      return;
    }
    if (isHeading(el)) {
      const text = clean(textOf(el, opts));
      if (text) blocks.push({ type: 'heading', level: Number(el.tagName[1]), text });
      return;
    }
    if (el.tagName === 'TABLE') {
      const t = parseTable(el, opts);
      if (t.rows.length || t.head) blocks.push(t);
      return;
    }
    if (el.tagName === 'FIELDSET') {
      const legend = el.querySelector(':scope > legend');
      if (legend) blocks.push({ type: 'heading', level: 5, text: clean(textOf(legend, opts)) });
      [...el.children].filter((c) => c.tagName !== 'LEGEND').forEach(walk);
      return;
    }
    // checklist: caixa marcada/desmarcada + rótulo (+ situação, se houver)
    if (el.classList.contains('form-check') && el.querySelector('input[type="checkbox"]')) {
      const box = el.querySelector('input[type="checkbox"]');
      const label = clean(textOf(el.querySelector('label') ?? el, opts));
      const sibling = el.parentElement?.querySelector(':scope > div:not(.form-check) input');
      const extra = sibling && el.parentElement.tagName === 'LI' ? clean(sibling.value) : '';
      blocks.push({ type: 'check', checked: box.checked, text: extra ? `${label} — ${extra}` : label });
      return;
    }
    // campo: rótulo + controle
    const label = el.querySelector(':scope > label.form-label, :scope > .kt-field-head > label.form-label, :scope > label.kt-field-label');
    const control = label && controlIn(el);
    if (label && control && !el.querySelector('table')) {
      blocks.push({ type: 'field', label: clean(textOf(label, opts)).replace(/\s*\*$/, ''), value: controlValue(control, opts) });
      return;
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      if (el.querySelector('input, select, textarea, table')) {
        [...el.children].forEach(walk);
        return;
      }
      const items = [...el.children].map((li) => cleanBlock(textOf(li, opts, true))).filter(Boolean);
      if (items.length) blocks.push({ type: 'list', ordered: el.tagName === 'OL', items });
      return;
    }
    const hasBlockChild = [...el.children].some(
      (c) => !skipped(c) && (isHeading(c) || ['TABLE', 'UL', 'OL', 'P', 'DIV', 'SECTION', 'ARTICLE', 'FIELDSET', 'FORM', 'FIGURE', 'DL', 'HEADER'].includes(c.tagName)),
    );
    if (!hasBlockChild) {
      const text = el.classList.contains('kt-prewrap') || el.tagName === 'P' ? cleanBlock(textOf(el, opts, true)) : clean(textOf(el, opts));
      if (text) blocks.push({ type: 'paragraph', text });
      return;
    }
    [...el.children].forEach(walk);
  };
  walk(root);
  return blocks;
}

// ---------------------------------------------------------------- CSV
// Uma tabela depois da outra (com o título da seção), e os campos como pares "campo;valor".
export function toCsv(blocks, { separator = ';', fieldHeader = ['Campo', 'Valor'] } = {}) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n\r]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (cells) => cells.map(esc).join(separator);
  const out = [];
  let heading = '';
  let fields = [];
  const flushFields = () => {
    if (!fields.length) return;
    if (heading) out.push(line([heading]));
    out.push(line(fieldHeader), ...fields.map((f) => line(f)), '');
    fields = [];
  };
  for (const b of blocks) {
    if (b.type === 'heading') {
      flushFields();
      heading = b.text;
    } else if (b.type === 'field') fields.push([b.label, b.value]);
    else if (b.type === 'check') fields.push([b.text, b.checked ? 'X' : '']);
    else if (b.type === 'table') {
      flushFields();
      out.push(line([b.caption || heading]));
      if (b.head) out.push(line(b.head));
      out.push(...b.rows.map(line), '');
    }
  }
  flushFields();
  return `\uFEFF${out.join('\r\n')}`; // BOM: o Excel abre com acentos
}

// ---------------------------------------------------------------- PDF (pdfmake)
const wide = (blocks) => blocks.some((b) => b.type === 'table' && Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length)) > 6);

export function toPdfDefinition(blocks, { title, subtitle } = {}) {
  const content = [];
  if (title) content.push({ text: title, style: 'title' });
  if (subtitle) content.push({ text: subtitle, style: 'subtitle' });
  for (const b of blocks) {
    if (b.type === 'heading') content.push({ text: b.text, style: `h${Math.min(Math.max(b.level, 2), 5)}` });
    else if (b.type === 'paragraph') content.push({ text: b.text, margin: [0, 0, 0, 6] });
    else if (b.type === 'field') content.push({ text: [{ text: `${b.label}: `, bold: true }, b.value || '—'], margin: [0, 0, 0, 4] });
    else if (b.type === 'check') content.push({ text: `${b.checked ? '[X]' : '[  ]'} ${b.text}`, margin: [0, 0, 0, 3] });
    else if (b.type === 'list') content.push({ [b.ordered ? 'ol' : 'ul']: b.items, margin: [0, 0, 0, 6] });
    else if (b.type === 'table') {
      const cols = Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length), 1);
      const pad = (r) => [...r, ...Array(cols - r.length).fill('')];
      const body = [...(b.head ? [pad(b.head).map((h) => ({ text: h, style: 'th' }))] : []), ...b.rows.map(pad)];
      if (b.caption) content.push({ text: b.caption, italics: true, fontSize: 8, margin: [0, 2, 0, 2] });
      content.push({
        table: { headerRows: b.head ? 1 : 0, widths: Array(cols).fill('*'), body, dontBreakRows: true },
        layout: 'lightHorizontalLines',
        fontSize: cols > 6 ? 7 : 8.5,
        margin: [0, 0, 0, 10],
      });
    }
  }
  return {
    pageSize: 'A4',
    pageOrientation: wide(blocks) ? 'landscape' : 'portrait',
    pageMargins: [36, 40, 36, 40],
    info: { title: title ?? 'KoneKtron', creator: 'KoneKtron' },
    content,
    footer: (page, pages) => ({ text: `${title ?? ''} · ${page}/${pages}`, alignment: 'right', fontSize: 7, margin: [36, 10, 36, 0], color: '#555' }),
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 9, color: '#555', margin: [0, 0, 0, 12] },
      h2: { fontSize: 13, bold: true, color: '#0189b6', margin: [0, 12, 0, 6] },
      h3: { fontSize: 11.5, bold: true, margin: [0, 10, 0, 4] },
      h4: { fontSize: 10.5, bold: true, margin: [0, 8, 0, 4] },
      h5: { fontSize: 10, bold: true, margin: [0, 6, 0, 3] },
      th: { bold: true, fillColor: '#eef3f6' },
    },
    defaultStyle: { fontSize: 9.5, lineHeight: 1.15 },
  };
}

// A fonte embutida no pdfmake (Roboto) não tem setas, losangos nem caixas de seleção: troca por equivalentes
const PDF_CHARS = { '→': '->', '←': '<-', '↔': '<->', '◆': '•', '☐': '[ ]', '☒': '[X]', '✓': 'OK' };
export const pdfSafe = (v) =>
  typeof v === 'string'
    ? v.replace(/[→←↔◆☐☒✓]/g, (c) => PDF_CHARS[c])
    : Array.isArray(v)
      ? v.map(pdfSafe)
      : v && typeof v === 'object' && !(v instanceof Function)
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pdfSafe(x)]))
        : v;

async function toPdfBlob(blocks, meta) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  pdfMake.addVirtualFileSystem(vfs);
  const { footer, ...rest } = toPdfDefinition(blocks, meta);
  return pdfMake.createPdf({ ...pdfSafe(rest), footer }).getBlob();
}

// ---------------------------------------------------------------- DOCX (docx)
async function toDocxBlob(blocks, { title, subtitle } = {}) {
  const d = await import('docx');
  const { AlignmentType, Document, HeadingLevel, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, ShadingType } = d;
  const H = { 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3, 5: HeadingLevel.HEADING_4 };
  const runs = (text, extra = {}) =>
    String(text ?? '').split('\n').map((line, i) => new TextRun({ text: line, break: i ? 1 : 0, ...extra }));
  const children = [];
  if (title) children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(title) }));
  if (subtitle) children.push(new Paragraph({ children: runs(subtitle, { color: '555555', size: 18 }) }));
  for (const b of blocks) {
    if (b.type === 'heading') children.push(new Paragraph({ heading: H[Math.min(Math.max(b.level, 2), 5)], children: runs(b.text) }));
    else if (b.type === 'paragraph') children.push(new Paragraph({ children: runs(b.text), spacing: { after: 120 } }));
    else if (b.type === 'field') children.push(new Paragraph({ children: [new TextRun({ text: `${b.label}: `, bold: true }), ...runs(b.value || '—')], spacing: { after: 80 } }));
    else if (b.type === 'check') children.push(new Paragraph({ children: runs(`${b.checked ? '☒' : '☐'} ${b.text}`) }));
    else if (b.type === 'list') b.items.forEach((item, i) => children.push(new Paragraph({ children: runs(b.ordered ? `${i + 1}. ${item}` : `• ${item}`), indent: { left: 360 } })));
    else if (b.type === 'table') {
      const cols = Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length), 1);
      const pad = (r) => [...r, ...Array(cols - r.length).fill('')];
      const size = cols > 6 ? 14 : 17;
      const cell = (text, head) =>
        new TableCell({
          children: [new Paragraph({ children: runs(text, { bold: head, size }) })],
          ...(head ? { shading: { type: ShadingType.CLEAR, fill: 'EEF3F6', color: 'auto' } } : {}),
        });
      const rows = [
        ...(b.head ? [new TableRow({ tableHeader: true, children: pad(b.head).map((h) => cell(h, true)) })] : []),
        ...b.rows.map((r) => new TableRow({ cantSplit: true, children: pad(r).map((c) => cell(c, false)) })),
      ];
      if (b.caption) children.push(new Paragraph({ children: runs(b.caption, { italics: true, size: 16 }) }));
      children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      children.push(new Paragraph({ children: [] }));
    }
  }
  const doc = new Document({
    creator: 'KoneKtron',
    title: title ?? 'KoneKtron',
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [{
      properties: wide(blocks) ? { page: { size: { orientation: PageOrientation.LANDSCAPE } } } : {},
      children: children.length ? children : [new Paragraph({ alignment: AlignmentType.LEFT, children: [] })],
    }],
  });
  return Packer.toBlob(doc);
}

// ---------------------------------------------------------------- arquivo
export const fileSlug = (s) =>
  String(s ?? 'relatorio')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'relatorio';

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporta o relatório que está na tela.
 * @param {'pdf'|'docx'|'csv'} format
 * @param {HTMLElement} root  elemento do relatório
 * @param {object} meta       { title, subtitle, fileName, locale, yes, no, fieldHeader }
 */
export async function exportReport(format, root, meta = {}) {
  const fmtDate = (v) => {
    const [y, m, d] = v.split('-');
    return meta.locale === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
  };
  const blocks = domToBlocks(root, { yes: meta.yes, no: meta.no, formatDate: fmtDate });
  const name = `${fileSlug(meta.fileName ?? meta.title)}.${format}`;
  if (format === 'csv') {
    const sep = meta.locale === 'en' ? ',' : ';';
    save(new Blob([toCsv(blocks, { separator: sep, fieldHeader: meta.fieldHeader })], { type: 'text/csv;charset=utf-8' }), name);
  } else if (format === 'pdf') save(await toPdfBlob(blocks, meta), name);
  else save(await toDocxBlob(blocks, meta), name);
  return name;
}
