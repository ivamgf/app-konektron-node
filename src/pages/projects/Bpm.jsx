// BPM: arquitetura de processos, SIPOC, diagnóstico e diagramas BPMN (AS IS / TO BE)
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { bpmApi, resourceApi } from '../../api/endpoints.js';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { EditForm, FileCard, SectionLayout, StatCards, withoutFile } from '../../components/sections.jsx';
import { EmptyState, Loading } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';
import { badge, BPM_FILES, bpmDiagramConfig, processConfig, processDetailFields } from './resources.jsx';

const base = (project) => `/projects/${project.id}/bpm`;

function Layout() {
  const { t } = useI18n();
  const { project } = useProject();
  return (
    <SectionLayout section="bpm" base={base(project)} items={[
      ['', t('bpm.nav.overview'), 'diagram-3'],
      ['processes', t('bpm.nav.processes'), 'list-ol'],
      ['diagrams', t('bpm.nav.diagrams'), 'bezier2'],
    ]} />
  );
}

// Processos do projeto (opções de "processo pai" e de vínculo dos diagramas)
function useProcesses(project, version = 0) {
  return useAsync(() => resourceApi(`${base(project)}/processes`).list(), [project.id, version]);
}

// ---------- Arquitetura ----------
function Tree({ nodes, childrenOf, project }) {
  const { t } = useI18n();
  return (
    <ul className="kt-tree">
      {nodes.map((p) => (
        <li key={p.id}>
          <Link to={`${base(project)}/processes/${p.id}`} className="fw-semibold">{p.code} — {p.name}</Link>{' '}
          <span className="badge text-bg-light border">{t(`enums.processLevel.${p.level}`)}</span>{' '}
          <i className={`bi ${p.sipocComplete ? 'bi-check-circle-fill text-success' : 'bi-circle text-body-secondary'}`}
            title={t(p.sipocComplete ? 'bpm.sipocComplete' : 'bpm.sipocIncomplete')}
            aria-label={t(p.sipocComplete ? 'bpm.sipocComplete' : 'bpm.sipocIncomplete')} />
          {p.diagrams > 0 && (
            <span className="small text-body-secondary ms-2"><i className="bi bi-bezier2 me-1" aria-hidden="true" />{p.diagrams}</span>
          )}
          {p.owner && <span className="small text-body-secondary ms-2">· {p.owner}</span>}
          {childrenOf[p.id]?.length > 0 && <Tree nodes={childrenOf[p.id]} childrenOf={childrenOf} project={project} />}
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  const { t } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => bpmApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const { processes, counts } = data.data;
  const ids = new Set(processes.map((p) => p.id));
  const childrenOf = Object.groupBy(processes.filter((p) => p.parentId && ids.has(p.parentId)), (p) => p.parentId);
  const roots = processes.filter((p) => !p.parentId || !ids.has(p.parentId));
  return (
    <>
      <p className="text-body-secondary">{t('bpm.intro')}</p>
      <StatCards items={[
        [t('bpm.counts.processes'), counts.processes, 'list-ol'],
        [t('bpm.counts.sipoc'), processes.filter((p) => p.sipocComplete).length, 'table'],
        [t('bpm.counts.diagrams'), counts.diagrams, 'bezier2'],
        [t('bpm.counts.diagramsWithFile'), counts.diagramsWithFile, 'file-earmark-code'],
      ]} />
      <h3 className="h3">{t('bpm.tree')}</h3>
      {roots.length ? <Tree nodes={roots} childrenOf={childrenOf} project={project} /> : <EmptyState>{t('bpm.noProcesses')}</EmptyState>}
    </>
  );
}

// ---------- Processos ----------
function Processes() {
  const { t } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const processes = useProcesses(project, version);
  if (processes.loading && !processes.data) return <Loading small />;
  return (
    <ResourceManager
      path={`${base(project)}/processes`}
      {...processConfig(t, processes.data ?? [])}
      rowLink={(r) => `${base(project)}/processes/${r.id}`}
      onChange={() => setVersion((v) => v + 1)}
      afterCreate={(row) => navigate(`${base(project)}/processes/${row.id}`)}
    />
  );
}

function ProcessDetail() {
  const { t } = useI18n();
  const { project } = useProject();
  const { processId } = useParams();
  const api = useMemo(() => resourceApi(`${base(project)}/processes`), [project]);
  const item = useAsync(() => api.get(processId), [project.id, processId]);
  const processes = useProcesses(project);
  const diagrams = useAsync(() => resourceApi(`${base(project)}/diagrams`).list({ processId }), [project.id, processId]);
  useCrumbLabel('bpmProcess', item.data ? `${item.data.code} — ${item.data.name}` : null);
  if ((item.loading && !item.data) || !processes.data) return <Loading small />;
  if (!item.data) return null;
  const p = item.data;
  const all = processes.data;
  const parent = all.find((x) => x.id === p.parentId);
  const children = all.filter((x) => x.parentId === p.id);
  // o próprio processo não pode ser o pai
  const general = processConfig(t, all.filter((x) => x.id !== p.id)).fields;
  const save = (body) => api.update(p.id, body);

  return (
    <article>
      <h3 className="h2 mb-1">{p.code} — {p.name}</h3>
      <p className="mb-3">
        {badge(t(`enums.processLevel.${p.level}`))} {badge(t(`enums.processStatus.${p.status}`))}
        {parent && (
          <span className="small ms-2">{t('bpm.parent')}: <Link to={`${base(project)}/processes/${parent.id}`}>{parent.code} — {parent.name}</Link></span>
        )}
      </p>

      <section className="card mb-4" aria-labelledby="bpm-sipoc">
        <div className="card-header"><h4 className="h4 mb-0" id="bpm-sipoc">{t('bpm.sipoc')} · {t('bpm.diagnosis')}</h4></div>
        <div className="card-body">
          <p className="small text-body-secondary">{t('bpm.sipocHelp')}</p>
          <EditForm fields={processDetailFields()} initial={p} onSave={save} onSaved={item.setData} />
        </div>
      </section>

      <div className="row g-4">
        <div className="col-lg-7">
          <section className="card" aria-labelledby="bpm-general">
            <div className="card-header"><h4 className="h4 mb-0" id="bpm-general">{t('bpm.process')}</h4></div>
            <div className="card-body">
              <EditForm fields={general} initial={p} onSave={save} onSaved={item.setData} />
            </div>
          </section>
        </div>
        <div className="col-lg-5">
          <h4 className="h4">{t('bpm.subprocesses')}</h4>
          {children.length ? (
            <ul>{children.map((c) => <li key={c.id}><Link to={`${base(project)}/processes/${c.id}`}>{c.code} — {c.name}</Link></li>)}</ul>
          ) : <p className="text-body-secondary">—</p>}
          <h4 className="h4">{t('bpm.diagramsOfProcess')}</h4>
          {diagrams.data?.length ? (
            <ul>
              {diagrams.data.map((d) => (
                <li key={d.id}>
                  <Link to={`${base(project)}/diagrams/${d.id}`}>{d.title}</Link>{' '}
                  <span className="small text-body-secondary">({t(`enums.diagramState.${d.state}`)})</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-body-secondary">—</p>}
          <Link to={`${base(project)}/diagrams`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('bpm.newDiagram')}
          </Link>
        </div>
      </div>
    </article>
  );
}

// ---------- Diagramas ----------
function Diagrams() {
  const { t } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const processes = useProcesses(project);
  if (processes.loading && !processes.data) return <Loading small />;
  return (
    <>
      <p className="small text-body-secondary">{t('bpm.createHint')}</p>
      <ResourceManager
        path={`${base(project)}/diagrams`}
        {...bpmDiagramConfig(t, processes.data ?? [])}
        rowLink={(r) => `${base(project)}/diagrams/${r.id}`}
        afterCreate={(row) => navigate(`${base(project)}/diagrams/${row.id}`)}
      />
    </>
  );
}

const NameList = ({ title, names }) =>
  names?.length ? (
    <>
      <dt className="col-sm-4">{title}</dt>
      <dd className="col-sm-8">{names.join(', ')}</dd>
    </>
  ) : null;

function MetricsCard({ metrics }) {
  const { t } = useI18n();
  if (!metrics.isBpmn) return <p className="small text-body-secondary">{t('bpm.notBpmn')}</p>;
  const counts = Object.entries(metrics.counts).filter(([, n]) => n > 0);
  return (
    <section className="card mb-4" aria-labelledby="bpm-metrics">
      <div className="card-header"><h3 className="h4 mb-0" id="bpm-metrics">{t('bpm.metrics')}</h3></div>
      <div className="card-body">
        <table className="table table-sm mb-3">
          <tbody>
            {counts.map(([key, n]) => (
              <tr key={key}>
                <td>
                  {t(`bpm.metricLabels.${key}`)}
                  {metrics.byType?.[key] && (
                    <div className="small text-body-secondary">
                      {Object.entries(metrics.byType[key]).map(([type, c]) => `${type}: ${c}`).join(' · ')}
                    </div>
                  )}
                </td>
                <td className="text-end fw-semibold">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="row small mb-0">
          <NameList title={t('bpm.processesInFile')} names={metrics.processes} />
          <NameList title={t('bpm.participantsInFile')} names={metrics.participants} />
          <NameList title={t('bpm.lanesInFile')} names={metrics.lanes} />
        </dl>
        {metrics.taskNames?.length > 0 && (
          <>
            <h4 className="h5 mt-2">{t('bpm.tasksInFile')}</h4>
            <ol className="small mb-0" style={{ maxHeight: '14rem', overflowY: 'auto' }}>
              {metrics.taskNames.map((n) => <li key={n}>{n}</li>)}
            </ol>
          </>
        )}
        {!metrics.hasLayout && <p className="small text-warning-emphasis mt-2 mb-0">{t('bpm.noLayout')}</p>}
      </div>
    </section>
  );
}

function DiagramDetail() {
  const { t } = useI18n();
  const { project } = useProject();
  const { diagramId } = useParams();
  const api = useMemo(() => resourceApi(`${base(project)}/diagrams`), [project]);
  const item = useAsync(() => api.get(diagramId), [project.id, diagramId]);
  const processes = useProcesses(project);
  const [formKey, setFormKey] = useState(0);
  useCrumbLabel('bpmDiagram', item.data?.title);
  if ((item.loading && !item.data) || !processes.data) return <Loading small />;
  if (!item.data) return null;
  const d = item.data;
  const process = processes.data.find((p) => p.id === d.processId);
  const refresh = (row) => {
    item.setData(row);
    setFormKey((k) => k + 1);
  };
  return (
    <article>
      <h3 className="h2 mb-1">{d.title}</h3>
      <p className="mb-3">
        {badge(t(`enums.diagramState.${d.state}`), d.state === 'to_be' ? 'text-bg-primary' : undefined)}
        {d.notation && <span className="ms-1">{badge(t(`enums.diagramNotation.${d.notation}`))}</span>}
        {d.version && <span className="ms-1">{badge(`v${d.version}`)}</span>}
        {process && (
          <span className="small ms-2">{t('bpm.process')}: <Link to={`${base(project)}/processes/${process.id}`}>{process.code} — {process.name}</Link></span>
        )}
        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="small ms-2">{t('bpm.url')} <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}
      </p>
      <div className="row g-4">
        <div className="col-lg-5 order-lg-2">
          <FileCard itemPath={`${base(project)}/diagrams/${d.id}`} record={d} accept={BPM_FILES} help={t('bpm.fileHelp')}
            onChange={(row) => refresh(row ?? withoutFile(d, { metrics: null }))} />
          {d.metrics && <MetricsCard metrics={d.metrics} />}
        </div>
        <div className="col-lg-7 order-lg-1">
          <section className="card" aria-labelledby="bpm-diagram">
            <div className="card-header"><h4 className="h4 mb-0" id="bpm-diagram">{t('bpm.diagram')}</h4></div>
            <div className="card-body">
              <EditForm key={formKey} fields={bpmDiagramConfig(t, processes.data).fields} initial={d}
                onSave={(body) => api.update(d.id, body)} onSaved={item.setData} />
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

export const BpmLayout = Layout;
export const BpmOverview = Overview;
export const BpmProcesses = Processes;
export const BpmProcessDetail = ProcessDetail;
export const BpmDiagrams = Diagrams;
export const BpmDiagramDetail = DiagramDetail;
