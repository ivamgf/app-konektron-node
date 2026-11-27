// Diagnóstico de dados › Relatório › "5. Mapeamento dos fluxos de dados": leitura de um CSV com os fluxos
// (uma linha por fluxo) e geração do modelo para preencher. Tudo no navegador: as linhas entram na tabela
// da seção e são gravadas quando o documento é salvo.
//
// Cabeçalhos aceitos: os rótulos das colunas em português, inglês ou espanhol (os do modelo) e alguns
// sinônimos. Nas listas ("Método de integração", "Monitorado?") vale a chave da API ou o rótulo em
// qualquer idioma; valor desconhecido fica em branco e vira um aviso.
import { DD_ENUMS, DD_TEXT, ddText } from '../content/dataDiagnosis.js';
import { normalizeHeader, parseCsv, toCsv } from './csv.js';

// Campos de cada fluxo, na ordem da tabela, com o limite de caracteres da API (dataDiagnosis.schemas.js)
export const FLOW_FIELDS = ['code', 'origin', 'destination', 'data', 'method', 'frequency', 'format', 'owner', 'monitored'];
export const FLOW_MAX_LENGTH = { code: 20, origin: 200, destination: 200, data: 500, frequency: 100, format: 100, owner: 200 };
export const FLOW_OPTIONS = { method: 'flowMethods', monitored: 'yesNo' };
export const FLOWS_MAX = 300; // máximo de linhas da seção na API

const EXTRA_HEADERS = {
  code: ['id', 'codigo', 'cod', 'code', 'fluxo', 'flow', 'flujo'],
  origin: ['origem', 'origen', 'origin', 'source', 'fonte', 'fuente', 'from', 'de'],
  destination: ['destino', 'destination', 'target', 'to', 'para'],
  data: ['dados', 'datos', 'data', 'conteudo', 'contenido', 'content'],
  method: ['metodo', 'method', 'forma', 'integracao', 'integration', 'integracion'],
  frequency: ['frequencia', 'frequency', 'frecuencia', 'periodicidade', 'periodicidad'],
  format: ['formato', 'format'],
  owner: ['responsavel', 'owner', 'responsable', 'dono'],
  monitored: ['monitorado', 'monitored', 'monitoreado', 'monitoramento', 'monitoring'],
};
const EXTRA_VALUES = {
  flowMethods: {
    etl: ['etl', 'elt'],
    replication: ['replicacao', 'replication', 'replicacion'],
    file_transfer: ['sftp', 'ftp', 'filetransfer', 'transferencia'],
    manual: ['manual'],
    streaming: ['streaming', 'mensageria', 'messaging', 'mensajeria', 'kafka'],
    other: ['outro', 'outra', 'other', 'otro'],
  },
  yesNo: {
    yes: ['sim', 's', 'y', 'si', 'true', 'verdadeiro', '1', 'x'],
    no: ['nao', 'n', 'false', 'falso', '0'],
    unknown: ['aconfirmar', 'tobeconfirmed', 'porconfirmar', 'naosei', 'unknown'],
  },
};

const LOCALES = Object.keys(DD_TEXT);

// cabeçalho normalizado → campo
const HEADER_ALIAS = (() => {
  const map = {};
  for (const [field, names] of Object.entries(EXTRA_HEADERS)) names.forEach((n) => (map[n] = field));
  for (const locale of LOCALES) {
    const labels = DD_TEXT[locale].report.fields;
    FLOW_FIELDS.forEach((field) => (map[normalizeHeader(labels[field])] ??= field));
  }
  return map;
})();

// valor normalizado → chave da lista, por lista
const VALUE_ALIAS = Object.fromEntries(
  Object.values(FLOW_OPTIONS).map((list) => {
    const map = {};
    DD_ENUMS[list].forEach((key) => {
      map[normalizeHeader(key)] = key;
      LOCALES.forEach((locale) => (map[normalizeHeader(DD_TEXT[locale].options[list][key])] = key));
      (EXTRA_VALUES[list]?.[key] ?? []).forEach((n) => (map[n] ??= key));
    });
    return [list, map];
  }),
);

export const flowOptionKey = (list, raw) => VALUE_ALIAS[list][normalizeHeader(raw)] ?? null;

/**
 * Lê o CSV dos fluxos.
 * @returns {{ flows: object[], lines: number[], columns: string[], ignored: string[],
 *   warnings: { line: number, field: string, kind: 'invalidOption'|'truncated', value?: string, max?: number }[] }}
 *   lines[i] é a linha do arquivo (o cabeçalho é a linha 1) do fluxo i
 */
export function csvToFlows(text) {
  const [header = [], ...body] = parseCsv(text);
  const columns = header.map((h) => HEADER_ALIAS[normalizeHeader(h)] ?? null);
  // a mesma coluna repetida: vale a primeira
  columns.forEach((field, i) => {
    if (field && columns.indexOf(field) !== i) columns[i] = null;
  });
  const ignored = header.filter((_, i) => !columns[i]).map((h) => h.trim()).filter(Boolean);
  const flows = [];
  const lines = [];
  const warnings = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    const flow = {};
    columns.forEach((field, i) => {
      const raw = (cells[i] ?? '').trim();
      if (!field || raw === '') return;
      if (FLOW_OPTIONS[field]) {
        const key = flowOptionKey(FLOW_OPTIONS[field], raw);
        if (key) flow[field] = key;
        else warnings.push({ line, field, kind: 'invalidOption', value: raw });
        return;
      }
      const max = FLOW_MAX_LENGTH[field];
      if (raw.length > max) warnings.push({ line, field, kind: 'truncated', max });
      flow[field] = raw.slice(0, max);
    });
    if (!Object.keys(flow).length) return;
    // a linha entra completa, como as criadas por "Adicionar linha"
    flows.push(Object.fromEntries(FLOW_FIELDS.map((f) => [f, flow[f] ?? ''])));
    lines.push(line);
  });
  return { flows, lines, columns: FLOW_FIELDS.filter((f) => columns.includes(f)), ignored, warnings };
}

// Modelo para preencher: cabeçalho com os rótulos do idioma e os fluxos de exemplo do relatório
export function flowsTemplateCsv(locale) {
  const d = ddText(locale);
  const label = (field, value) => (FLOW_OPTIONS[field] && value ? d.options[FLOW_OPTIONS[field]][value] : value);
  return toCsv([
    FLOW_FIELDS.map((f) => d.report.fields[f]),
    ...d.templates.report.examples.flows.map((row) => FLOW_FIELDS.map((f) => label(f, row[f] ?? ''))),
  ]);
}
