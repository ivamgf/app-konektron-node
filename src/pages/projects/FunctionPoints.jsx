// Pontos de Função (IFPUG): contagens com funções de dados (ALI/AIE) e de transação (EE/SE/CE).
// As tabelas seguem as planilhas "Tipo de Contagem", "Determinação do Escopo", "Complexidade" e "Contribuição".
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { fpApi, resourceApi } from '../../api/endpoints.js';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { EditForm, SectionLayout, StatCards } from '../../components/sections.jsx';
import { Loading } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync } from '../../lib/hooks.js';
import { RequireType, useProject } from './ProjectLayout.jsx';
import { badge, opts } from './resources.jsx';

const base = (project) => `/projects/${project.id}/function-points`;
const TYPES = ['ilf', 'eif', 'ei', 'eo', 'eq'];
const COMPLEXITIES = ['low', 'average', 'high'];
// Tabela de contribuição (IFPUG), igual à da API
const WEIGHTS = {
  ilf: { low: 7, average: 10, high: 15 },
  eif: { low: 5, average: 7, high: 10 },
  ei: { low: 3, average: 4, high: 6 },
  eo: { low: 4, average: 5, high: 7 },
  eq: { low: 3, average: 4, high: 6 },
};
// Tabelas de complexidade: faixas das linhas (TR/ALR) e colunas (TD)
const MATRICES = [
  { key: 'matrixTitle', rowLabel: 'TR', rows: ['1', '2-5', '>5'], cols: ['<20', '20-50', '>50'] },
  { key: 'matrixEi', rowLabel: 'ALR', rows: ['0-1', '2', '>2'], cols: ['1-4', '5-15', '>15'] },
  { key: 'matrixEoEq', rowLabel: 'ALR', rows: ['0-1', '2-3', '>3'], cols: ['1-5', '6-19', '>19'] },
];
const MATRIX = [
  ['low', 'low', 'average'],
  ['low', 'average', 'high'],
  ['average', 'high', 'high'],
];
const CX_BADGE = { low: 'text-bg-success', average: 'text-bg-warning', high: 'text-bg-danger' };

function Layout() {
  const { project } = useProject();
  return (
    <RequireType type="software">
      <SectionLayout section="function-point" base={base(project)} />
    </RequireType>
  );
}

function countFields(t) {
  return [
    { name: 'name', label: 'fp.name', required: true, maxLength: 200, col: 'col-md-8' },
    { name: 'countType', label: 'fp.countType', type: 'select', required: true, options: opts(t, 'fpCountType'), default: 'development', col: 'col-md-4' },
    { name: 'counter', label: 'fp.counter', maxLength: 200, col: 'col-md-8' },
    { name: 'countedAt', label: 'fp.countedAt', type: 'date', col: 'col-md-4' },
    { name: 'purpose', label: 'fp.purpose', type: 'textarea', rows: 2, maxLength: 5000 },
    { name: 'scope', label: 'fp.scope', type: 'textarea', rows: 3, maxLength: 10000 },
    { name: 'hoursPerFp', label: 'fp.hoursPerFp', type: 'number', min: 0, step: '0.5', col: 'col-md-4' },
    { name: 'costPerHour', label: 'fp.costPerHour', type: 'number', min: 0, step: '0.01', col: 'col-md-4' },
    { name: 'currency', label: 'fp.currency', maxLength: 3, default: 'BRL', col: 'col-md-4' },
    { name: 'notes', label: 'sa.notes', type: 'textarea', rows: 2, maxLength: 10000 },
  ];
}

// Tabelas de referência do IFPUG (complexidade e contribuição)
function ReferenceTables() {
  const { t } = useI18n();
  return (
    <details className="kt-fp-ref mt-4">
      <summary className="fw-semibold">{t('fp.references')}</summary>
      <div className="row g-3 mt-1">
        {MATRICES.map((m) => (
          <div className="col-lg-4" key={m.key}>
            <table className="table table-bordered table-sm kt-sheet is-blue mb-0">
              <thead>
                <tr className="kt-sheet-title"><th colSpan={4}>{t(`fp.${m.key}`)}</th></tr>
                <tr><th scope="col">{m.rowLabel} \ TD</th>{m.cols.map((c) => <th scope="col" key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {m.rows.map((r, i) => (
                  <tr key={r}>
                    <th scope="row">{r}</th>
                    {MATRIX[i].map((cx, j) => <td key={j}>{t(`enums.complexity.${cx}`)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </details>
  );
}

function Counts() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const overview = useAsync(() => fpApi.overview(project.id), [project.id, version]);
  const totals = Object.fromEntries((overview.data ?? []).map((c) => [c.id, c]));
  const all = overview.data ?? [];
  return (
    <>
      <p className="text-body-secondary">{t('fp.intro')}</p>
      <StatCards items={[
        [t('fp.counts'), all.length, 'calculator'],
        [t('fp.functions'), all.reduce((n, c) => n + c.functions, 0), 'list-check'],
        [t('fp.totalPoints'), all.reduce((n, c) => n + c.totalPoints, 0), 'speedometer2'],
      ]} />
      <p className="small text-body-secondary">{t('fp.createHint')}</p>
      <ResourceManager
        path={`${base(project)}/counts`}
        singular="fp.count"
        fields={countFields(t).filter((f) => ['name', 'countType', 'counter', 'countedAt', 'purpose'].includes(f.name))}
        columns={[
          { key: 'name', label: 'fp.name' },
          { key: 'countType', label: 'fp.countType', render: (r) => t(`enums.fpCountType.${r.countType}`) },
          { key: 'functions', label: 'fp.functions', render: (r) => totals[r.id]?.functions ?? 0 },
          { key: 'totalPoints', label: 'fp.totalPoints', render: (r) => <strong>{totals[r.id]?.totalPoints ?? 0}</strong> },
          { key: 'countedAt', label: 'fp.countedAt', render: (r) => (r.countedAt ? formatDate(r.countedAt, locale) : '—') },
        ]}
        rowLink={(r) => `${base(project)}/${r.id}`}
        onChange={() => setVersion((v) => v + 1)}
        afterCreate={(row) => navigate(`${base(project)}/${row.id}`)}
      />
      <ReferenceTables />
    </>
  );
}

// Planilha no estilo dos modelos (cabeçalho azul)
function Sheet({ title, head, children, foot }) {
  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm kt-sheet is-blue mb-0">
        <thead>
          <tr className="kt-sheet-title"><th colSpan={head.length}>{title}</th></tr>
          <tr>{head.map((h, i) => <th scope="col" key={i} className={i === 0 ? 'kt-sheet-n' : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  );
}

function money(value, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'BRL' }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function Summary({ count, summary }) {
  const { t, locale } = useI18n();
  const short = (type) => t(`enums.fpTypeShort.${type}`);
  const nf = (n) => Number(n).toLocaleString(locale);
  return (
    <div className="row g-4 mb-4">
      <div className="col-lg-6">
        <Sheet title={t('fp.scopeTitle')} head={['Nº', t('fp.type'), t('fp.functions')]}>
          <tr><td className="kt-sheet-n">1</td><td>{t('enums.fpType.ilf')}</td><td className="text-end">{summary.scope.ilf}</td></tr>
          <tr><td className="kt-sheet-n">2</td><td>{t('enums.fpType.eif')}</td><td className="text-end">{summary.scope.eif}</td></tr>
          <tr className="fw-bold"><td className="kt-sheet-n">3</td><td>{t('fp.scopeTotal')}</td><td className="text-end">{summary.scope.total}</td></tr>
        </Sheet>
        <p className="small text-body-secondary mt-2 mb-1">{t('fp.obsAli')}</p>
        <p className="small text-body-secondary mb-0">{t('fp.obsAie')}</p>
      </div>
      <div className="col-lg-6">
        <Sheet title={t('fp.complexityTitle')} head={['Nº', t('fp.type'), t('fp.functions')]}>
          <tr><td className="kt-sheet-n">1</td><td>{t('fp.detTotal')}</td><td className="text-end">{summary.complexity.det}</td></tr>
          <tr><td className="kt-sheet-n">2</td><td>{t('fp.retTotal')}</td><td className="text-end">{summary.complexity.ret}</td></tr>
          <tr className="fw-bold"><td className="kt-sheet-n">3</td><td>{t('fp.complexityTotal')}</td><td className="text-end">{summary.complexity.total}</td></tr>
        </Sheet>
        <p className="small text-body-secondary mt-2 mb-1">{t('fp.obsComplexity')}</p>
        <p className="small text-body-secondary mb-0">{t('fp.detHelp')}</p>
      </div>
      <div className="col-12">
        <Sheet
          title={t('fp.contributionTitle')}
          head={['Nº', t('fp.type'), ...COMPLEXITIES.map((c) => t(`enums.complexity.${c}`)), t('fp.points')]}
          foot={
            <>
              <tr><td /><td colSpan={4}>{t('fp.dataPoints')}</td><td className="text-end">{summary.dataPoints}</td></tr>
              <tr><td /><td colSpan={4}>{t('fp.transactionPoints')}</td><td className="text-end">{summary.transactionPoints}</td></tr>
              <tr className="fw-bold kt-fp-total"><td /><td colSpan={4}>{t('fp.totalPoints')}</td><td className="text-end">{summary.totalPoints}</td></tr>
            </>
          }
        >
          {TYPES.map((type, i) => {
            const row = summary.contribution[type];
            return (
              <tr key={type}>
                <td className="kt-sheet-n">{i + 1}</td>
                <th scope="row">{short(type)}</th>
                {COMPLEXITIES.map((cx) => (
                  <td key={cx}>
                    <span className="text-body-secondary">{row[cx]} × {WEIGHTS[type][cx]} =</span> <strong>{row[cx] * WEIGHTS[type][cx]}</strong>
                  </td>
                ))}
                <td className="text-end fw-semibold">{row.points}</td>
              </tr>
            );
          })}
        </Sheet>
        <p className="small text-body-secondary mt-2 mb-0">{t('fp.obsPf')}</p>
      </div>
      {summary.byAction && (
        <div className="col-md-6">
          <section className="kt-count-panel">
            <h3>{t('fp.byAction')}</h3>
            <table className="table table-sm">
              <tbody>
                {Object.entries(summary.byAction).map(([a, n]) => (
                  <tr key={a}><td>{t(`enums.fpAction.${a}`)}</td><td className="text-end fw-semibold">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
      <div className="col-md-6">
        <section className="kt-count-panel" style={{ '--acc': '#6f42c1' }}>
          <h3>{t('fp.estimate')}</h3>
          {summary.estimate.effortHours == null ? (
            <p className="small text-body-secondary">{t('fp.estimateHint')}</p>
          ) : (
            <table className="table table-sm">
              <tbody>
                <tr><td>{t('fp.effort')}</td><td className="text-end fw-semibold">{t('fp.hours', { n: nf(summary.estimate.effortHours) })}</td></tr>
                {summary.estimate.cost != null && (
                  <tr><td>{t('fp.cost')}</td><td className="text-end fw-semibold">{money(summary.estimate.cost, count.currency, locale)}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function functionFields(t, enhancement) {
  return [
    { name: 'name', label: 'fp.functionName', required: true, maxLength: 200, col: 'col-md-8' },
    { name: 'type', label: 'fp.type', type: 'select', required: true, options: opts(t, 'fpType'), default: 'ilf', col: 'col-md-4' },
    { name: 'det', label: 'fp.det', type: 'integer', required: true, min: 0, help: 'fp.detHelp', col: 'col-md-6' },
    { name: 'retFtr', label: 'fp.retFtr', type: 'integer', required: true, min: 0, help: 'fp.retFtrHelp', col: 'col-md-6' },
    ...(enhancement ? [{ name: 'action', label: 'fp.action', type: 'select', options: opts(t, 'fpAction'), col: 'col-md-6' }] : []),
    { name: 'description', label: 'project.description', type: 'textarea', rows: 2, maxLength: 5000 },
  ];
}

function CountDetail() {
  const { t } = useI18n();
  const { project } = useProject();
  const { countId } = useParams();
  const api = useMemo(() => resourceApi(`${base(project)}/counts`), [project]);
  const data = useAsync(() => fpApi.summary(project.id, countId), [project.id, countId]);
  useCrumbLabel('fpCount', data.data?.count.name);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const { count, summary } = data.data;
  const enhancement = count.countType === 'enhancement';
  return (
    <article>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h3 className="h2 mb-1">{count.name}</h3>
          {badge(t(`enums.fpCountType.${count.countType}`))}
        </div>
        <div className="kt-fp-big" aria-label={`${t('fp.totalPoints')}: ${summary.totalPoints}`}>
          <span>{summary.totalPoints}</span> {t('fp.points')}
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <Sheet title={t('fp.typeTitle')} head={['Nº', t('fp.type'), t('fp.selected')]}>
            {['development', 'enhancement', 'application'].map((type, i) => (
              <tr key={type} className={count.countType === type ? 'table-active fw-semibold' : undefined}>
                <td className="kt-sheet-n">{i + 1}</td>
                <td>{t(`enums.fpCountType.${type}`)}</td>
                <td className="text-center">{count.countType === type ? <i className="bi bi-check-lg text-success" aria-label={t('fp.selected')} /> : ''}</td>
              </tr>
            ))}
          </Sheet>
        </div>
        <div className="col-lg-8">
          <details className="card">
            <summary className="card-header fw-semibold">{t('fp.count')}: {t('common.details')}</summary>
            <div className="card-body">
              <EditForm fields={countFields(t)} initial={count} onSave={(body) => api.update(count.id, body)} onSaved={() => data.reload()} />
            </div>
          </details>
        </div>
      </div>

      <h4 className="h3">{t('fp.functions')}</h4>
      <ResourceManager
        path={`${base(project)}/counts/${count.id}/functions`}
        singular="fp.function"
        fields={functionFields(t, enhancement)}
        columns={[
          { key: 'name', label: 'fp.functionName' },
          { key: 'type', label: 'fp.type', render: (r) => <span title={t(`enums.fpType.${r.type}`)}>{t(`enums.fpTypeShort.${r.type}`)}</span> },
          { key: 'det', label: 'fp.det' },
          { key: 'retFtr', label: 'fp.retFtr' },
          { key: 'complexity', label: 'fp.complexity', render: (r) => badge(t(`enums.complexity.${r.complexity}`), CX_BADGE[r.complexity]) },
          { key: 'points', label: 'fp.points', render: (r) => <strong>{r.points}</strong> },
          ...(enhancement ? [{ key: 'action', label: 'fp.action', render: (r) => (r.action ? t(`enums.fpAction.${r.action}`) : '—') }] : []),
        ]}
        filters={[
          { name: 'type', label: 'fp.type', options: opts(t, 'fpType') },
          { name: 'complexity', label: 'fp.complexity', options: opts(t, 'complexity') },
        ]}
        nameOf={(r) => r.name}
        onChange={() => data.reload()}
      />

      <h4 className="h3 mt-4">{t('fp.totalPoints')}</h4>
      {summary.totalPoints === 0 && <p className="text-body-secondary">{t('fp.noFunctions')}</p>}
      <Summary count={count} summary={summary} />
      <ReferenceTables />
    </article>
  );
}

export const FpLayout = Layout;
export const FpCounts = Counts;
export const FpCountDetail = CountDetail;
