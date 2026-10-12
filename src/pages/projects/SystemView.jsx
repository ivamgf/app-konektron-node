// Visão de Sistema: extensão da Análise de Sistemas com a especificação de requisitos em visão UML
// (Planilha de Análise / ISO 29148, casos de uso como em Guedes, UML 2, tab. 3.1) e em BDD (Gherkin).
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { projectsApi, resourceApi, systemAnalysisApi, systemViewApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { enumOptions, FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading, Modal } from '../../components/ui.jsx';
import { LANGUAGES, useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { RequireType, useProject } from './ProjectLayout.jsx';
import { ENUMS, glossaryConfig, relationConfig, scenarioConfig, stakeholderConfig, ucFormConfig } from './resources.jsx';
import UseCaseDiagram, { actorLines, toPlantUml } from './UseCaseDiagram.jsx';

const base = (project) => `/projects/${project.id}/system-view`;
const saBase = (project) => `/projects/${project.id}/system-analysis`;
const lines = (text) => String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

// Seção dos planos Standard e Master (administradores acessam tudo)
function useCanAccess() {
  const { user, isAdmin } = useAuth();
  return isAdmin || ['standard', 'master'].includes(user?.plan);
}

const SUBNAV = [
  ['', 'overview', 'speedometer2'],
  ['spec', 'spec', 'card-checklist'],
  ['use-cases', 'useCases', 'diagram-2'],
  ['bdd', 'bdd', 'code-square'],
  ['document', 'document', 'file-earmark-text'],
];

function Layout() {
  const { t } = useI18n();
  const context = useOutletContext();
  const allowed = useCanAccess();
  const { project } = context;
  const [importing, setImporting] = useState(false);
  const [version, setVersion] = useState(0); // remonta a subtela depois de importar
  if (!allowed) {
    return (
      <div className="kt-sv-locked text-center py-4">
        <i className="bi bi-lock fs-1 text-body-secondary" aria-hidden="true" />
        <h2 className="h3 mt-2">{t('sections.system-view.name')}</h2>
        <p className="mb-1">{t('sv.locked')}</p>
        <p className="small text-body-secondary mb-0">{t('sections.system-view.text')}</p>
      </div>
    );
  }
  return (
    <>
      <nav aria-label={t('sections.system-view.name')} className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <ul className="nav nav-pills kt-sv-nav">
          {SUBNAV.map(([path, key, icon]) => (
            <li className="nav-item" key={key}>
              <NavLink to={path ? `${base(project)}/${path}` : base(project)} end={!path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <i className={`bi bi-${icon} me-1`} aria-hidden="true" />{t(`sv.nav.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-sm btn-accent kt-no-print" onClick={() => setImporting(true)}>
          <i className="bi bi-box-arrow-in-down me-1" aria-hidden="true" />{t('sv.import.button')}
        </button>
      </nav>
      <Outlet key={version} context={context} />
      {importing && (
        <ImportModal project={project} onClose={() => setImporting(false)}
          onDone={() => { setImporting(false); setVersion((v) => v + 1); }} />
      )}
    </>
  );
}

// ---------- Importar da Análise de Sistemas ----------
const IMPORT_PARTS = [
  ['analysis', true], ['requirements', true], ['userStories', true], ['diagrams', true], ['systemView', true],
  ['generateUseCases', false], ['generateStakeholders', false],
]; // [chave, só faz sentido vindo de outro projeto]

function ImportSummary({ result }) {
  const { t } = useI18n();
  const rows = [
    ['requirements', result.requirements], ['userStories', result.userStories], ['diagrams', result.diagrams],
    ['stakeholders', result.stakeholders], ['glossary', result.glossary], ['useCases', result.useCases],
    ['relations', result.relations], ['scenarios', result.scenarios],
  ].filter(([, c]) => c.created || c.skipped);
  const generated = [...result.generatedUseCases, ...result.generatedStakeholders];
  const fields = result.analysis + result.spec;
  if (!rows.length && !generated.length && !fields && !result.flows) {
    return <p className="mb-0 text-body-secondary">{t('sv.import.nothing')}</p>;
  }
  return (
    <>
      {rows.length > 0 && (
        <table className="table table-sm mb-2">
          <thead><tr><th scope="col">{t('sv.import.item')}</th><th scope="col" className="text-end">{t('sv.import.created')}</th><th scope="col" className="text-end">{t('sv.import.skipped')}</th></tr></thead>
          <tbody>
            {rows.map(([key, c]) => (
              <tr key={key}><td>{t(`sv.import.items.${key}`)}</td><td className="text-end fw-semibold">{c.created}</td><td className="text-end text-body-secondary">{c.skipped}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {fields > 0 && <p className="small mb-1">{t('sv.import.fieldsFilled', { count: fields })}</p>}
      {result.flows > 0 && <p className="small mb-1">{t('sv.import.flows', { count: result.flows })}</p>}
      {result.generatedUseCases.length > 0 && <p className="small mb-1"><strong>{t('sv.import.generatedUseCases')}:</strong> {result.generatedUseCases.join(', ')}</p>}
      {result.generatedStakeholders.length > 0 && <p className="small mb-0"><strong>{t('sv.import.generatedStakeholders')}:</strong> {result.generatedStakeholders.join(', ')}</p>}
    </>
  );
}

function ImportModal({ project, onClose, onDone }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const projects = useAsync(() => projectsApi.list({ type: 'software', pageSize: 100 }), []);
  const [sourceId, setSourceId] = useState(project.id);
  const [parts, setParts] = useState(() => Object.fromEntries(IMPORT_PARTS.map(([k]) => [k, true])));
  const [preview, setPreview] = useState(null);
  const same = sourceId === project.id;
  const body = (dryRun) => ({
    sourceProjectId: sourceId, lang: locale, dryRun,
    ...Object.fromEntries(IMPORT_PARTS.map(([k, otherOnly]) => [k, otherOnly && same ? false : parts[k]])),
  });
  const run = useSubmit((dryRun) => systemViewApi.importFrom(project.id, body(dryRun)), {
    onSuccess: (result) => {
      if (result.dryRun) return setPreview(result);
      toast.success(t('sv.import.done'));
      onDone(result);
    },
  });
  const change = (fn) => {
    fn();
    setPreview(null); // qualquer mudança invalida a prévia
  };
  const options = (projects.data?.data ?? []).filter((p) => p.id !== project.id);

  return (
    <Modal title={t('sv.import.title')} onClose={onClose} size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-outline-primary" disabled={run.busy} onClick={() => run.submit(true)}>
            <i className="bi bi-eye me-1" aria-hidden="true" />{t('sv.import.preview')}
          </button>
          <button type="button" className="btn btn-primary" disabled={run.busy || !preview} onClick={() => run.submit(false)}
            title={preview ? undefined : t('sv.import.previewFirst')}>
            <i className="bi bi-box-arrow-in-down me-1" aria-hidden="true" />{run.busy ? t('common.saving') : t('sv.import.run')}
          </button>
        </>
      }>
      <p className="small text-body-secondary">{t('sv.import.intro')}</p>
      <label className="form-label fw-semibold" htmlFor="kt-import-source">{t('sv.import.source')}</label>
      <select id="kt-import-source" className="form-select mb-1" value={sourceId} onChange={(e) => change(() => setSourceId(e.target.value))}>
        <option value={project.id}>{project.name} — {t('sv.import.thisProject')}</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.name} · v{p.version}</option>)}
      </select>
      <p className="form-text mt-0 mb-3">{t(same ? 'sv.import.sameHelp' : 'sv.import.otherHelp')}</p>

      <fieldset className="mb-3">
        <legend className="form-label fw-semibold fs-6">{t('sv.import.parts')}</legend>
        <div className="row">
          {IMPORT_PARTS.map(([key, otherOnly]) => {
            const disabled = otherOnly && same;
            return (
              <div className="col-md-6" key={key}>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id={`kt-import-${key}`} disabled={disabled}
                    checked={!disabled && parts[key]} onChange={(e) => change(() => setParts((p) => ({ ...p, [key]: e.target.checked })))} />
                  <label className={`form-check-label ${disabled ? 'text-body-secondary' : ''}`} htmlFor={`kt-import-${key}`}>
                    {t(`sv.import.partsLabels.${key}`)}
                    <span className="d-block small text-body-secondary">{t(`sv.import.partsHelp.${key}`)}</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {preview && (
        <section className="kt-import-preview" aria-live="polite">
          <h3 className="h5">{t('sv.import.previewTitle', { name: preview.source.name })}</h3>
          <ImportSummary result={preview} />
        </section>
      )}
    </Modal>
  );
}

// ---------- Visão geral ----------
function Overview() {
  const { t } = useI18n();
  const { project } = useProject();
  const overview = useAsync(() => systemViewApi.overview(project.id), [project.id]);
  const report = useAsync(() => systemViewApi.report(project.id), [project.id]);
  if ((overview.loading && !overview.data) || (report.loading && !report.data)) return <Loading small />;
  if (!overview.data || !report.data) return null;
  const { counts, gaps } = overview.data;
  const r = report.data;
  const cards = [
    ['requirements', counts.requirements, 'list-check'],
    ['useCases', counts.useCases, 'diagram-2'],
    ['userStories', counts.userStories, 'person-lines-fill'],
    ['scenarios', counts.scenarios, 'code-square'],
    ['stakeholders', counts.stakeholders, 'people'],
    ['glossary', counts.glossary, 'book'],
  ];
  const noGaps = !gaps.functionalWithoutUseCase.length && !gaps.useCasesWithoutMainFlow && !gaps.storiesWithoutScenario.length;
  return (
    <>
      <p className="text-body-secondary">{t('sv.intro')}</p>
      <div className="row g-3 mb-4">
        {cards.map(([key, n, icon]) => (
          <div className="col-6 col-md-4 col-xl-2" key={key}>
            <div className="card kt-stat h-100">
              <div className="card-body">
                <i className={`bi bi-${icon} text-primary`} aria-hidden="true" />
                <div className="kt-stat-value">{n}</div>
                <div className="small text-body-secondary">{t(`sv.counts.${key}`)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="h3">{t('sv.traceability')}</h3>
      {counts.requirements === 0 && counts.userStories === 0 ? (
        <p className="text-body-secondary"><i className="bi bi-lightbulb me-1" aria-hidden="true" />{t('sv.emptyHint')}</p>
      ) : noGaps ? (
        <p className="text-success"><i className="bi bi-check-circle me-1" aria-hidden="true" />{t('sv.noGaps')}</p>
      ) : (
        <ul className="kt-sv-gaps mb-4">
          {gaps.functionalWithoutUseCase.length > 0 && (
            <li>{t('sv.gapRequirements', { codes: gaps.functionalWithoutUseCase.join(', ') })} <Link to={`${base(project)}/use-cases`}>{t('sv.nav.useCases')}</Link></li>
          )}
          {gaps.useCasesWithoutMainFlow > 0 && <li>{t('sv.gapMainFlow', { count: gaps.useCasesWithoutMainFlow })}</li>}
          {gaps.storiesWithoutScenario.length > 0 && (
            <li>{t('sv.gapStories', { codes: gaps.storiesWithoutScenario.join(', ') })} <Link to={`${base(project)}/bdd`}>{t('sv.nav.bdd')}</Link></li>
          )}
        </ul>
      )}

      <h3 className="h3">{t('sv.diagram')}</h3>
      {r.useCases.length ? (
        <UseCaseDiagram title={project.name} useCases={r.useCases} relations={r.relations} />
      ) : (
        <EmptyState>{t('sv.noUseCases')}</EmptyState>
      )}
    </>
  );
}

// ---------- Especificação: definições, stakeholders, glossário ----------
const SPEC_FIELDS = [
  { name: 'responsible', label: 'sv.responsible', maxLength: 200, col: 'col-md-6' },
  { name: 'organization', label: 'sv.organization', maxLength: 200, col: 'col-md-6' },
  { name: 'purpose', label: 'sv.purpose', type: 'textarea', rows: 2 },
  { name: 'productPerspective', label: 'sv.productPerspective', type: 'textarea', rows: 2 },
  { name: 'userCharacteristics', label: 'sv.userCharacteristics', type: 'textarea', rows: 2 },
  { name: 'constraints', label: 'sv.constraints', type: 'textarea', rows: 2, col: 'col-md-6' },
  { name: 'assumptions', label: 'sv.assumptions', type: 'textarea', rows: 2, col: 'col-md-6' },
  { name: 'references', label: 'sv.references', type: 'textarea', rows: 2 },
];

function SpecForm({ initial, projectId }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState(() => toFormValues(SPEC_FIELDS, initial));
  const { submit, busy, errors } = useSubmit((body) => systemViewApi.updateSpec(projectId, body), {
    onSuccess: () => toast.success(t('common.saved')),
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(SPEC_FIELDS, values, t)); }}>
      <FieldGrid fields={SPEC_FIELDS} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
    </form>
  );
}

function Spec() {
  const { t } = useI18n();
  const { project } = useProject();
  const spec = useAsync(() => systemViewApi.spec(project.id), [project.id]);
  return (
    <>
      <section className="mb-5">
        <h3 className="h3">{t('sv.definitions')}</h3>
        <p className="small text-body-secondary">{t('sv.definitionsHelp')} <Link to={`/projects/${project.id}/analysis`}>{t('project.tabs.analysis')}</Link></p>
        {spec.loading && !spec.data ? <Loading small /> : spec.data && <SpecForm initial={spec.data} projectId={project.id} />}
      </section>
      <section className="mb-5">
        <h3 className="h3">{t('sv.stakeholders')}</h3>
        <ResourceManager path={`${base(project)}/stakeholders`} {...stakeholderConfig(t)} />
      </section>
      <section>
        <h3 className="h3">{t('sv.glossary')}</h3>
        <ResourceManager path={`${base(project)}/glossary`} {...glossaryConfig(t)} />
      </section>
    </>
  );
}

// ---------- Casos de uso ----------
function useUseCaseData(project) {
  const [version, setVersion] = useState(0);
  const requirements = useAsync(() => resourceApi(`${saBase(project)}/requirements`).list(), [project.id]);
  const useCases = useAsync(() => resourceApi(`${base(project)}/use-cases`).list(), [project.id, version]);
  const relations = useAsync(() => resourceApi(`${base(project)}/relations`).list(), [project.id, version]);
  return {
    requirements: requirements.data,
    useCases: useCases.data,
    relations: relations.data,
    loading: !requirements.data || !useCases.data || !relations.data,
    reload: () => setVersion((v) => v + 1),
  };
}

function UseCases() {
  const { t } = useI18n();
  const { project } = useProject();
  const data = useUseCaseData(project);
  const [showPlantUml, setShowPlantUml] = useState(false);
  if (data.loading) return <Loading small />;
  const plantUml = toPlantUml(project.name, data.useCases, data.relations);
  return (
    <>
      <p className="small text-body-secondary">{t('sv.useCasesHelp')}</p>
      <ResourceManager
        path={`${base(project)}/use-cases`}
        {...ucFormConfig(t, { requirements: data.requirements, useCases: data.useCases })}
        rowLink={(row) => `${base(project)}/use-cases/${row.id}`}
        onChange={data.reload}
      />

      <h3 className="h3 mt-5">{t('sv.relations')}</h3>
      <p className="small text-body-secondary">{t('sv.relationsHelp')}</p>
      <ResourceManager path={`${base(project)}/relations`} {...relationConfig(t, data.useCases)} onChange={data.reload} />

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-5 mb-2">
        <h3 className="h3 mb-0">{t('sv.diagram')}</h3>
        {data.useCases.length > 0 && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowPlantUml((v) => !v)} aria-expanded={showPlantUml}>
            <i className="bi bi-code-slash me-1" aria-hidden="true" />PlantUML
          </button>
        )}
      </div>
      {data.useCases.length ? (
        <>
          {showPlantUml && <CopyBlock text={plantUml} />}
          <UseCaseDiagram title={project.name} useCases={data.useCases} relations={data.relations} />
        </>
      ) : (
        <EmptyState>{t('sv.noUseCases')}</EmptyState>
      )}
      <RegisteredDiagrams project={project} />
    </>
  );
}

// Diagramas de caso de uso já cadastrados na Análise de Sistemas
function RegisteredDiagrams({ project }) {
  const { t } = useI18n();
  const diagrams = useAsync(() => resourceApi(`${saBase(project)}/diagrams`).list({ type: 'use_case' }), [project.id]);
  if (!diagrams.data?.length) return null;
  return (
    <section className="mt-4">
      <h3 className="h4">{t('sv.registeredDiagrams')}</h3>
      {diagrams.data.map((d) => (
        <details key={d.id} className="mb-2">
          <summary className="fw-semibold">{d.title}{d.notation && <span className="text-body-secondary fw-normal"> · {t(`enums.notation.${d.notation}`)}</span>}</summary>
          {d.description && <p className="small mt-2 mb-1">{d.description}</p>}
          {d.notation === 'image' && d.url ? <img src={d.url} alt={d.title} className="img-fluid border mt-2" />
            : d.source ? <pre className="kt-pre mt-2">{d.source}</pre>
              : d.url && <a href={d.url} target="_blank" rel="noopener noreferrer">{t('common.open')}</a>}
        </details>
      ))}
    </section>
  );
}

function CopyBlock({ text }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="position-relative mb-3">
      <button type="button" className="btn btn-sm btn-light border position-absolute top-0 end-0 m-2"
        onClick={() => navigator.clipboard.writeText(text).then(() => toast.success(t('sv.copied')))}>
        <i className="bi bi-clipboard me-1" aria-hidden="true" />{t('sv.copy')}
      </button>
      <pre className="kt-pre">{text}</pre>
    </div>
  );
}

// Especificação do caso de uso no formato de Guedes (tab. 3.1)
function UseCaseSpecTable({ useCase, generalName, requirements }) {
  const { t } = useI18n();
  const reqs = (useCase.requirementIds ?? []).map((id) => requirements.find((r) => r.id === id)).filter(Boolean);
  const row = (label, value) => (
    <tr>
      <th scope="row">{t(label)}</th>
      <td className="kt-prewrap">{value || '—'}</td>
    </tr>
  );
  return (
    <table className="table table-sm kt-uc-table">
      <caption className="visually-hidden">{useCase.code} — {useCase.name}</caption>
      <tbody>
        {row('sv.useCaseName', `${useCase.code} — ${useCase.name}`)}
        {row('sv.generalUseCase', generalName)}
        {row('sv.primaryActor', useCase.primaryActor)}
        {row('sv.secondaryActors', actorLines(useCase.secondaryActors).join(', '))}
        {row('sv.summary', useCase.summary)}
        {row('sv.preconditions', useCase.preconditions)}
        {row('sv.postconditions', useCase.postconditions)}
        {row('sv.requirements', reqs.map((r) => `${r.code} — ${r.title}`).join('\n'))}
        {row('sa.priority', useCase.priority ? t(`enums.priority.${useCase.priority}`) : '')}
      </tbody>
    </table>
  );
}

function FlowTable({ flow }) {
  const { t } = useI18n();
  return (
    <table className="table table-sm table-bordered kt-flow-table mb-0">
      <thead>
        <tr><th scope="col" className="text-center">Nº</th><th scope="col">{t('sv.actorActions')}</th><th scope="col">{t('sv.systemActions')}</th></tr>
      </thead>
      <tbody>
        {flow.steps.length === 0 ? (
          <tr><td colSpan={3} className="text-body-secondary small">{t('common.empty')}</td></tr>
        ) : flow.steps.map((s, i) => (
          <tr key={i}><td className="text-center">{i + 1}</td><td>{s.actor || ''}</td><td>{s.system || ''}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function FlowModal({ project, useCaseId, flow, hasMain, onClose, onSaved }) {
  const { t } = useI18n();
  const isNew = !flow.id;
  const [kind, setKind] = useState(flow.kind ?? (hasMain ? 'alternative' : 'main'));
  const [title, setTitle] = useState(flow.title ?? (hasMain ? '' : t('sv.mainFlowTitle')));
  const [steps, setSteps] = useState(flow.steps?.length ? flow.steps : [{ actor: '', system: '' }]);
  const api = resourceApi(`${base(project)}/use-cases/${useCaseId}/flows`);
  const { submit, busy, errors } = useSubmit((body) => (isNew ? api.create(body) : api.update(flow.id, body)), { onSuccess: onSaved });
  const setStep = (i, key, value) => setSteps((list) => list.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
  const move = (i, d) => setSteps((list) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const save = (e) => {
    e.preventDefault();
    submit({ kind, title: title.trim(), steps: steps.filter((s) => s.actor?.trim() || s.system?.trim()) });
  };
  return (
    <Modal title={t(isNew ? 'sv.newFlow' : 'sv.editFlow')} onClose={onClose} size="modal-xl"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-flow-form" className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </>
      }>
      <form id="kt-flow-form" noValidate onSubmit={save}>
        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label fw-semibold" htmlFor="kt-flow-kind">{t('project.type')}</label>
            <select id="kt-flow-kind" className={`form-select ${errors.kind ? 'is-invalid' : ''}`} value={kind} onChange={(e) => setKind(e.target.value)}>
              {enumOptions(t, 'flowKind', ENUMS.flowKind).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.kind && <div className="invalid-feedback">{errors.kind}</div>}
          </div>
          <div className="col-md-8 mb-3">
            <label className="form-label fw-semibold" htmlFor="kt-flow-title">{t('sa.title')}<span className="text-danger" aria-hidden="true"> *</span></label>
            <input id="kt-flow-title" className={`form-control ${errors.title ? 'is-invalid' : ''}`} value={title} maxLength={200}
              placeholder={t('sv.flowTitleHint')} onChange={(e) => setTitle(e.target.value)} />
            {errors.title && <div className="invalid-feedback">{errors.title}</div>}
          </div>
        </div>
        <p className="small text-body-secondary">{t('sv.stepsEditorHelp')}</p>
        <table className="table table-sm align-middle kt-steps-editor">
          <thead>
            <tr><th scope="col" className="text-center">Nº</th><th scope="col">{t('sv.actorActions')}</th><th scope="col">{t('sv.systemActions')}</th><th scope="col"><span className="visually-hidden">{t('common.actions')}</span></th></tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i}>
                <td className="text-center">{i + 1}</td>
                <td><textarea className="form-control form-control-sm" rows={2} maxLength={1000} value={s.actor ?? ''}
                  aria-label={`${t('sv.actorActions')} ${i + 1}`} onChange={(e) => setStep(i, 'actor', e.target.value)} /></td>
                <td><textarea className="form-control form-control-sm" rows={2} maxLength={1000} value={s.system ?? ''}
                  aria-label={`${t('sv.systemActions')} ${i + 1}`} onChange={(e) => setStep(i, 'system', e.target.value)} /></td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-link" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('sv.stepUp')}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
                  <button type="button" className="btn btn-sm btn-link" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={t('sv.stepDown')}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
                  <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => setSteps((l) => l.filter((_, j) => j !== i))} aria-label={t('common.delete')}><i className="bi bi-x-lg" aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setSteps((l) => [...l, { actor: '', system: '' }])}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('sv.addStep')}
        </button>
        {errors.steps && <div className="invalid-feedback d-block">{errors.steps}</div>}
      </form>
    </Modal>
  );
}

function GenerateBddModal({ project, useCase, onClose }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const stories = useAsync(() => resourceApi(`${saBase(project)}/user-stories`).list(), [project.id]);
  const [storyId, setStoryId] = useState('');
  const [lang, setLang] = useState(locale);
  const { submit, busy } = useSubmit(() => systemViewApi.generateScenarios(project.id, useCase.id, lang, storyId || null), {
    onSuccess: (created) => {
      toast.success(created.length ? t('sv.generated', { count: created.length }) : t('sv.generatedNone'));
      navigate(`${base(project)}/bdd`);
    },
  });
  return (
    <Modal title={t('sv.generateBdd')} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submit()}>{busy ? t('common.saving') : t('sv.generate')}</button>
        </>
      }>
      <p className="small">{t('sv.generateHelp')}</p>
      <label className="form-label fw-semibold" htmlFor="kt-gen-story">{t('sv.feature')}</label>
      <select id="kt-gen-story" className="form-select mb-3" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
        <option value="">{t('common.none')}</option>
        {(stories.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
      </select>
      <label className="form-label fw-semibold" htmlFor="kt-gen-lang">{t('sv.gherkinLanguage')}</label>
      <select id="kt-gen-lang" className="form-select" value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGUAGES.map(({ code }) => <option key={code} value={code}>{t(`enums.locale.${code}`)}</option>)}
      </select>
    </Modal>
  );
}

function UseCaseDetail() {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const { useCaseId } = useParams();
  const data = useUseCaseData(project);
  const detail = useAsync(() => systemViewApi.useCase(project.id, useCaseId), [project.id, useCaseId]);
  const [editing, setEditing] = useState(false);
  const [flowEdit, setFlowEdit] = useState(null);
  const [generating, setGenerating] = useState(false);
  useCrumbLabel('useCase', detail.data ? `${detail.data.code} — ${detail.data.name}` : null);

  const config = useMemo(
    () => (data.loading ? null : ucFormConfig(t, { requirements: data.requirements, useCases: (data.useCases ?? []).filter((u) => u.id !== useCaseId) })),
    [data.loading, data.requirements, data.useCases, t, useCaseId],
  );
  const [values, setValues] = useState(null);
  const save = useSubmit((body) => resourceApi(`${base(project)}/use-cases`).update(useCaseId, body), {
    onSuccess: () => {
      toast.success(t('common.saved'));
      setEditing(false);
      detail.reload();
      data.reload();
    },
  });

  if (detail.loading && !detail.data) return <Loading small />;
  if (!detail.data || data.loading) return detail.data ? <Loading small /> : null;
  const uc = detail.data;
  const byId = Object.fromEntries(data.useCases.map((u) => [u.id, u]));
  const general = uc.generalUseCaseId && byId[uc.generalUseCaseId];
  const flows = [...uc.flows].sort((a, b) => ['main', 'alternative', 'exception'].indexOf(a.kind) - ['main', 'alternative', 'exception'].indexOf(b.kind) || a.position - b.position);
  const hasMain = flows.some((f) => f.kind === 'main');

  const removeFlow = async (flow) => {
    if (!window.confirm(t('common.confirmDelete', { name: flow.title }))) return;
    try {
      await resourceApi(`${base(project)}/use-cases/${uc.id}/flows`).remove(flow.id);
      toast.success(t('common.deleted'));
      detail.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <article>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <Link to={`${base(project)}/use-cases`} className="small"><i className="bi bi-arrow-left me-1" aria-hidden="true" />{t('sv.nav.useCases')}</Link>
          <h3 className="h2 mt-1 mb-0">{uc.code} — {uc.name}</h3>
          <span className="badge text-bg-light border mt-1">{t(`enums.useCaseStatus.${uc.status}`)}</span>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={() => { setValues(toFormValues(config.fields, uc)); setEditing(true); }}>
            <i className="bi bi-pencil me-1" aria-hidden="true" />{t('common.edit')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setGenerating(true)} disabled={!flows.length}
            title={flows.length ? undefined : t('sv.generateNeedsFlows')}>
            <i className="bi bi-magic me-1" aria-hidden="true" />{t('sv.generateBdd')}
          </button>
        </div>
      </div>

      <UseCaseSpecTable useCase={uc} generalName={general ? `${general.code} — ${general.name}` : ''} requirements={data.requirements} />

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 mb-2">
        <h4 className="h3 mb-0">{t('sv.flows')}</h4>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setFlowEdit({})}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('sv.newFlow')}
        </button>
      </div>
      {!hasMain && <p className="small text-warning-emphasis"><i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{t('sv.noMainFlow')}</p>}
      {flows.map((f) => (
        <section key={f.id} className={`kt-flow mb-3 is-${f.kind}`} aria-labelledby={`flow-${f.id}`}>
          <header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="h4 mb-0" id={`flow-${f.id}`}>
              <span className="kt-flow-kind">{t(`enums.flowKind.${f.kind}`)}</span>{f.kind !== 'main' && ` — ${f.title}`}
            </h5>
            <div>
              <button type="button" className="btn btn-sm btn-link" onClick={() => setFlowEdit(f)} aria-label={`${t('common.edit')} ${f.title}`}><i className="bi bi-pencil" aria-hidden="true" /></button>
              <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeFlow(f)} aria-label={`${t('common.delete')} ${f.title}`}><i className="bi bi-trash" aria-hidden="true" /></button>
            </div>
          </header>
          <FlowTable flow={f} />
        </section>
      ))}

      <h4 className="h3 mt-4">{t('sv.restrictions')}</h4>
      {lines(uc.restrictions).length ? (
        <ol className="mb-4">{lines(uc.restrictions).map((r, i) => <li key={i}>{r.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
      ) : <p className="text-body-secondary">—</p>}

      {uc.relations.length > 0 && (
        <>
          <h4 className="h3">{t('sv.relations')}</h4>
          <ul>
            {uc.relations.map((r) => {
              const from = byId[r.fromUseCaseId];
              const to = byId[r.toUseCaseId];
              return (
                <li key={r.id}>
                  {from?.code} — {from?.name} <code>«{r.type}»</code> {to?.code} — {to?.name}
                  {r.condition && <span className="text-body-secondary"> ({r.condition})</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && config && (
        <Modal title={`${t('common.edit')}: ${uc.code}`} onClose={() => setEditing(false)} size="modal-lg"
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
              <button type="submit" form="kt-uc-form" className="btn btn-primary" disabled={save.busy}>{save.busy ? t('common.saving') : t('common.save')}</button>
            </>
          }>
          <form id="kt-uc-form" noValidate onSubmit={(e) => { e.preventDefault(); save.submit(toPayload(config.fields, values, t)); }}>
            <FieldGrid fields={config.fields} values={values} errors={save.errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
          </form>
        </Modal>
      )}
      {flowEdit && (
        <FlowModal project={project} useCaseId={uc.id} flow={flowEdit} hasMain={hasMain && flowEdit.kind !== 'main'}
          onClose={() => setFlowEdit(null)}
          onSaved={() => { toast.success(t('common.saved')); setFlowEdit(null); detail.reload(); }} />
      )}
      {generating && <GenerateBddModal project={project} useCase={uc} onClose={() => setGenerating(false)} />}
    </article>
  );
}

// ---------- BDD ----------
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Bdd() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const [lang, setLang] = useState(locale);
  const [version, setVersion] = useState(0);
  const stories = useAsync(() => resourceApi(`${saBase(project)}/user-stories`).list(), [project.id]);
  const useCases = useAsync(() => resourceApi(`${base(project)}/use-cases`).list(), [project.id]);
  const features = useAsync(() => systemViewApi.features(project.id, lang), [project.id, lang, version]);
  if (!stories.data || !useCases.data) return <Loading small />;
  return (
    <>
      <p className="small text-body-secondary">{t('sv.bddHelp')}</p>
      <h3 className="h3">{t('sv.scenarios')}</h3>
      <ResourceManager path={`${base(project)}/scenarios`} {...scenarioConfig(t, { stories: stories.data, useCases: useCases.data })}
        onChange={() => setVersion((v) => v + 1)} />

      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mt-5 mb-3">
        <h3 className="h3 mb-0">{t('sv.features')}</h3>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div>
            <label className="form-label small mb-1" htmlFor="kt-bdd-lang">{t('sv.gherkinLanguage')}</label>
            <select id="kt-bdd-lang" className="form-select form-select-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map(({ code }) => <option key={code} value={code}>{t(`enums.locale.${code}`)}</option>)}
            </select>
          </div>
          {features.data?.length > 0 && (
            <button type="button" className="btn btn-sm btn-primary"
              onClick={() => features.data.forEach((f) => download(f.name, f.content))}>
              <i className="bi bi-download me-1" aria-hidden="true" />{t('sv.downloadAll')}
            </button>
          )}
        </div>
      </div>
      {features.loading && !features.data ? <Loading small /> : !features.data?.length ? (
        <EmptyState>{t('sv.noFeatures')}</EmptyState>
      ) : features.data.map((f) => (
        <section key={f.name} className="mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
            <h4 className="h5 mb-0 font-monospace">{f.name}</h4>
            <button type="button" className="btn btn-sm btn-link" onClick={() => download(f.name, f.content)}>
              <i className="bi bi-download me-1" aria-hidden="true" />{t('sv.download')}
            </button>
          </div>
          <pre className="kt-pre kt-gherkin" lang={lang}>{f.content}</pre>
        </section>
      ))}
    </>
  );
}

// ---------- Documento de especificação (versão UML) ----------
const REQ_GROUPS = ['functional', 'non_functional', 'domain', 'business_rule'];

function Document() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => systemViewApi.report(project.id), [project.id]);
  const analysis = useAsync(() => systemAnalysisApi.analysis(project.id), [project.id]);
  if ((data.loading && !data.data) || (analysis.loading && !analysis.data)) return <Loading small />;
  if (!data.data) return null;
  const r = data.data;
  const byId = Object.fromEntries(r.useCases.map((u) => [u.id, u]));
  const functional = r.requirements.filter((q) => q.type === 'functional');
  let n = 0;
  const h = (key) => `${++n}. ${t(key)}`;
  const text = (v) => <p className="kt-prewrap">{v || '—'}</p>;

  return (
    <article className="kt-report kt-srs">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mt-0 border-0">{t('sv.documentTitle')}</h2>
          <p className="text-body-secondary mb-0">{r.project.name} · v{r.project.version} · {formatDate(r.generatedAt, locale)}</p>
          {(r.spec.responsible || r.spec.organization) && (
            <p className="text-body-secondary mb-0">{[r.spec.responsible, r.spec.organization].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <button type="button" className="btn btn-accent kt-no-print" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" aria-hidden="true" />{t('common.print')}
        </button>
      </div>

      <h2>{h('sv.doc.introduction')}</h2>
      <h3 className="h4">{t('sv.purpose')}</h3>{text(r.spec.purpose)}
      <h3 className="h4">{t('sa.scope')}</h3>{text(r.analysis.scope)}
      <h3 className="h4">{t('sv.doc.overview')}</h3>{text(r.analysis.goal)}
      <h3 className="h4">{t('sv.glossary')}</h3>
      {r.glossary.length ? (
        <dl className="row">
          {r.glossary.map((g) => (
            <div key={g.id} className="col-12 mb-2">
              <dt>{g.term}{g.synonyms && <span className="fw-normal text-body-secondary"> ({g.synonyms})</span>}</dt>
              <dd className="mb-0 kt-prewrap">{g.definition}</dd>
            </div>
          ))}
        </dl>
      ) : <p>—</p>}
      <h3 className="h4">{t('sv.references')}</h3>{text(r.spec.references)}

      <h2>{h('sv.doc.general')}</h2>
      <h3 className="h4">{t('sv.productPerspective')}</h3>{text(r.spec.productPerspective)}
      <h3 className="h4">{t('sv.userCharacteristics')}</h3>{text(r.spec.userCharacteristics)}
      <h3 className="h4">{t('sv.constraints')}</h3>{text(r.spec.constraints)}
      <h3 className="h4">{t('sv.assumptions')}</h3>{text(r.spec.assumptions)}
      <h3 className="h4">{t('sv.stakeholders')}</h3>
      {r.stakeholders.length ? (
        <table className="table table-sm">
          <thead><tr><th>{t('sa.code')}</th><th>{t('sv.stakeholderName')}</th><th>{t('sv.role')}</th><th>{t('sv.interest')}</th><th>{t('sv.responsibility')}</th></tr></thead>
          <tbody>{r.stakeholders.map((s) => <tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.role ?? '—'}</td><td>{s.interest ?? '—'}</td><td>{s.responsibility ?? '—'}</td></tr>)}</tbody>
        </table>
      ) : <p>—</p>}

      <h2>{h('sv.doc.requirements')}</h2>
      {REQ_GROUPS.map((type) => {
        const items = r.requirements.filter((q) => q.type === type);
        return (
          <section key={type}>
            <h3 className="h4">{t(`sv.doc.reqGroups.${type}`)}</h3>
            {items.length ? (
              <table className="table table-sm">
                <thead><tr><th>{t('sa.code')}</th><th>{t('sa.title')}</th>{type === 'non_functional' && <th>{t('sa.subType')}</th>}<th>{t('project.description')}</th><th>{t('sa.priority')}</th></tr></thead>
                <tbody>
                  {items.map((q) => (
                    <tr key={q.id}>
                      <td className="fw-semibold">{q.code}</td><td>{q.title}</td>
                      {type === 'non_functional' && <td>{q.subType ?? '—'}</td>}
                      <td className="kt-prewrap small">{q.description ?? '—'}</td>
                      <td>{q.priority ? t(`enums.priority.${q.priority}`) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>—</p>}
          </section>
        );
      })}

      <h2>{h('sv.doc.useCaseModel')}</h2>
      <h3 className="h4">{t('sv.diagram')}</h3>
      {r.useCases.length ? <UseCaseDiagram title={r.project.name} useCases={r.useCases} relations={r.relations} /> : <p>—</p>}
      {r.diagrams.length > 0 && <p className="small text-body-secondary">{t('sv.doc.registeredDiagrams', { titles: r.diagrams.map((d) => d.title).join(', ') })}</p>}
      {r.useCases.map((u) => (
        <section key={u.id} className="kt-srs-uc">
          <h3 className="h4">{u.code} — {u.name}</h3>
          <UseCaseSpecTable useCase={u} generalName={u.generalUseCaseId && byId[u.generalUseCaseId] ? `${byId[u.generalUseCaseId].code} — ${byId[u.generalUseCaseId].name}` : ''}
            requirements={r.requirements} />
          {u.flows.map((f) => (
            <div key={f.id} className="mb-2">
              <p className="fw-semibold mb-1">{t(`enums.flowKind.${f.kind}`)}{f.kind !== 'main' && ` — ${f.title}`}</p>
              <FlowTable flow={f} />
            </div>
          ))}
          {lines(u.restrictions).length > 0 && (
            <>
              <p className="fw-semibold mb-1">{t('sv.restrictions')}</p>
              <ol>{lines(u.restrictions).map((x, i) => <li key={i}>{x.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
            </>
          )}
        </section>
      ))}

      <h3 className="h4">{t('sv.doc.matrix')}</h3>
      {functional.length && r.useCases.length ? (
        <div className="table-responsive">
          <table className="table table-sm table-bordered kt-matrix">
            <thead>
              <tr><th scope="col">{t('sv.doc.reqVsUc')}</th>{r.useCases.map((u) => <th key={u.id} scope="col" title={u.name}>{u.code}</th>)}</tr>
            </thead>
            <tbody>
              {functional.map((q) => (
                <tr key={q.id}>
                  <th scope="row" title={q.title}>{q.code}</th>
                  {r.useCases.map((u) => {
                    const hit = (u.requirementIds ?? []).includes(q.id);
                    return <td key={u.id} className="text-center">{hit ? <><span aria-hidden="true">●</span><span className="visually-hidden">{t('common.yes')}</span></> : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>—</p>}
    </article>
  );
}

const only = (Component) =>
  function SoftwareOnly() {
    return <RequireType type="software"><Component /></RequireType>;
  };

export const SvLayout = only(Layout);
export const SvOverview = Overview;
export const SvSpec = Spec;
export const SvUseCases = UseCases;
export const SvUseCaseDetail = UseCaseDetail;
export const SvBdd = Bdd;
export const SvDocument = Document;
