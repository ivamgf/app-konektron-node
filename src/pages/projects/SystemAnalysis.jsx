import { useState } from 'react';
import { resourceApi, systemAnalysisApi } from '../../api/endpoints.js';
import { FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { RequireType, useProject } from './ProjectLayout.jsx';
import { diagramConfig, requirementConfig, userStoryConfig } from './resources.jsx';

const base = (project) => `/projects/${project.id}/system-analysis`;

function CountTable({ title, counts, enumName }) {
  const { t } = useI18n();
  const entries = Object.entries(counts ?? {});
  return (
    <div className="col-md-6 col-xl-4">
      <h3 className="h4">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-body-secondary small">{t('common.empty')}</p>
      ) : (
        <table className="table table-sm">
          <tbody>
            {entries.map(([key, n]) => (
              <tr key={key}>
                <td>{t(`enums.${enumName}.${key}`)}</td>
                <td className="text-end fw-semibold">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Overview() {
  const { t } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => systemAnalysisApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const { analysis, counts } = data.data;
  return (
    <>
      <div className="row g-3 mb-4">
        {[
          ['requirements', counts.requirements.total],
          ['userStories', counts.userStories.total],
          ['diagrams', counts.diagrams.total],
        ].map(([key, n]) => (
          <div className="col-sm-4" key={key}>
            <div className="card kt-stat h-100">
              <div className="card-body">
                <div className="kt-stat-value">{n}</div>
                <div className="text-body-secondary">{t(`project.tabs.${key}`)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-4 mb-3">
        <CountTable title={`${t('project.tabs.requirements')} · ${t('sa.byType')}`} counts={counts.requirements.byType} enumName="requirementType" />
        <CountTable title={`${t('project.tabs.requirements')} · ${t('sa.byStatus')}`} counts={counts.requirements.byStatus} enumName="requirementStatus" />
        <CountTable title={`${t('project.tabs.userStories')} · ${t('sa.byStatus')}`} counts={counts.userStories.byStatus} enumName="storyStatus" />
      </div>
      <h3 className="h3">{t('sa.goal')}</h3>
      <p className="kt-prewrap">{analysis.goal ?? '—'}</p>
      <h3 className="h3">{t('sa.scope')}</h3>
      <p className="kt-prewrap mb-0">{analysis.scope ?? '—'}</p>
    </>
  );
}

const ANALYSIS_FIELDS = [
  { name: 'goal', label: 'sa.goal', type: 'textarea', rows: 3, maxLength: 10000 },
  { name: 'scope', label: 'sa.scope', type: 'textarea', rows: 4 },
  { name: 'technicalDescription', label: 'sa.technicalDescription', type: 'textarea', rows: 6 },
  { name: 'notes', label: 'sa.notes', type: 'textarea', rows: 3 },
];

function AnalysisForm({ initial, projectId }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState(() => toFormValues(ANALYSIS_FIELDS, initial));
  const { submit, busy, errors } = useSubmit((body) => systemAnalysisApi.updateAnalysis(projectId, body), {
    onSuccess: () => toast.success(t('common.saved')),
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(ANALYSIS_FIELDS, values, t)); }}>
      <FieldGrid fields={ANALYSIS_FIELDS} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
    </form>
  );
}

function Analysis() {
  const { project } = useProject();
  const data = useAsync(() => systemAnalysisApi.analysis(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  return data.data ? <AnalysisForm initial={data.data} projectId={project.id} /> : null;
}

function Requirements() {
  const { t } = useI18n();
  const { project } = useProject();
  return <ResourceManager path={`${base(project)}/requirements`} {...requirementConfig(t)} />;
}

function UserStories() {
  const { t } = useI18n();
  const { project } = useProject();
  // os requisitos alimentam o vínculo da história (RN9.1: só do mesmo projeto)
  const reqs = useAsync(() => resourceApi(`${base(project)}/requirements`).list(), [project.id]);
  if (reqs.loading && !reqs.data) return <Loading small />;
  return <ResourceManager path={`${base(project)}/user-stories`} {...userStoryConfig(t, reqs.data ?? [])} />;
}

function DiagramPreview({ diagram }) {
  const { t } = useI18n();
  if (!diagram.source && !diagram.url) return null;
  return (
    <div className="mb-3">
      <h4 className="h4">{diagram.title}</h4>
      {diagram.notation === 'image' && diagram.url ? (
        <img src={diagram.url} alt={diagram.title} className="img-fluid border" />
      ) : diagram.source ? (
        <pre className="kt-pre">{diagram.source}</pre>
      ) : (
        <a href={diagram.url} target="_blank" rel="noopener noreferrer">{t('common.open')}</a>
      )}
    </div>
  );
}

function Diagrams() {
  const { t } = useI18n();
  const { project } = useProject();
  return <ResourceManager path={`${base(project)}/diagrams`} {...diagramConfig(t)} />;
}

// Relatório completo (RF6 / RN9.2): a API devolve JSON e o app gera o PDF pela impressão
function Report() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => systemAnalysisApi.report(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const r = data.data;
  return (
    <article className="kt-report">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mt-0 border-0">{t('sa.reportTitle')}</h2>
          <p className="text-body-secondary mb-0">
            {r.project.name} · v{r.project.version} · {formatDate(r.generatedAt, locale)}
          </p>
        </div>
        <button type="button" className="btn btn-accent kt-no-print" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" aria-hidden="true" />{t('common.print')}
        </button>
      </div>

      <h2>{t('project.tabs.analysis')}</h2>
      {ANALYSIS_FIELDS.map((f) => (
        <section key={f.name}>
          <h3 className="h4">{t(f.label)}</h3>
          <p className="kt-prewrap">{r.analysis[f.name] ?? '—'}</p>
        </section>
      ))}

      <h2>{t('project.tabs.requirements')}</h2>
      {r.requirements.length === 0 ? <EmptyState>{t('common.empty')}</EmptyState> : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t('sa.code')}</th><th>{t('sa.title')}</th><th>{t('project.type')}</th>
              <th>{t('sa.priority')}</th><th>{t('common.status')}</th><th>{t('sa.traceability')}</th>
            </tr>
          </thead>
          <tbody>
            {r.requirements.map((q) => (
              <tr key={q.id}>
                <td className="fw-semibold">{q.code}</td>
                <td>{q.title}{q.description && <div className="small text-body-secondary kt-prewrap">{q.description}</div>}</td>
                <td>{t(`enums.requirementType.${q.type}`)}</td>
                <td>{q.priority ? t(`enums.priority.${q.priority}`) : '—'}</td>
                <td>{t(`enums.requirementStatus.${q.status}`)}</td>
                <td>{q.userStories.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{t('project.tabs.userStories')}</h2>
      {r.userStories.length === 0 ? <EmptyState>{t('common.empty')}</EmptyState> : r.userStories.map((s) => (
        <section key={s.id} className="mb-3">
          <h3 className="h4">{s.code} — {s.title}</h3>
          <p className="mb-1">
            <strong>{t('sa.asA')}</strong> {s.asA}, <strong>{t('sa.iWant')}</strong> {s.iWant}
            {s.soThat && <>, <strong>{t('sa.soThat')}</strong> {s.soThat}</>}.
          </p>
          {s.acceptanceCriteria && <p className="small kt-prewrap mb-1">{s.acceptanceCriteria}</p>}
          <p className="small text-body-secondary">
            {t('common.status')}: {t(`enums.storyStatus.${s.status}`)}
            {s.storyPoints != null && ` · ${t('sa.storyPoints')}: ${s.storyPoints}`}
          </p>
        </section>
      ))}

      <h2>{t('project.tabs.diagrams')}</h2>
      {r.diagrams.length === 0 ? <EmptyState>{t('common.empty')}</EmptyState> : r.diagrams.map((d) => <DiagramPreview key={d.id} diagram={d} />)}
    </article>
  );
}

const only = (Component) =>
  function SoftwareOnly() {
    return <RequireType type="software"><Component /></RequireType>;
  };

export const SaOverview = Overview;
export const SaAnalysis = only(Analysis);
export const SaRequirements = only(Requirements);
export const SaUserStories = only(UserStories);
export const SaDiagrams = only(Diagrams);
export const SaReport = only(Report);
