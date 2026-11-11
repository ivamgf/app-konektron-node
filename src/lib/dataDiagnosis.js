// Cálculos do diagnóstico de dados (funções puras, testadas em src/test/dataDiagnosis.test.js):
// indicadores do relatório, sugestão de nível de maturidade a partir dos indicadores objetivos,
// nota consolidada (média ponderada) e conteúdo inicial de um documento novo.
import { ddText, GOVERNANCE_ITEMS, GOLIVE_ITEMS, MATURITY_DIMENSIONS, QUALITY_DIMS } from '../content/dataDiagnosis.js';

const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
const filled = (v) => typeof v === 'string' && v.trim() !== '';
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Régua sugerida para percentuais (definida antes de pontuar): até 25% = 1, até 50% = 2, até 75% = 3,
// acima de 75% = 4 e acima de 90% com o critério extra (ex.: monitoramento) = 5.
export function levelFromPercent(p, extraForFive = false) {
  if (p > 90 && extraForFive) return 5;
  if (p > 75) return 4;
  if (p > 50) return 3;
  if (p > 25) return 2;
  return 1;
}

// Média das notas de qualidade (1 a 5) de uma linha da seção 6; null sem notas
export function qualityRowAverage(row) {
  const scores = QUALITY_DIMS.map((d) => row?.[d]).filter((v) => Number.isInteger(v));
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

export function qualityAverage(rows = []) {
  const all = rows.flatMap((r) => QUALITY_DIMS.map((d) => r?.[d]).filter((v) => Number.isInteger(v)));
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
}

const isManual = (f) => f.method === 'manual';
const hasMethod = (f) => filled(f.method);

// Indicadores objetivos do relatório (base do sumário executivo e das sugestões de nível)
export function reportIndicators(content = {}) {
  const sources = content.sources ?? [];
  const flows = (content.flows ?? []).filter((f) => filled(f.origin) || filled(f.destination) || filled(f.code));
  const withMethod = flows.filter(hasMethod);
  const manual = withMethod.filter(isManual).length;
  const owned = sources.filter((s) => filled(s.ownerArea) && filled(s.technicalOwner)).length;
  const documented = sources.filter((s) => s.documented === 'yes').length;
  const monitored = flows.filter((f) => f.monitored === 'yes').length;
  const governanceDone = GOVERNANCE_ITEMS.filter((k) => content.governance?.[k]?.done).length;
  return {
    sources: sources.length,
    flows: flows.length,
    manualFlows: manual,
    manualPct: pct(manual, withMethod.length),
    automatedPct: withMethod.length ? 100 - pct(manual, withMethod.length) : 0,
    monitoredPct: pct(monitored, flows.length),
    ownedPct: pct(owned, sources.length),
    documentedPct: pct(documented, sources.length),
    personalData: sources.filter((s) => s.personalData === 'yes').length,
    criticalProblems: (content.problems ?? []).filter((p) => p.severity === 'high').length,
    qualityAverage: qualityAverage(content.quality),
    governanceDone,
    governanceTotal: GOVERNANCE_ITEMS.length,
    hasMethods: withMethod.length > 0,
  };
}

// Sugestão de nível por dimensão (null quando o relatório não tem dados para sugerir)
export function maturitySuggestions(content = {}) {
  const i = reportIndicators(content);
  return {
    sources: i.sources ? levelFromPercent(i.ownedPct, i.documentedPct > 90) : null,
    flows: i.hasMethods ? levelFromPercent(i.automatedPct, i.monitoredPct > 90) : null,
    quality: i.qualityAverage == null ? null : Math.max(1, Math.min(5, Math.floor(i.qualityAverage))),
    // mesma régua sobre o % do checklist da seção 7; nível 5 só com todos os itens
    governance:
      content.governance && Object.keys(content.governance).length
        ? levelFromPercent(pct(i.governanceDone, i.governanceTotal), i.governanceDone === i.governanceTotal)
        : null,
    usage: null,
  };
}

// Nota consolidada: média ponderada das dimensões avaliadas (peso padrão 1). null se nenhuma avaliada.
export function consolidatedScore(maturity = {}) {
  let sum = 0;
  let weights = 0;
  for (const d of MATURITY_DIMENSIONS) {
    const m = maturity[d];
    if (!Number.isInteger(m?.level)) continue;
    const w = typeof m.weight === 'number' && m.weight >= 0 ? m.weight : 1;
    sum += m.level * w;
    weights += w;
  }
  return weights ? Math.round((sum / weights) * 10) / 10 : null;
}

// Lacunas atual → alvo, para levar ao plano de ação
export function maturityGaps(maturity = {}) {
  return MATURITY_DIMENSIONS.flatMap((d) => {
    const m = maturity[d];
    return Number.isInteger(m?.level) && Number.isInteger(m?.target) && m.target > m.level
      ? [{ dimension: d, from: m.level, to: m.target, gap: m.target - m.level }]
      : [];
  }).sort((a, b) => b.gap - a.gap);
}

export function inventoryStats(content = {}) {
  const dbs = content.databases ?? [];
  return {
    systems: (content.systems ?? []).length,
    databases: dbs.length,
    integrations: (content.integrations ?? []).length,
    manual: (content.integrations ?? []).filter((r) => r.method === 'manual').length,
    noBackup: dbs.filter((d) => !filled(d.backup) || /^(n[aã]o|no)\b/i.test(d.backup.trim())).length,
    pending: (content.pending ?? []).length,
  };
}

export function planStats(content = {}) {
  const acts = content.activities ?? [];
  return {
    activities: acts.length,
    done: acts.filter((a) => a.status === 'done').length,
    late: acts.filter((a) => a.status === 'late' || a.status === 'blocked').length,
    risks: (content.risks ?? []).length,
    goLiveDone: GOLIVE_ITEMS.filter((k) => content.goLive?.[k]?.done).length,
    goLiveTotal: GOLIVE_ITEMS.length,
  };
}

// Conteúdo de um documento novo: a estrutura do modelo (sempre) + as linhas de exemplo (opcional)
export function newContent(kind, locale, withExamples = false) {
  const tpl = ddText(locale).templates[{ inventories: 'inventory', reports: 'report', plans: 'plan' }[kind]];
  return { ...clone(tpl.base), ...(withExamples ? clone(tpl.examples) : {}) };
}

// Ordem das atividades no cronograma: datas válidas, do início mais cedo ao mais tarde
export function timeline(activities = []) {
  const rows = activities
    .map((a, index) => ({ ...a, index, s: Date.parse(a.start), e: Date.parse(a.end) }))
    .filter((a) => Number.isFinite(a.s) && Number.isFinite(a.e) && a.e >= a.s);
  if (!rows.length) return { rows: [], min: null, max: null };
  const min = Math.min(...rows.map((r) => r.s));
  const max = Math.max(...rows.map((r) => r.e));
  const span = Math.max(max - min, 86_400_000);
  return {
    min,
    max,
    rows: rows.map((r) => ({ ...r, left: ((r.s - min) / span) * 100, width: Math.max(((r.e - r.s) / span) * 100, 1.5) })),
  };
}
