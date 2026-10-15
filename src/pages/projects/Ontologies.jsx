// Ontologias: catálogo do projeto com métricas, vocabulários, princípios e o arquivo publicado
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ontologiesApi, resourceApi } from '../../api/endpoints.js';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { EditForm, FileCard, SectionLayout, StatCards, withoutFile } from '../../components/sections.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { Loading } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';
import { badge, ONTOLOGY_FILES, ontologyConfig, ontologyFields } from './resources.jsx';

const base = (project) => `/projects/${project.id}/ontologies`;

function Layout() {
  const { project } = useProject();
  return <SectionLayout section="ontologies" base={base(project)} />;
}

function Usage({ title, counts, enumName }) {
  const { t } = useI18n();
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <p className="mb-2">
      <span className="small text-body-secondary me-2">{title}:</span>
      {entries.map(([key, n]) => (
        <span key={key} className="badge text-bg-light border me-1">{t(`enums.${enumName}.${key}`)} · {n}</span>
      ))}
    </p>
  );
}

function Catalog() {
  const { t } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const summary = useAsync(() => ontologiesApi.summary(project.id), [project.id, version]);
  const s = summary.data;
  return (
    <>
      <p className="text-body-secondary">{t('on.intro')}</p>
      {s && (
        <>
          <StatCards items={[
            [t('on.summary.total'), s.total, 'diagram-2'],
            [t('on.summary.published'), s.published, 'globe'],
            [t('on.summary.withFile'), s.withFile, 'file-earmark-code'],
            ...['classCount', 'relationshipCount', 'propertyCount', 'objectCount'].map((k) => [t(`on.summary.${k}`), s.totals[k].toLocaleString()]),
          ]} />
          <Usage title={t('on.vocabularies')} counts={s.vocabularies} enumName="vocabulary" />
          <Usage title={t('on.principles')} counts={s.principles} enumName="principle" />
        </>
      )}
      <div className="mt-3">
        <ResourceManager
          path={base(project)}
          {...ontologyConfig(t)}
          rowLink={(r) => `${base(project)}/${r.id}`}
          onChange={() => setVersion((v) => v + 1)}
          afterCreate={(row) => navigate(`${base(project)}/${row.id}`)}
        />
      </div>
    </>
  );
}

// Métricas do arquivo × cadastradas, com a opção de usar as do arquivo
const COUNT_ROWS = [
  ['classes', 'classCount'],
  ['objectProperties', 'relationshipCount'],
  ['datatypeProperties', 'propertyCount'],
  ['individuals', 'objectCount'],
];

function AnalysisCard({ analysis, record, onApply }) {
  const { t } = useI18n();
  const a = analysis;
  const differs = a.suggested && COUNT_ROWS.some(([, f]) => a.suggested[f] !== record[f]);
  return (
    <section className="card mb-4" aria-labelledby="on-analysis">
      <div className="card-header"><h3 className="h4 mb-0" id="on-analysis">{t('on.analysis')}</h3></div>
      <div className="card-body">
        <p className="small text-body-secondary">{t('on.analysisIntro')}</p>
        <dl className="row small mb-2">
          <dt className="col-sm-4">{t('on.format')}</dt>
          <dd className="col-sm-8">{t(`enums.ontologyFormat.${a.format}`)}</dd>
          {a.iri && (<><dt className="col-sm-4">{t('on.iri')}</dt><dd className="col-sm-8 text-break">{a.iri}</dd></>)}
          {a.version && (<><dt className="col-sm-4">{t('on.version')}</dt><dd className="col-sm-8">{a.version}</dd></>)}
          <dt className="col-sm-4">{t('on.detectedVocabularies')}</dt>
          <dd className="col-sm-8">
            {a.vocabularies.length ? a.vocabularies.map((v) => <span key={v} className="badge text-bg-light border me-1">{t(`enums.vocabulary.${v}`)}</span>) : '—'}
          </dd>
        </dl>
        {a.counts ? (
          <>
            <table className="table table-sm mb-2">
              <thead>
                <tr><th scope="col">{t('on.metrics')}</th><th scope="col" className="text-end">{t('on.detected')}</th><th scope="col" className="text-end">{t('on.current')}</th></tr>
              </thead>
              <tbody>
                {COUNT_ROWS.map(([key, field]) => (
                  <tr key={key}>
                    <td>{t(`on.${field}`)}</td>
                    <td className="text-end fw-semibold">{a.counts[key].toLocaleString()}</td>
                    <td className={`text-end ${record[field] !== a.counts[key] ? 'text-warning-emphasis' : ''}`}>{record[field]?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
                <tr><td>{t('on.annotationProperties')}</td><td className="text-end">{a.counts.annotationProperties}</td><td /></tr>
                <tr><td>{t('on.subClassOf')}</td><td className="text-end">{a.counts.subClassOf}</td><td /></tr>
              </tbody>
            </table>
            {differs && (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onApply}>
                <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />{t('on.applyCounts')}
              </button>
            )}
          </>
        ) : (
          <p className="small mb-0">{t('on.noCounts')}</p>
        )}
      </div>
    </section>
  );
}

function Detail() {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const { ontologyId } = useParams();
  const api = useMemo(() => resourceApi(base(project)), [project]);
  const item = useAsync(() => api.get(ontologyId), [project.id, ontologyId]);
  const [formKey, setFormKey] = useState(0); // remonta o formulário quando o arquivo preenche campos
  useCrumbLabel('ontology', item.data?.title);
  if (item.loading && !item.data) return <Loading small />;
  if (!item.data) return null;
  const o = item.data;

  const refresh = (row) => {
    item.setData(row);
    setFormKey((k) => k + 1);
  };
  const applyCounts = async () => {
    try {
      refresh(await api.update(o.id, o.analysis.suggested));
      toast.success(t('on.applied'));
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <article>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="h2 mb-1">{o.title}</h3>
          {badge(t(`enums.ontologyStatus.${o.status}`), o.status === 'published' ? 'text-bg-success' : undefined)}
          {o.format && <span className="ms-1">{badge(t(`enums.ontologyFormat.${o.format}`))}</span>}
          {o.version && <span className="ms-1">{badge(`v${o.version}`)}</span>}
        </div>
        {o.publicationUrl && (
          <a href={o.publicationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />{t('on.openPublication')}
          </a>
        )}
      </div>
      <div className="row g-4">
        <div className="col-lg-7">
          <section className="card" aria-labelledby="on-details">
            <div className="card-header"><h3 className="h4 mb-0" id="on-details">{t('on.details')}</h3></div>
            <div className="card-body">
              <EditForm key={formKey} fields={ontologyFields(t)} initial={o} onSave={(body) => api.update(o.id, body)} onSaved={item.setData} />
            </div>
          </section>
        </div>
        <div className="col-lg-5">
          <FileCard
            itemPath={`${base(project)}/${o.id}`}
            record={o}
            accept={ONTOLOGY_FILES}
            onChange={(row) => refresh(row ?? withoutFile(o, { analysis: null }))}
          />
          {o.analysis && <AnalysisCard analysis={o.analysis} record={o} onApply={applyCounts} />}
        </div>
      </div>
    </article>
  );
}

export const OnLayout = Layout;
export const OnCatalog = Catalog;
export const OnDetail = Detail;
