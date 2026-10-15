import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { crispdmApi, resourceApi } from '../../api/endpoints.js';
import { enumOptions } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { sameValues, SaveButton, saveShortcut, useUnsavedChanges } from '../../components/unsaved.jsx';
import { EmptyState, Loading } from '../../components/ui.jsx';
import { taskLabel } from '../../content/crispdm.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { RequireType, useProject } from './ProjectLayout.jsx';
import { datasetConfig, ENUMS, fieldConfig, metricConfig, modelConfig, objectiveConfig, preparationConfig } from './resources.jsx';

const base = (project) => `/projects/${project.id}/crisp-dm`;
const phaseName = (phase, locale) => phase.label?.[locale] ?? phase.label?.en ?? phase.phase;
const STATUS_BADGE = { not_started: 'text-bg-light border', in_progress: 'text-bg-warning', completed: 'text-bg-success' };

function Overview() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => crispdmApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const o = data.data;
  const current = o.phases.find((p) => p.phase === o.currentPhase);
  return (
    <>
      <div className="row g-4 align-items-center mb-4">
        <div className="col-md-6">
          <div className="d-flex justify-content-between mb-1">
            <span className="fw-semibold">{t('dm.progress')}</span>
            <span className="fw-bold">{o.progress}%</span>
          </div>
          <div className="progress kt-progress" role="progressbar" aria-valuenow={o.progress} aria-valuemin={0} aria-valuemax={100}
            aria-label={t('dm.progress')}>
            <div className="progress-bar" style={{ width: `${o.progress}%` }} />
          </div>
        </div>
        <div className="col-md-6">
          <span className="text-body-secondary">{t('dm.currentPhase')}: </span>
          <strong>{current ? phaseName(current, locale) : t('dm.noCurrent')}</strong>
        </div>
      </div>
      <ol className="list-group list-group-numbered mb-4">
        {o.phases.map((p) => (
          <li key={p.phase} className={`list-group-item kt-phase is-${p.status} d-flex justify-content-between align-items-center gap-3`}>
            <div className="ms-2 me-auto">
              <Link to={`/projects/${project.id}/phases#${p.phase}`} className="fw-semibold">
                {phaseName(p, locale)}
              </Link>
              {p.startedAt && (
                <div className="small text-body-secondary">
                  {t('dm.startedAt')}: {formatDate(p.startedAt, locale)}
                  {p.completedAt && ` · ${t('dm.completedAt')}: ${formatDate(p.completedAt, locale)}`}
                </div>
              )}
            </div>
            <span className={`badge ${STATUS_BADGE[p.status]}`}>{t(`enums.phaseStatus.${p.status}`)}</span>
          </li>
        ))}
      </ol>
      <div className="row g-3">
        {Object.entries(o.counts).map(([key, n]) => (
          <div className="col-6 col-md" key={key}>
            <div className="card kt-stat h-100">
              <div className="card-body py-2">
                <div className="kt-stat-value">{n}</div>
                <div className="small text-body-secondary">{t(`dm.counts.${key}`)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PhaseCard({ projectId, phase, onSaved }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const initialContent = Object.fromEntries(phase.tasks.map((k) => [k, phase.content?.[k] ?? '']));
  const [status, setStatus] = useState(phase.status);
  const [notes, setNotes] = useState(phase.notes ?? '');
  const [content, setContent] = useState(initialContent);
  const { submit, busy, errors } = useSubmit((body) => crispdmApi.updatePhase(projectId, phase.phase, body), {
    onSuccess: (updated) => {
      toast.success(t('common.saved'));
      onSaved(updated);
    },
  });

  const dirty = status !== phase.status || notes !== (phase.notes ?? '') || !sameValues(content, initialContent);
  useUnsavedChanges(dirty);

  const save = (e) => {
    e.preventDefault();
    // RN10.1: a API faz merge — envia só as tarefas alteradas ('' apaga com null)
    const changed = Object.fromEntries(
      Object.entries(content)
        .filter(([k, v]) => v !== initialContent[k])
        .map(([k, v]) => [k, v === '' ? null : v]),
    );
    const body = {};
    if (status !== phase.status) body.status = status;
    if (notes !== (phase.notes ?? '')) body.notes = notes === '' ? null : notes;
    if (Object.keys(changed).length) body.content = changed;
    if (!Object.keys(body).length) return toast.success(t('common.saved'));
    submit(body);
  };

  return (
    <section className="card mb-4" id={phase.phase} aria-labelledby={`${phase.phase}-title`}>
      <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h3 className="h3 mb-0" id={`${phase.phase}-title`}>{phase.order}. {phaseName(phase, locale)}</h3>
        <span className={`badge ${STATUS_BADGE[phase.status]}`}>{t(`enums.phaseStatus.${phase.status}`)}</span>
      </div>
      <form className="card-body" onSubmit={save} onKeyDown={saveShortcut} noValidate>
        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label fw-semibold" htmlFor={`${phase.phase}-status`}>{t('common.status')}</label>
            <select id={`${phase.phase}-status`} className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {enumOptions(t, 'phaseStatus', ENUMS.phaseStatus).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-md-8 mb-3 small text-body-secondary align-self-end">
            {phase.startedAt && `${t('dm.startedAt')}: ${formatDate(phase.startedAt, locale)}`}
            {phase.completedAt && ` · ${t('dm.completedAt')}: ${formatDate(phase.completedAt, locale)}`}
          </div>
        </div>
        <h4 className="h4">{t('dm.tasks')}</h4>
        <div className="row">
          {phase.tasks.map((task) => (
            <div className="col-lg-6 mb-3" key={task}>
              <label className="form-label fw-semibold" htmlFor={`${phase.phase}-${task}`}>{taskLabel(locale, task)}</label>
              {task === 'decision' ? (
                <select id={`${phase.phase}-${task}`} className="form-select" value={content[task]}
                  onChange={(e) => setContent((c) => ({ ...c, [task]: e.target.value }))}>
                  <option value="">{t('common.none')}</option>
                  {enumOptions(t, 'decision', ENUMS.decision).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <textarea id={`${phase.phase}-${task}`} className="form-control" rows={3} value={content[task]}
                  onChange={(e) => setContent((c) => ({ ...c, [task]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <label className="form-label fw-semibold" htmlFor={`${phase.phase}-notes`}>{t('sa.notes')}</label>
        <textarea id={`${phase.phase}-notes`} className="form-control mb-3" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {errors.content && <div className="text-danger small mb-2">{String(errors.content)}</div>}
        <SaveButton busy={busy} dirty={dirty} />
      </form>
    </section>
  );
}

function Phases() {
  const { project } = useProject();
  const phases = useAsync(() => crispdmApi.phases(project.id), [project.id]);
  if (phases.loading && !phases.data) return <Loading small />;
  const replace = (updated) => phases.setData(phases.data.map((p) => (p.phase === updated.phase ? updated : p)));
  return (phases.data ?? []).map((p) => (
    <PhaseCard key={`${p.phase}-${p.updatedAt}`} projectId={project.id} phase={p} onSaved={replace} />
  ));
}

function Objectives() {
  const { t } = useI18n();
  const { project } = useProject();
  return <ResourceManager path={`${base(project)}/objectives`} {...objectiveConfig(t)} />;
}

function Datasets() {
  const { t } = useI18n();
  const { project } = useProject();
  return (
    <ResourceManager path={`${base(project)}/datasets`} {...datasetConfig(t)}
      rowLink={(row) => `/projects/${project.id}/datasets/${row.id}`} />
  );
}

function Detail({ rows }) {
  return (
    <dl className="row mb-4">
      {rows.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
        <div className="col-md-6 col-xl-4 mb-2" key={label}>
          <dt className="small text-body-secondary">{label}</dt>
          <dd className="mb-0 kt-prewrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DatasetDetail() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const { datasetId } = useParams();
  const ds = useAsync(() => resourceApi(`${base(project)}/datasets`).get(datasetId), [datasetId]);
  useCrumbLabel('dataset', ds.data?.name);
  if (ds.loading && !ds.data) return <Loading small />;
  if (!ds.data) return <EmptyState>{t('errors.notFoundTitle')}</EmptyState>;
  const d = ds.data;
  return (
    <>
      <h2 className="h2">{d.name}</h2>
      <Detail rows={[
        [t('dm.source'), d.source], [t('dm.format'), d.format], [t('dm.location'), d.location],
        [t('dm.rowCount'), d.rowCount?.toLocaleString()], [t('dm.columnCount'), d.columnCount],
        [t('dm.sizeBytes'), d.sizeBytes?.toLocaleString()], [t('dm.collectedAt'), d.collectedAt && formatDate(d.collectedAt, locale)],
        [t('project.description'), d.description], [t('dm.qualityNotes'), d.qualityNotes],
      ]} />
      <h3 className="h3">{t('dm.fields')}</h3>
      <ResourceManager path={`${base(project)}/datasets/${d.id}/fields`} {...fieldConfig(t)} />
    </>
  );
}

function Preparation() {
  const { t } = useI18n();
  const { project } = useProject();
  const datasets = useAsync(() => resourceApi(`${base(project)}/datasets`).list(), [project.id]);
  if (datasets.loading && !datasets.data) return <Loading small />;
  return <ResourceManager path={`${base(project)}/preparation-steps`} {...preparationConfig(t, datasets.data ?? [])} />;
}

function Models() {
  const { t } = useI18n();
  const { project } = useProject();
  const datasets = useAsync(() => resourceApi(`${base(project)}/datasets`).list(), [project.id]);
  if (datasets.loading && !datasets.data) return <Loading small />;
  return (
    <ResourceManager path={`${base(project)}/models`} {...modelConfig(t, datasets.data ?? [])}
      rowLink={(row) => `/projects/${project.id}/models/${row.id}`} />
  );
}

function ModelDetail() {
  const { t } = useI18n();
  const { project } = useProject();
  const { modelId } = useParams();
  const model = useAsync(() => resourceApi(`${base(project)}/models`).get(modelId), [modelId]);
  useCrumbLabel('model', model.data?.name);
  if (model.loading && !model.data) return <Loading small />;
  if (!model.data) return <EmptyState>{t('errors.notFoundTitle')}</EmptyState>;
  const m = model.data;
  return (
    <>
      <h2 className="h2">{m.name}</h2>
      <Detail rows={[
        [t('dm.technique'), t(`enums.technique.${m.technique}`)], [t('dm.algorithm'), m.algorithm],
        [t('common.status'), t(`enums.modelStatus.${m.status}`)], [t('dm.artifactUri'), m.artifactUri],
        [t('dm.assumptions'), m.assumptions], [t('sa.notes'), m.notes],
      ]} />
      {m.hyperparameters && (
        <>
          <h3 className="h4">{t('dm.hyperparameters')}</h3>
          <pre className="kt-pre mb-4">{JSON.stringify(m.hyperparameters, null, 2)}</pre>
        </>
      )}
      <h3 className="h3">{t('dm.metrics')}</h3>
      <ResourceManager path={`${base(project)}/models/${m.id}/metrics`} {...metricConfig(t)} />
    </>
  );
}

function Report() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => crispdmApi.report(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const r = data.data;
  return (
    <article className="kt-report">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mt-0 border-0">{t('dm.reportTitle')}</h2>
          <p className="text-body-secondary mb-0">{r.project.name} · v{r.project.version} · {formatDate(r.generatedAt, locale)}</p>
        </div>
        <button type="button" className="btn btn-accent kt-no-print" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" aria-hidden="true" />{t('common.print')}
        </button>
      </div>

      {r.phases.map((p) => (
        <section key={p.phase}>
          <h2>{p.order}. {phaseName(p, locale)} <small className="fs-6 fw-normal">({t(`enums.phaseStatus.${p.status}`)})</small></h2>
          {p.tasks.filter((k) => p.content?.[k]).map((k) => (
            <div key={k} className="mb-2">
              <h3 className="h4 mb-1">{taskLabel(locale, k)}</h3>
              <p className="kt-prewrap mb-0">{k === 'decision' ? t(`enums.decision.${p.content[k]}`) : p.content[k]}</p>
            </div>
          ))}
          {p.notes && <p className="small kt-prewrap"><strong>{t('sa.notes')}:</strong> {p.notes}</p>}

          {p.phase === 'business_understanding' && r.objectives.length > 0 && (
            <table className="table table-sm mt-2">
              <thead><tr><th>{t('dm.objectiveType')}</th><th>{t('project.description')}</th><th>{t('dm.successCriteria')}</th><th>{t('dm.achieved')}</th></tr></thead>
              <tbody>
                {r.objectives.map((o) => (
                  <tr key={o.id}>
                    <td>{t(`enums.objectiveType.${o.type}`)}</td><td>{o.description}</td><td>{o.successCriteria ?? '—'}</td>
                    <td>{o.achieved == null ? '—' : t(o.achieved ? 'common.yes' : 'common.no')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {p.phase === 'data_understanding' && r.datasets.map((d) => (
            <div key={d.id} className="mt-2">
              <h3 className="h4">{d.name} <small className="fw-normal text-body-secondary">{[d.source, d.format].filter(Boolean).join(' · ')}</small></h3>
              {d.fields.length > 0 && (
                <table className="table table-sm">
                  <thead><tr><th>{t('dm.fieldName')}</th><th>{t('dm.dataType')}</th><th>{t('dm.role')}</th><th>{t('dm.missingPct')}</th></tr></thead>
                  <tbody>
                    {d.fields.map((f) => (
                      <tr key={f.id}><td>{f.name}</td><td>{t(`enums.dataType.${f.dataType}`)}</td><td>{t(`enums.fieldRole.${f.role}`)}</td><td>{f.missingPct ?? '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {p.phase === 'data_preparation' && r.preparationSteps.length > 0 && (
            <ol className="mt-2">
              {r.preparationSteps.map((s) => (
                <li key={s.id}><strong>{t(`enums.operation.${s.operation}`)}:</strong> {s.description}</li>
              ))}
            </ol>
          )}
          {p.phase === 'modeling' && r.models.map((m) => (
            <div key={m.id} className="mt-2">
              <h3 className="h4">{m.name} <small className="fw-normal text-body-secondary">{t(`enums.technique.${m.technique}`)} · {t(`enums.modelStatus.${m.status}`)}</small></h3>
              {m.metrics.length > 0 && (
                <p className="small mb-1">
                  {m.metrics.map((x) => `${x.metric} = ${x.value} (${t(`enums.split.${x.split}`)})`).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

const only = (Component) =>
  function DataAnalysisOnly() {
    return <RequireType type="data_analysis"><Component /></RequireType>;
  };

export const DmOverview = Overview;
export const DmPhases = only(Phases);
export const DmObjectives = only(Objectives);
export const DmDatasets = only(Datasets);
export const DmDatasetDetail = only(DatasetDetail);
export const DmPreparation = only(Preparation);
export const DmModels = only(Models);
export const DmModelDetail = only(ModelDetail);
export const DmReport = only(Report);
