// Leitura de CSV no navegador (RFC 4180): aspas, aspas duplicadas, quebras de linha dentro de aspas,
// BOM do Excel e separador detectado (";" do Excel em português, "," ou tabulação).

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch) => firstLine.split(ch).length - 1;
  return [';', ',', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');
}

export function parseCsv(input, delimiter) {
  const text = input.replace(/^\uFEFF/, '');
  const sep = delimiter ?? detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // linhas totalmente vazias (ex.: no fim do arquivo) não contam
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Gera o CSV (separador ";", como o Excel em português abre direto)
export function toCsv(rows, sep = ';') {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(sep)).join('\r\n');
}

// "Nº de linhas" → "nodelinhas": sem acento, minúsculas, só letras e dígitos
export const normalizeHeader = (h) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Colunas aceitas para cada campo do dataset (CRISP-DM), em pt-BR, en e es
const DATASET_COLUMNS = {
  name: ['name', 'nome', 'nombre', 'dataset', 'conjuntodedados'],
  source: ['source', 'origem', 'origen', 'fonte', 'fuente'],
  format: ['format', 'formato'],
  location: ['location', 'localizacao', 'local', 'ubicacion', 'url', 'caminho', 'path', 'ruta'],
  rowCount: ['rowcount', 'rows', 'linhas', 'filas', 'registros', 'records'],
  columnCount: ['columncount', 'columns', 'colunas', 'columnas'],
  sizeBytes: ['sizebytes', 'size', 'bytes', 'tamanho', 'tamanhobytes', 'tamano', 'tamanobytes'],
  collectedAt: ['collectedat', 'collected', 'collectedon', 'coletadoem', 'datadacoleta', 'coleta', 'fechaderecoleccion', 'recolectadoel', 'fecha', 'data', 'date'],
  description: ['description', 'descricao', 'descripcion'],
  qualityNotes: ['qualitynotes', 'quality', 'qualidade', 'observacoesdequalidade','notasdequalidade', 'notasdecalidad', 'calidad'],
};
export const DATASET_FIELDS = Object.keys(DATASET_COLUMNS);
const ALIAS = Object.fromEntries(
  Object.entries(DATASET_COLUMNS).flatMap(([field, names]) => names.map((n) => [n, field])),
);
const INTEGER_FIELDS = ['rowCount', 'columnCount', 'sizeBytes'];

// "48.000", "48,000" e "48 000" viram 48000; decimais e textos ficam como estão (a API recusa)
function toInteger(raw) {
  const s = raw.replace(/\s/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  return /^\d+$/.test(s) ? Number(s) : raw;
}

// 31/01/2026 → 2026-01-31 (AAAA-MM-DD fica como está)
function toIsoDate(raw) {
  const m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw;
}

/**
 * Converte o CSV numa lista de datasets para POST /crisp-dm/datasets/import.
 * @returns {{ datasets: object[], lines: number[], columns: string[], ignored: string[], missingName: boolean }}
 *   lines[i] é a linha do arquivo (contando o cabeçalho) do dataset i
 */
export function csvToDatasets(text) {
  const [header = [], ...body] = parseCsv(text);
  const columns = header.map((h) => ALIAS[normalizeHeader(h)] ?? null);
  const ignored = header.filter((_, i) => !columns[i]).map((h) => h.trim()).filter(Boolean);
  const datasets = [];
  const lines = [];
  body.forEach((cells, index) => {
    const item = {};
    columns.forEach((field, i) => {
      const raw = (cells[i] ?? '').trim();
      if (!field || raw === '' || item[field] !== undefined) return;
      if (INTEGER_FIELDS.includes(field)) item[field] = toInteger(raw);
      else if (field === 'collectedAt') item[field] = toIsoDate(raw);
      else item[field] = raw;
    });
    if (Object.keys(item).length) {
      datasets.push(item);
      lines.push(index + 2);
    }
  });
  return { datasets, lines, columns: [...new Set(columns.filter(Boolean))], ignored, missingName: !columns.includes('name') };
}
