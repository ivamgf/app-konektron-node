import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DD_ENUMS, DD_TEXT, MATURITY_DIMENSIONS } from '../content/dataDiagnosis.js';
import {
  consolidatedScore, inventoryStats, levelFromPercent, maturityGaps, maturitySuggestions, newContent, planStats, qualityAverage,
  reportIndicators, timeline,
} from '../lib/dataDiagnosis.js';
import { RowsEditor } from '../components/sections.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

// Estrutura de um objeto: chaves aninhadas e tamanho das listas de texto (rubricas, níveis)
const shape = (v, prefix = '') => {
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string') ? [`${prefix}[${v.length}]`] : [`${prefix}[]`];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => shape(x, `${prefix}${k}.`));
  return [prefix.slice(0, -1)];
};

describe('conteúdo do diagnóstico de dados', () => {
  it('pt-BR, en e es têm a mesma estrutura (fora os exemplos)', () => {
    const strip = ({ templates: _templates, ...rest }) => rest;
    for (const code of ['en', 'es']) expect(shape(strip(DD_TEXT[code])).sort()).toEqual(shape(strip(DD_TEXT['pt-BR'])).sort());
  });

  it('todas as opções das listas têm rótulo nos três idiomas', () => {
    for (const text of Object.values(DD_TEXT)) {
      for (const [name, values] of Object.entries(DD_ENUMS)) {
        for (const v of values) expect(text.options[name][v], `${name}.${v}`).toBeTruthy();
      }
    }
  });

  it('rubrica completa: 5 níveis descritos para cada uma das 5 dimensões', () => {
    for (const text of Object.values(DD_TEXT)) {
      expect(text.maturity.levels).toHaveLength(5);
      for (const dim of MATURITY_DIMENSIONS) expect(text.maturity.dimensions[dim].rubric).toHaveLength(5);
    }
    expect(DD_TEXT['pt-BR'].maturity.levels).toEqual(['Inicial', 'Repetível', 'Definido', 'Gerenciado', 'Otimizado']);
  });
});

describe('cálculos do relatório', () => {
  const content = {
    sources: [
      { code: 'F01', ownerArea: 'Fin', technicalOwner: 'Ana', personalData: 'yes', documented: 'yes' },
      { code: 'F02', ownerArea: 'Com', technicalOwner: '', personalData: 'no' },
    ],
    flows: [
      { code: 'FL01', origin: 'F01', destination: 'DW', method: 'etl', monitored: 'yes' },
      { code: 'FL02', origin: 'F02', destination: 'DW', method: 'manual', monitored: 'no' },
      { code: 'FL03', origin: 'F01', destination: 'BI', method: 'api', monitored: 'yes' },
      { code: 'FL04', origin: 'F01', destination: 'CRM', method: 'replication' },
    ],
    quality: [{ completeness: 3, accuracy: 4 }, { completeness: 2, validity: null }],
    governance: { roles: { done: true }, backup: { done: true }, retention: { done: true } },
    problems: [{ severity: 'high' }, { severity: 'low' }],
  };

  it('indicadores objetivos', () => {
    const i = reportIndicators(content);
    expect(i).toMatchObject({ sources: 2, flows: 4, manualFlows: 1, manualPct: 25, automatedPct: 75, monitoredPct: 50, ownedPct: 50, personalData: 1, criticalProblems: 1, governanceDone: 3 });
    expect(qualityAverage(content.quality)).toBe(3);
  });

  it('régua de percentuais: 25/50/75 e acima de 90% com o critério extra', () => {
    expect([0, 25, 26, 50, 51, 75, 76, 95].map((p) => levelFromPercent(p))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(levelFromPercent(95, true)).toBe(5);
    expect(levelFromPercent(90, true)).toBe(4);
  });

  it('sugere um nível por dimensão quando há dados; uso não tem indicador', () => {
    expect(maturitySuggestions(content)).toEqual({ sources: 2, flows: 3, quality: 3, governance: 2, usage: null });
    const all = Object.fromEntries(['roles', 'dictionary', 'accessPolicies', 'encryption', 'auditTrail', 'backup', 'retention'].map((k) => [k, { done: true }]));
    expect(maturitySuggestions({ governance: all }).governance).toBe(5);
    expect(maturitySuggestions({})).toEqual({ sources: null, flows: null, quality: null, governance: null, usage: null });
  });

  it('nota consolidada = média ponderada das dimensões avaliadas', () => {
    expect(consolidatedScore({})).toBeNull();
    expect(consolidatedScore({ sources: { level: 2 }, flows: { level: 4, weight: 3 }, usage: { level: null } })).toBe(3.5);
    expect(consolidatedScore({ quality: { level: 3, weight: 0 }, flows: { level: 1 } })).toBe(1);
  });

  it('lacunas atual → alvo, da maior para a menor', () => {
    expect(maturityGaps({ sources: { level: 1, target: 3 }, flows: { level: 2, target: 3 }, quality: { level: 4, target: 3 } })).toEqual([
      { dimension: 'sources', from: 1, to: 3, gap: 2 },
      { dimension: 'flows', from: 2, to: 3, gap: 1 },
    ]);
  });
});

describe('modelos e resumos', () => {
  it('plano novo já vem com as 13 atividades, RACI, riscos e aprovações do modelo', () => {
    const c = newContent('plans', 'pt-BR');
    expect(c.activities).toHaveLength(13);
    expect(c.raci).toHaveLength(7);
    expect(c.risks.map((r) => r.code)).toEqual(['R01', 'R02', 'R03', 'R04']);
    expect(c.approvals).toHaveLength(3);
    expect(Object.keys(c.phases)).toEqual(DD_ENUMS.phases);
  });

  it('exemplos só quando pedidos; o modelo não é alterado pelo documento', () => {
    expect(newContent('reports', 'en').sources).toBeUndefined();
    const withExamples = newContent('reports', 'en', true);
    expect(withExamples.sources.map((s) => s.code)).toEqual(['F01', 'F02']);
    withExamples.sources.push({});
    expect(newContent('reports', 'en', true).sources).toHaveLength(2);
  });

  it('estatísticas do inventário e do plano', () => {
    const inv = newContent('inventories', 'pt-BR', true);
    expect(inventoryStats(inv)).toMatchObject({ systems: 1, databases: 2, integrations: 2, manual: 1, noBackup: 1, pending: 1 });
    const plan = newContent('plans', 'pt-BR');
    plan.activities[0].status = 'done';
    plan.activities[1].status = 'blocked';
    plan.goLive = { rollback: { done: true } };
    expect(planStats(plan)).toMatchObject({ activities: 13, done: 1, late: 1, risks: 4, goLiveDone: 1, goLiveTotal: 9 });
  });

  it('cronograma ignora datas inválidas e posiciona as barras em %', () => {
    const tl = timeline([
      { code: '1', start: '2026-01-01', end: '2026-01-11' },
      { code: '2', start: '2026-01-11', end: '2026-01-21' },
      { code: '3', start: '2026-02-01', end: '2026-01-01' },
      { code: '4', start: '', end: '' },
    ]);
    expect(tl.rows.map((r) => r.code)).toEqual(['1', '2']);
    expect(tl.rows[1].left).toBe(50);
    expect(tl.rows[0].width).toBe(50);
  });
});

describe('RowsEditor com os tipos novos', () => {
  it('nota 1 a 5 vira número, coluna calculada não é editável e linhas novas nascem vazias', () => {
    let rows = [{ name: 'F01', score: null }];
    const columns = [
      { name: 'name', label: 'Fonte' },
      { name: 'score', label: 'Nota', type: 'score' },
      { name: 'when', label: 'Data', type: 'date' },
      { name: 'calc', label: 'Calc', render: (r) => `= ${r.score ?? '—'}` },
    ];
    const ui = () => (
      <I18nProvider>
        <RowsEditor caption="Tabela" columns={columns} rows={rows} onChange={(v) => { rows = v; }} addLabel="Adicionar" />
      </I18nProvider>
    );
    const { rerender } = render(ui());
    fireEvent.change(screen.getByLabelText('Nota 1'), { target: { value: '4' } });
    expect(rows[0].score).toBe(4);
    rerender(ui());
    expect(within(screen.getByRole('table')).getByText('= 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(rows[1]).toEqual({ name: '', score: null, when: '' });
  });
});
