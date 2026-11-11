// Diagnóstico de dados (qualquer tipo de projeto): inventário preliminar das bases e sistemas, relatório de
// diagnóstico das fontes e fluxos de dados (com avaliação de maturidade) e plano de trabalho para
// implantação de sistema. Cada documento segue o seu modelo; o conteúdo vai inteiro no PATCH.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { dataDiagnosisApi } from '../../api/endpoints.js';
import { AiContextProvider, useAiContext } from '../../components/AiAssist.jsx';
import ExportButtons from '../../components/ExportButtons.jsx';
import { FieldGrid } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import { RowsEditor, SectionLayout, StatCards } from '../../components/sections.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading, Modal } from '../../components/ui.jsx';
import { sameValues, SaveButton, saveShortcut, useUnsavedChanges } from '../../components/unsaved.jsx';
import {
  DD_ENUMS, ddText, DOC_KINDS, GOLIVE_ITEMS, GOVERNANCE_ITEMS, INVENTORY_STEPS, MATURITY_DIMENSIONS, QUALITY_DIMS, RACI_LETTERS,
} from '../../content/dataDiagnosis.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import {
  consolidatedScore, inventoryStats, maturityGaps, maturitySuggestions, newContent, planStats, qualityRowAverage, reportIndicators,
  timeline,
} from '../../lib/dataDiagnosis.js';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';

const base = (project) => `/projects/${project.id}/data-diagnosis`;
const KIND_ICONS = { inventories: 'database', reports: 'clipboard-data', plans: 'calendar-range' };
export const DOC_ROUTE_IDS = { inventories: 'ddInventory', reports: 'ddReport', plans: 'ddPlan' };

// Opções de uma lista, com a primeira em branco ("ainda não escolhido")
const opts = (d, name, blank = true) => [
  ...(blank ? [{ value: '', label: d.common.none }] : []),
  ...DD_ENUMS[name].map((v) => ({ value: v, label: d.options[name][v] })),
];
const fmt1 = (n, locale) => (n == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n));

export function DdLayout() {
  const { t } = useI18n();
  const { project } = useProject();
  return (
    <SectionLayout section="data-diagnosis" base={base(project)} items={[
      ['', t('dd.nav.overview'), 'speedometer2'],
      ['inventories', t('dd.nav.inventories'), KIND_ICONS.inventories],
      ['reports', t('dd.nav.reports'), KIND_ICONS.reports],
      ['plans', t('dd.nav.plans'), KIND_ICONS.plans],
    ]} />
  );
}

// ---------------------------------------------------------------- visão geral
export function DdOverview() {
  const { locale } = useI18n();
  const d = ddText(locale);
  const { project } = useProject();
  const data = useAsync(() => dataDiagnosisApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  const docs = data.data ?? {};
  return (
    <>
      <p className="text-body-secondary">{d.intro}</p>
      <ul className="row g-3 list-unstyled">
        {DOC_KINDS.map((kind) => (
          <li className="col-lg-4" key={kind}>
            <article className="card h-100" aria-labelledby={`dd-${kind}`}>
              <div className="card-body d-flex flex-column">
                <h3 className="h4" id={`dd-${kind}`}>
                  <i className={`bi bi-${KIND_ICONS[kind]} me-2 text-primary`} aria-hidden="true" />{d.kinds[kind].title}
                </h3>
                <p className="small text-body-secondary">{d.kinds[kind].description}</p>
                {(docs[kind] ?? []).length ? (
                  <ul className="list-unstyled small mb-3">
                    {docs[kind].slice(0, 4).map((doc) => (
                      <li key={doc.id} className="mb-1">
                        <Link to={`${base(project)}/${kind}/${doc.id}`} className="fw-semibold">{doc.title}</Link>
                        <span className="text-body-secondary"> · v{doc.version} · {formatDate(doc.updatedAt, locale)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small text-body-secondary">{d.common.noDocs}</p>
                )}
                <div className="mt-auto d-flex flex-wrap gap-2">
                  <Link to={`${base(project)}/${kind}`} className="btn btn-sm btn-outline-primary">
                    {d.kinds[kind].many} ({(docs[kind] ?? []).length})
                  </Link>
                  <Link to={`${base(project)}/${kind}?new=1`} className="btn btn-sm btn-primary">
                    <i className="bi bi-plus-lg me-1" aria-hidden="true" />{d.common.newDoc}
                  </Link>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- lista e criação
function CreateModal({ kind, api, onClose, onCreated }) {
  const { t, locale } = useI18n();
  const d = ddText(locale);
  const id = useId();
  const hasExamples = Object.keys(d.templates[{ inventories: 'inventory', reports: 'report', plans: 'plan' }[kind]].examples).length > 0;
  const [values, setValues] = useState({ title: d.kinds[kind].title, version: '1.0', examples: false });
  const { submit, busy, errors } = useSubmit(
    () => api.create({ title: values.title, version: values.version || '1.0', content: newContent(kind, locale, values.examples) }),
    { onSuccess: onCreated },
  );
  return (
    <Modal title={`${d.common.newDoc}: ${d.kinds[kind].one}`} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </>
      }>
      <form id={`${id}-form`} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <FieldGrid
          fields={[
            { name: 'title', label: d.common.title, required: true, maxLength: 200, col: 'col-md-9' },
            { name: 'version', label: d.common.version, maxLength: 20, col: 'col-md-3' },
            ...(hasExamples ? [{ name: 'examples', label: d.common.withExamples, type: 'checkbox' }] : []),
          ]}
          values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
        {hasExamples && <p className="small text-body-secondary mb-0">{d.common.withExamplesHelp}</p>}
      </form>
    </Modal>
  );
}

export function DdList({ kind }) {
  const { t, locale } = useI18n();
  const d = ddText(locale);
  const toast = useToast();
  const navigate = useNavigate();
  const { project } = useProject();
  const [params, setParams] = useSearchParams();
  const api = useMemo(() => dataDiagnosisApi.docs(project.id, kind), [project.id, kind]);
  const list = useAsync(() => api.list(), [api]);
  const creating = params.get('new') === '1';
  const setCreating = (on) => setParams(on ? { new: '1' } : {}, { replace: true });

  const remove = async (doc) => {
    if (!window.confirm(t('common.confirmDelete', { name: doc.title }))) return;
    try {
      await api.remove(doc.id);
      toast.success(t('common.deleted'));
      list.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="h3 mb-1">{d.kinds[kind].many}</h3>
          <p className="small text-body-secondary mb-0">{d.kinds[kind].description}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{d.common.newDoc}
        </button>
      </div>
      {list.loading && !list.data ? <Loading small /> : !(list.data ?? []).length ? <EmptyState>{d.common.noDocs}</EmptyState> : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <caption className="visually-hidden">{d.kinds[kind].many}</caption>
            <thead>
              <tr>
                <th scope="col">{d.common.title}</th>
                <th scope="col">{d.common.version}</th>
                <th scope="col">{d.common.updatedAt}</th>
                <th scope="col" className="kt-table-actions"><span className="visually-hidden">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((doc) => (
                <tr key={doc.id}>
                  <td><Link to={`${base(project)}/${kind}/${doc.id}`} className="fw-semibold">{doc.title}</Link></td>
                  <td>{doc.version}</td>
                  <td>{formatDate(doc.updatedAt, locale)}</td>
                  <td className="kt-table-actions">
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(doc)}
                      aria-label={`${t('common.delete')} ${doc.title}`}>
                      <i className="bi bi-trash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <CreateModal kind={kind} api={api} onClose={() => setCreating(false)}
          onCreated={(doc) => {
            toast.success(d.common.created);
            navigate(`${base(project)}/${kind}/${doc.id}`);
          }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- peças do editor
function Section({ id, title, help, children, actions }) {
  return (
    <section className="card mb-4 kt-dd-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="card-header d-flex flex-wrap align-items-center gap-2">
        <h3 className="h4 mb-0 me-auto" id={`${id}-h`}>{title}</h3>
        {actions}
      </div>
      <div className="card-body">
        {help && <p className="small text-body-secondary" data-export="skip">{help}</p>}
        {children}
      </div>
    </section>
  );
}

// Campos de texto de uma seção (os textareas ganham o botão de IA do FieldInput)
function TextFields({ fields, values = {}, onChange }) {
  const vals = Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? Boolean(values[f.name]) : (values[f.name] ?? '')]));
  return (
    <FieldGrid fields={fields} values={vals}
      onChange={(name, v) => {
        const f = fields.find((x) => x.name === name);
        const value = f.type === 'number' ? (v === '' ? null : Number(v)) : v;
        onChange({ ...values, [name]: value });
      }} />
  );
}

function Table({ caption, columns, rows, onChange, d, wide = true }) {
  return (
    <RowsEditor caption={caption} columns={columns} rows={rows ?? []} onChange={onChange} addLabel={d.common.addRow}
      empty={d.common.emptyRows} className={wide ? 'kt-dd-table' : ''} />
  );
}

function Checklist({ legend, items, value = {}, onChange, situationLabel }) {
  const id = useId();
  const done = items.filter(([k]) => value[k]?.done).length;
  return (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">{legend} <span className="badge text-bg-light border ms-1">{done}/{items.length}</span></legend>
      <ul className="list-unstyled mb-0 d-grid gap-2">
        {items.map(([key, label]) => (
          <li key={key} className={situationLabel ? 'row g-2 align-items-center' : ''}>
            <div className={`form-check mb-0 ${situationLabel ? 'col-md-6' : ''}`}>
              <input className="form-check-input" type="checkbox" id={`${id}-${key}`} checked={Boolean(value[key]?.done)}
                onChange={(e) => onChange({ ...value, [key]: { ...value[key], done: e.target.checked } })} />
              <label className="form-check-label" htmlFor={`${id}-${key}`}>{label}</label>
            </div>
            {situationLabel && (
              <div className="col-md-6" data-export="skip">
                <input className="form-control form-control-sm" value={value[key]?.situation ?? ''} maxLength={2000}
                  aria-label={`${situationLabel}: ${label}`} placeholder={situationLabel}
                  onChange={(e) => onChange({ ...value, [key]: { ...value[key], situation: e.target.value } })} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

// Índice das seções do documento
function Contents({ items, d }) {
  const id = useId();
  return (
    <nav className="kt-dd-toc card mb-4 kt-no-print" aria-labelledby={id}>
      <div className="card-body py-2">
        <h3 className="h5 mb-2" id={id}>{d.common.contents}</h3>
        {/* os títulos já trazem a numeração do modelo */}
        <ul className="kt-dd-toc-list list-unstyled mb-0">
          {items.map(([anchor, label]) => <li key={anchor}><a href={`#${anchor}`}>{label}</a></li>)}
        </ul>
      </div>
    </nav>
  );
}

// Resumo do documento que acompanha os pedidos de IA (sem passar de ~1.500 caracteres)
function docSummary(kind, c, d) {
  const names = (rows, key = 'name') => (rows ?? []).map((r) => [r.code, r[key]].filter(Boolean).join(' ')).filter(Boolean).join('; ');
  const parts =
    kind === 'inventories'
      ? [c.identification?.organization, names(c.systems) && `${d.inventory.sections.systems}: ${names(c.systems)}`,
          names(c.databases) && `${d.inventory.sections.databases}: ${names(c.databases)}`]
      : kind === 'reports'
        ? [c.identification?.organization, c.identification?.area, c.scope?.objective,
            names(c.sources) && `${d.report.sections.sources}: ${names(c.sources)}`,
            (c.flows ?? []).length && `${d.report.sections.flows}: ${(c.flows ?? []).map((f) => `${f.origin} → ${f.destination} (${f.method || '?'})`).join('; ')}`,
            names(c.problems, 'problem') && `${d.report.sections.problems}: ${names(c.problems, 'problem')}`]
        : [c.identification?.system, c.identification?.areas, c.scope?.objective,
            (c.activities ?? []).length && `${d.plan.sections.activities}: ${(c.activities ?? []).map((a) => a.activity).filter(Boolean).join('; ')}`];
  return parts.filter(Boolean).join('\n').slice(0, 1500);
}

// ---------------------------------------------------------------- editor
const fromDoc = (doc) => ({ title: doc.title ?? '', version: doc.version ?? '', content: doc.content ?? {} });

export function DdEditor({ kind }) {
  const { locale } = useI18n();
  const d = ddText(locale);
  const { docId } = useParams();
  const { project } = useProject();
  const api = useMemo(() => dataDiagnosisApi.docs(project.id, kind), [project.id, kind]);
  const doc = useAsync(() => api.get(docId), [api, docId]);
  useCrumbLabel(DOC_ROUTE_IDS[kind], doc.data?.title);
  if (doc.loading && !doc.data) return <Loading small />;
  if (!doc.data) return <EmptyState>{d.common.noDocs}</EmptyState>;
  return <DocForm key={doc.data.id} kind={kind} api={api} initial={doc.data} onSaved={doc.setData} />;
}

function DocForm({ kind, api, initial, onSaved }) {
  const { t, locale } = useI18n();
  const d = ddText(locale);
  const toast = useToast();
  const id = useId();
  const { project } = useProject();
  const bodyRef = useRef(null);
  const [state, setState] = useState(() => fromDoc(initial));
  const { submit, busy, errors } = useSubmit((body) => api.update(initial.id, body), {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      setState(fromDoc(saved));
      onSaved(saved);
    },
  });
  const dirty = !sameValues(state, fromDoc(initial));
  useUnsavedChanges(dirty);

  const c = state.content;
  const set = (key, value) => setState((s) => ({ ...s, content: { ...s.content, [key]: value } }));

  // IA: contexto do projeto + do documento, lido na hora em que o assistente abre
  const parentAi = useAiContext();
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const ai = useMemo(
    () =>
      parentAi && {
        projectId: parentAi.projectId,
        describe: () =>
          [parentAi.describe?.(), `${d.kinds[kind].title}: ${latest.current.title}`, docSummary(kind, latest.current.content, d)]
            .filter(Boolean)
            .join('\n'),
      },
    [parentAi, kind, d],
  );

  const Body = { inventories: InventoryBody, reports: ReportBody, plans: PlanBody }[kind];
  return (
    <AiContextProvider value={ai}>
      <form noValidate onKeyDown={saveShortcut} onSubmit={(e) => { e.preventDefault(); submit(state); }} aria-labelledby={`${id}-title`}>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <div>
            <p className="small text-uppercase text-body-secondary mb-1">{d.kinds[kind].title}</p>
            <h2 className="h3 mb-0" id={`${id}-title`}>{state.title || d.kinds[kind].one}</h2>
          </div>
          <div className="d-flex flex-wrap gap-2 kt-no-print">
            <ExportButtons targetRef={bodyRef} title={state.title || d.kinds[kind].title}
              subtitle={`${d.kinds[kind].title} · v${state.version || '1.0'} · ${project.name} · ${formatDate(initial.updatedAt, locale)}`} />
            <SaveButton busy={busy} dirty={dirty} />
          </div>
        </div>
        <div className="row mb-2">
          <div className="col-md-9 mb-3">
            <label htmlFor={`${id}-t`} className="form-label fw-semibold">{d.common.title} <span className="text-danger" aria-hidden="true">*</span></label>
            <input id={`${id}-t`} className={`form-control ${errors.title ? 'is-invalid' : ''}`} required maxLength={200} value={state.title}
              aria-invalid={errors.title ? 'true' : undefined} aria-describedby={errors.title ? `${id}-te` : undefined}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} />
            {errors.title && <div className="invalid-feedback d-block" id={`${id}-te`}>{errors.title}</div>}
          </div>
          <div className="col-md-3 mb-3">
            <label htmlFor={`${id}-v`} className="form-label fw-semibold">{d.common.version}</label>
            <input id={`${id}-v`} className="form-control" maxLength={20} value={state.version}
              onChange={(e) => setState((s) => ({ ...s, version: e.target.value }))} />
          </div>
        </div>
        {errors.content && (
          <div className="alert alert-danger" role="alert">{Array.isArray(errors.content) ? errors.content.join(' ') : String(errors.content)}</div>
        )}
        <div ref={bodyRef}>
          <Body c={c} set={set} d={d} locale={locale} />
        </div>
        <div className="kt-dd-savebar kt-no-print">
          <SaveButton busy={busy} dirty={dirty} />
        </div>
      </form>
    </AiContextProvider>
  );
}

// ---------------------------------------------------------------- inventário preliminar
function InventoryBody({ c, set, d }) {
  const s = d.inventory.sections;
  const f = d.inventory.fields;
  const stats = inventoryStats(c);
  return (
    <>
      <StatCards items={Object.entries(d.inventory.stats).map(([k, label]) => [label, stats[k], { systems: 'hdd-stack', databases: 'database', integrations: 'arrow-left-right', manual: 'hand-index', noBackup: 'exclamation-triangle', pending: 'question-circle' }[k]])} />
      <Contents d={d} items={Object.entries(s).map(([k, label]) => [`inv-${k}`, label])} />
      <Section id="inv-identification" title={s.identification} help={d.inventory.help.identification}>
        <TextFields values={c.identification} onChange={(v) => set('identification', v)} fields={[
          { name: 'organization', label: f.organization, maxLength: 300, col: 'col-md-6' },
          { name: 'responsible', label: f.responsible, maxLength: 300, col: 'col-md-6' },
          { name: 'sources', label: f.sources, help: f.sourcesHelp, maxLength: 1000, col: 'col-md-6' },
          { name: 'relatedProject', label: f.relatedProject, help: f.relatedProjectHelp, maxLength: 300, col: 'col-md-6' },
          { name: 'periodStart', label: f.periodStart, type: 'date', col: 'col-md-3' },
          { name: 'periodEnd', label: f.periodEnd, type: 'date', col: 'col-md-3' },
        ]} />
      </Section>
      <Section id="inv-systems" title={s.systems} help={d.inventory.help.systems}>
        <Table d={d} caption={s.systems} rows={c.systems} onChange={(v) => set('systems', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'name', label: f.system, maxLength: 200, minWidth: '10rem' },
          { name: 'purpose', label: f.purpose, type: 'textarea', maxLength: 1000, minWidth: '12rem' },
          { name: 'userAreas', label: f.userAreas, maxLength: 500, minWidth: '9rem' },
          { name: 'vendorType', label: f.vendorType, type: 'select', options: opts(d, 'vendorTypes'), minWidth: '11rem' },
          { name: 'vendor', label: f.vendor, maxLength: 300, minWidth: '10rem' },
          { name: 'hosting', label: f.hosting, type: 'select', options: opts(d, 'hosting'), minWidth: '10rem' },
          { name: 'users', label: f.users, type: 'number', minWidth: '6rem' },
          { name: 'businessOwner', label: f.businessOwner, maxLength: 200, minWidth: '9rem' },
          { name: 'technicalOwner', label: f.technicalOwner, maxLength: 200, minWidth: '9rem' },
          { name: 'status', label: f.status, type: 'select', options: opts(d, 'systemStatus'), minWidth: '10rem' },
          { name: 'criticality', label: f.criticality, type: 'select', options: opts(d, 'criticality'), minWidth: '7rem' },
        ]} />
      </Section>
      <Section id="inv-databases" title={s.databases} help={d.inventory.help.databases}>
        <Table d={d} caption={s.databases} rows={c.databases} onChange={(v) => set('databases', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'name', label: f.base, maxLength: 200, minWidth: '10rem' },
          { name: 'systemCode', label: f.systemCode, maxLength: 100, minWidth: '7rem' },
          { name: 'technology', label: f.technology, maxLength: 200, minWidth: '9rem' },
          { name: 'location', label: f.location, maxLength: 300, minWidth: '9rem' },
          { name: 'volume', label: f.volume, maxLength: 50, minWidth: '6rem' },
          { name: 'contents', label: f.contents, type: 'textarea', maxLength: 1000, minWidth: '12rem' },
          { name: 'personalData', label: f.personalData, type: 'select', options: opts(d, 'yesNo'), minWidth: '8rem' },
          { name: 'backup', label: f.backup, maxLength: 200, minWidth: '8rem' },
          { name: 'documentation', label: f.documentation, type: 'select', options: opts(d, 'documentation'), minWidth: '8rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '9rem' },
        ]} />
      </Section>
      <Section id="inv-integrations" title={s.integrations} help={d.inventory.help.integrations}>
        <Table d={d} caption={s.integrations} rows={c.integrations} onChange={(v) => set('integrations', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'origin', label: f.origin, maxLength: 200, minWidth: '7rem' },
          { name: 'destination', label: f.destination, maxLength: 200, minWidth: '7rem' },
          { name: 'transferred', label: f.transferred, type: 'textarea', maxLength: 1000, minWidth: '12rem' },
          { name: 'method', label: f.method, type: 'select', options: opts(d, 'integrationMethods'), minWidth: '11rem' },
          { name: 'frequency', label: f.frequency, maxLength: 100, minWidth: '7rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '9rem' },
        ]} />
      </Section>
      <Section id="inv-pending" title={s.pending} help={d.inventory.help.pending}>
        <Table d={d} caption={s.pending} rows={c.pending} onChange={(v) => set('pending', v)} columns={[
          { name: 'itemCode', label: f.itemCode, maxLength: 50, minWidth: '6rem' },
          { name: 'question', label: f.question, type: 'textarea', maxLength: 1000, minWidth: '16rem' },
          { name: 'whoCanAnswer', label: f.whoCanAnswer, maxLength: 300, minWidth: '10rem' },
          { name: 'dueDate', label: f.dueDate, type: 'date', minWidth: '9rem' },
        ]} />
        <Checklist legend={d.inventory.stepsTitle} items={INVENTORY_STEPS.map((k) => [k, d.inventory.steps[k]])}
          value={c.nextSteps} onChange={(v) => set('nextSteps', v)} />
      </Section>
      <Section id="inv-notes" title={s.notes}>
        <TextFields values={c} onChange={(v) => set('notes', v.notes)} fields={[
          { name: 'notes', label: f.notes, type: 'textarea', rows: 4, maxLength: 20000 },
        ]} />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- relatório de diagnóstico
function ReportBody({ c, set, d, locale }) {
  const s = d.report.sections;
  const f = d.report.fields;
  const h = d.report.help;
  const ind = reportIndicators(c);
  const score = consolidatedScore(c.maturity);
  const sourceOptions = [{ value: '', label: d.common.none }, ...(c.sources ?? []).filter((x) => x.code).map((x) => ({ value: x.code, label: [x.code, x.name].filter(Boolean).join(' · ') }))];
  const sourceCol = (name) =>
    (c.sources ?? []).some((x) => x.code)
      ? { name, label: f.sourceCode, type: 'select', options: sourceOptions, minWidth: '9rem' }
      : { name, label: f.sourceCode, maxLength: 100, minWidth: '7rem' };

  return (
    <>
      <Contents d={d} items={Object.entries(s).map(([k, label]) => [`rep-${k}`, label])} />
      <Section id="rep-identification" title={s.identification}>
        <TextFields values={c.identification} onChange={(v) => set('identification', v)} fields={[
          { name: 'organization', label: f.organization, maxLength: 300, col: 'col-md-6' },
          { name: 'area', label: f.area, maxLength: 300, col: 'col-md-6' },
          { name: 'responsible', label: f.responsible, maxLength: 300, col: 'col-md-6' },
          { name: 'sponsor', label: f.sponsor, maxLength: 300, col: 'col-md-6' },
          { name: 'team', label: f.team, type: 'textarea', rows: 2, maxLength: 1000 },
          { name: 'periodStart', label: f.periodStart, type: 'date', col: 'col-md-4' },
          { name: 'periodEnd', label: f.periodEnd, type: 'date', col: 'col-md-4' },
          { name: 'classification', label: f.classification, type: 'select', options: opts(d, 'classification', false), col: 'col-md-4' },
        ]} />
        <h4 className="h5 mt-2">{h.revisions}</h4>
        <Table d={d} wide={false} caption={h.revisions} rows={c.revisions} onChange={(v) => set('revisions', v)} columns={[
          { name: 'version', label: f.version, maxLength: 20, width: '7rem' },
          { name: 'date', label: f.date, type: 'date', width: '10rem' },
          { name: 'author', label: f.author, maxLength: 200 },
          { name: 'changes', label: f.changes, maxLength: 1000 },
        ]} />
      </Section>

      <Section id="rep-summary" title={s.summary}>
        <div className="table-responsive mb-3">
          <table className="table table-sm kt-dd-indicators mb-1">
            <caption className="small">{h.indicators}</caption>
            <tbody>
              {[
                ['sources', ind.sources],
                ['flows', ind.flows],
                ['manualPct', `${ind.manualPct}%`],
                ['lgpd', ind.personalData],
                ['critical', ind.criticalProblems],
                ['maturity', fmt1(score, locale)],
              ].map(([k, v]) => (
                <tr key={k}><th scope="row" className="fw-normal">{d.report.indicators[k]}</th><td className="text-end fw-semibold">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextFields values={c.summary} onChange={(v) => set('summary', v)} fields={[
          { name: 'executiveSummary', label: f.executiveSummary, help: h.summary, type: 'textarea', rows: 4, maxLength: 20000 },
          { name: 'keyFindings', label: f.keyFindings, help: f.keyFindingsHelp, type: 'textarea', rows: 4, maxLength: 20000, col: 'col-lg-6' },
          { name: 'priorityRecommendations', label: f.priorityRecommendations, help: f.priorityRecommendationsHelp, type: 'textarea', rows: 4, maxLength: 20000, col: 'col-lg-6' },
        ]} />
      </Section>

      <Section id="rep-scope" title={s.scope}>
        <TextFields values={c.scope} onChange={(v) => set('scope', v)} fields={[
          { name: 'objective', label: f.objective, help: f.objectiveHelp, type: 'textarea', rows: 3, maxLength: 20000 },
          { name: 'included', label: f.included, help: f.includedHelp, type: 'textarea', rows: 3, maxLength: 20000, col: 'col-lg-6' },
          { name: 'excluded', label: f.excluded, help: f.excludedHelp, type: 'textarea', rows: 3, maxLength: 20000, col: 'col-lg-6' },
          ...['documentary', 'interviews', 'technical', 'quality', 'validation'].map((k) => ({
            name: k, label: f[k], help: f[`${k}Help`], type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6',
          })),
          { name: 'assumptions', label: f.assumptions, help: f.assumptionsHelp, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
        ]} />
      </Section>

      <Section id="rep-sources" title={s.sources} help={h.sources}>
        <Table d={d} caption={s.sources} rows={c.sources} onChange={(v) => set('sources', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'name', label: f.source, maxLength: 200, minWidth: '10rem' },
          { name: 'type', label: f.type, type: 'select', options: opts(d, 'sourceTypes'), minWidth: '10rem' },
          { name: 'technology', label: f.technology, maxLength: 200, minWidth: '9rem' },
          { name: 'ownerArea', label: f.ownerArea, maxLength: 200, minWidth: '8rem' },
          { name: 'technicalOwner', label: f.technicalOwner, maxLength: 200, minWidth: '9rem' },
          { name: 'volume', label: f.volume, maxLength: 50, minWidth: '6rem' },
          { name: 'update', label: f.update, maxLength: 100, minWidth: '8rem' },
          { name: 'personalData', label: f.personalData, type: 'select', options: opts(d, 'yesNo'), minWidth: '8rem' },
          { name: 'criticality', label: f.criticality, type: 'select', options: opts(d, 'criticality'), minWidth: '7rem' },
          { name: 'documented', label: f.documented, type: 'select', options: opts(d, 'documentation'), minWidth: '8rem' },
        ]} />
      </Section>

      <Section id="rep-flows" title={s.flows} help={h.flows}>
        <FlowDiagram flows={c.flows ?? []} sources={c.sources ?? []} d={d} />
        <Table d={d} caption={s.flows} rows={c.flows} onChange={(v) => set('flows', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'origin', label: f.origin, maxLength: 200, minWidth: '8rem' },
          { name: 'destination', label: f.destination, maxLength: 200, minWidth: '8rem' },
          { name: 'data', label: f.data, maxLength: 500, minWidth: '10rem' },
          { name: 'method', label: f.method, type: 'select', options: opts(d, 'flowMethods'), minWidth: '11rem' },
          { name: 'frequency', label: f.frequency, maxLength: 100, minWidth: '7rem' },
          { name: 'format', label: f.format, maxLength: 100, minWidth: '6rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '8rem' },
          { name: 'monitored', label: f.monitored, type: 'select', options: opts(d, 'yesNo'), minWidth: '8rem' },
        ]} />
        <TextFields values={c} onChange={(v) => set('flowNotes', v.flowNotes)} fields={[
          { name: 'flowNotes', label: f.flowNotes, type: 'textarea', rows: 3, maxLength: 20000 },
        ]} />
      </Section>

      <Section id="rep-quality" title={s.quality} help={h.quality}>
        <Table d={d} caption={s.quality} rows={c.quality} onChange={(v) => set('quality', v)} columns={[
          sourceCol('sourceCode'),
          ...QUALITY_DIMS.map((k) => ({ name: k, label: d.report.qualityDims[k][0], type: 'score', minWidth: '6rem' })),
          { name: 'avg', label: d.report.average, render: (row) => <span className="fw-semibold">{fmt1(qualityRowAverage(row), locale)}</span> },
          { name: 'evidence', label: f.evidence, type: 'textarea', maxLength: 2000, minWidth: '14rem' },
        ]} />
        <dl className="row small mb-0 kt-dd-defs">
          {QUALITY_DIMS.map((k) => (
            <div className="col-md-6 d-flex gap-1" key={k}>
              <dt>{d.report.qualityDims[k][0]}:</dt>{' '}<dd className="mb-1">{d.report.qualityDims[k][1]}.</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="rep-governance" title={s.governance} help={h.governance}>
        <Checklist legend={s.governance} items={GOVERNANCE_ITEMS.map((k) => [k, d.report.governance[k]])} value={c.governance}
          onChange={(v) => set('governance', v)} situationLabel={f.situation} />
        <h4 className="h5 mt-4">{h.personalData}</h4>
        <Table d={d} caption={h.personalData} rows={c.personalData} onChange={(v) => set('personalData', v)} columns={[
          sourceCol('sourceCode'),
          { name: 'categories', label: f.categories, maxLength: 500, minWidth: '12rem' },
          { name: 'sensitive', label: f.sensitive, type: 'select', options: opts(d, 'yesNo'), minWidth: '8rem' },
          { name: 'legalBasis', label: f.legalBasis, type: 'select', options: opts(d, 'legalBases'), minWidth: '13rem' },
          { name: 'sharedWith', label: f.sharedWith, maxLength: 500, minWidth: '11rem' },
          { name: 'notes', label: f.notes, maxLength: 1000, minWidth: '10rem' },
        ]} />
      </Section>

      <Section id="rep-problems" title={s.problems} help={h.problems}>
        <Table d={d} caption={s.problems} rows={c.problems} onChange={(v) => set('problems', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '5rem' },
          { name: 'problem', label: f.problem, type: 'textarea', maxLength: 2000, minWidth: '15rem' },
          { name: 'affected', label: f.affected, maxLength: 200, minWidth: '7rem' },
          { name: 'impact', label: f.impact, type: 'textarea', maxLength: 1000, minWidth: '13rem' },
          { name: 'probability', label: f.probability, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'severity', label: f.severity, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'evidence', label: f.evidence, maxLength: 1000, minWidth: '10rem' },
        ]} />
      </Section>

      <Section id="rep-actions" title={s.actions} help={h.actions}>
        <Table d={d} caption={s.actions} rows={c.actions} onChange={(v) => set('actions', v)} columns={[
          { name: 'action', label: f.action, type: 'textarea', maxLength: 2000, minWidth: '16rem' },
          { name: 'problems', label: f.problems, maxLength: 200, minWidth: '7rem' },
          { name: 'impact', label: f.actionImpact, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'effort', label: f.effort, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'dueDate', label: f.dueDate, type: 'date', minWidth: '9rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '8rem' },
          { name: 'status', label: f.status, type: 'select', options: opts(d, 'actionStatus'), minWidth: '9rem' },
        ]} />
      </Section>

      <Section id="rep-maturity" title={s.maturity} help={d.maturity.intro}>
        <MaturityAssessment c={c} set={set} d={d} locale={locale} />
      </Section>

      <Section id="rep-conclusion" title={s.conclusion}>
        <TextFields values={c} onChange={(v) => set('conclusion', v.conclusion)} fields={[
          { name: 'conclusion', label: f.conclusion, help: f.conclusionHelp, type: 'textarea', rows: 3, maxLength: 20000 },
        ]} />
        <h4 className="h5">{h.glossary}</h4>
        <Table d={d} wide={false} caption={h.glossary} rows={c.glossary} onChange={(v) => set('glossary', v)} columns={[
          { name: 'term', label: f.term, maxLength: 200, width: '30%' },
          { name: 'definition', label: f.definition, type: 'textarea', maxLength: 2000 },
        ]} />
        <TextFields values={c} onChange={(v) => set('annexes', v.annexes)} fields={[
          { name: 'annexes', label: f.annexes, help: f.annexesHelp, type: 'textarea', rows: 4, maxLength: 20000 },
        ]} />
      </Section>
    </>
  );
}

// Diagrama dos fluxos: origens à esquerda, destinos à direita; tracejado laranja = carga manual
function FlowDiagram({ flows, sources, d }) {
  const id = useId();
  const valid = flows.filter((f) => (f.origin ?? '').trim() && (f.destination ?? '').trim());
  if (!valid.length) return <p className="small text-body-secondary">{d.report.diagram.empty}</p>;
  const nameOf = (code) => {
    const src = sources.find((x) => x.code && x.code === code.trim());
    const label = src?.name ? `${code} · ${src.name}` : code;
    return label.length > 30 ? `${label.slice(0, 29)}…` : label;
  };
  const left = [...new Set(valid.map((f) => f.origin.trim()))];
  const right = [...new Set(valid.map((f) => f.destination.trim()))];
  const ROW = 46;
  const H = Math.max(left.length, right.length) * ROW + 20;
  const W = 640;
  const BOX_W = 200;
  const yOf = (list, key) => 10 + (list.indexOf(key) + 0.5) * ROW + (H - 20 - list.length * ROW) / 2;
  const manual = valid.filter((f) => f.method === 'manual').length;
  const summary = d.report.diagram.summary.replace('{count}', valid.length).replace('{manual}', manual);
  const node = (x, y, label, key) => (
    <g key={key}>
      <rect x={x} y={y - 16} width={BOX_W} height={32} rx="6" className="kt-flow-node" />
      <text x={x + BOX_W / 2} y={y + 4} textAnchor="middle" className="kt-flow-label">{label}</text>
    </g>
  );
  return (
    <figure className="kt-flow mb-3" data-export="skip">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="w-100" style={{ maxHeight: 480 }}>
        <title id={`${id}-t`}>{d.report.diagram.title}</title>
        <desc id={`${id}-d`}>{summary}</desc>
        <defs>
          <marker id={`${id}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="kt-flow-arrow" />
          </marker>
        </defs>
        {valid.map((f, i) => {
          const y1 = yOf(left, f.origin.trim());
          const y2 = yOf(right, f.destination.trim());
          const x1 = BOX_W;
          const x2 = W - BOX_W - 4;
          return (
            <path key={i} d={`M${x1},${y1} C${x1 + 110},${y1} ${x2 - 110},${y2} ${x2},${y2}`} fill="none"
              className={f.method === 'manual' ? 'kt-flow-edge is-manual' : 'kt-flow-edge'} markerEnd={`url(#${id}-a)`} />
          );
        })}
        {left.map((k) => node(0, yOf(left, k), nameOf(k), `l-${k}`))}
        {right.map((k) => node(W - BOX_W, yOf(right, k), nameOf(k), `r-${k}`))}
      </svg>
      <figcaption className="small d-flex flex-wrap gap-3">
        <span><span className="kt-flow-key" aria-hidden="true" />{d.report.diagram.automated}</span>
        <span><span className="kt-flow-key is-manual" aria-hidden="true" />{d.report.diagram.manual}</span>
        <span className="text-body-secondary">{summary}</span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- avaliação de maturidade
function MaturityAssessment({ c, set, d, locale }) {
  const m = d.maturity;
  const toast = useToast();
  const value = c.maturity ?? {};
  const suggestions = maturitySuggestions(c);
  const ind = reportIndicators(c);
  const score = consolidatedScore(value);
  const gaps = maturityGaps(value);
  const setDim = (dim, patch) => set('maturity', { ...value, [dim]: { ...value[dim], ...patch } });
  const levelName = (n) => m.levels[n - 1];
  const shortName = (dim) => m.dimensions[dim].name.split(/[,(]/)[0].trim();
  const indicatorText = (dim) =>
    ({
      sources: ind.sources ? m.indicators.sources.replace('{pct}', ind.ownedPct).replace('{doc}', ind.documentedPct) : null,
      flows: ind.hasMethods ? m.indicators.flows.replace('{pct}', ind.automatedPct).replace('{mon}', ind.monitoredPct) : null,
      quality: ind.qualityAverage == null ? null : m.indicators.quality.replace('{avg}', fmt1(ind.qualityAverage, locale)),
      governance: m.indicators.governance.replace('{done}', ind.governanceDone).replace('{total}', ind.governanceTotal),
      usage: m.indicators.usage,
    })[dim];

  const addGapActions = () => {
    const rows = gaps.map((g) => ({
      action: m.actionText
        .replace('{dimension}', m.dimensions[g.dimension].name)
        .replace('{from}', g.from)
        .replace('{fromName}', levelName(g.from))
        .replace('{to}', g.to)
        .replace('{toName}', levelName(g.to)),
      problems: '',
      impact: g.gap >= 2 ? 'high' : 'medium',
      effort: '',
      dueDate: '',
      owner: '',
      status: 'not_started',
    }));
    set('actions', [...(c.actions ?? []), ...rows]);
    toast.success(m.addActionsDone.replace('{count}', rows.length));
  };

  return (
    <>
      <div className="alert alert-info small" role="note">
        <i className="bi bi-info-circle me-1" aria-hidden="true" />{m.rule}
      </div>
      <ol className="list-unstyled kt-dd-levels small mb-4">
        {m.levels.map((name, i) => (
          <li key={name}><strong>{i + 1}. {name}:</strong> {m.levelsText[i]}.</li>
        ))}
      </ol>

      {MATURITY_DIMENSIONS.map((dim) => (
        <DimensionCard key={dim} dim={dim} m={m} value={value[dim] ?? {}} suggestion={suggestions[dim]} indicator={indicatorText(dim)}
          onChange={(patch) => setDim(dim, patch)} levelName={levelName} />
      ))}

      <h4 className="h5 mt-4">{m.profile}</h4>
      <p className="small text-body-secondary">{m.profileHelp}</p>
      <div className="row g-4 align-items-center">
        <div className="col-lg-5">
          <RadarChart dims={MATURITY_DIMENSIONS} value={value} labels={Object.fromEntries(MATURITY_DIMENSIONS.map((x) => [x, shortName(x)]))} m={m} />
        </div>
        <div className="col-lg-7">
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <caption className="small">{m.profile}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">{m.title}</span></th>
                  <th scope="col" className="text-center">{m.current}</th>
                  <th scope="col" className="text-center">{m.target}</th>
                  <th scope="col" className="text-center">{m.gap}</th>
                  <th scope="col" className="text-center">{m.weight}</th>
                </tr>
              </thead>
              <tbody>
                {MATURITY_DIMENSIONS.map((dim) => {
                  const v = value[dim] ?? {};
                  const gap = Number.isInteger(v.level) && Number.isInteger(v.target) ? v.target - v.level : null;
                  return (
                    <tr key={dim}>
                      <th scope="row" className="fw-normal">{m.dimensions[dim].name}</th>
                      <td className="text-center">{v.level ? `${v.level} · ${levelName(v.level)}` : m.notAssessed}</td>
                      <td className="text-center">{v.target ? `${v.target} · ${levelName(v.target)}` : '—'}</td>
                      <td className="text-center">{gap == null ? '—' : gap > 0 ? `+${gap}` : gap}</td>
                      <td className="text-center">{v.weight ?? 1}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{m.consolidated}</th>
                  <td colSpan={4} className="fw-bold fs-5 text-center">{fmt1(score, locale)}{score != null && ` · ${levelName(Math.floor(score))}`}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={!gaps.length} onClick={addGapActions}>
            <i className="bi bi-list-check me-1" aria-hidden="true" />{m.addActions} ({gaps.length})
          </button>
        </div>
      </div>
      <p className="small text-body-secondary mt-3">{m.cuts}</p>
      <TextFields values={value} onChange={(v) => set('maturity', v)} fields={[
        { name: 'validatedAt', label: m.validatedAt, type: 'date', col: 'col-md-4' },
        { name: 'notes', label: m.notes, help: m.tip, type: 'textarea', rows: 3, maxLength: 20000 },
      ]} />
    </>
  );
}

// Uma dimensão: combobox do nível atual (com a rubrica do nível escolhido), alvo, peso e evidências
function DimensionCard({ dim, m, value, suggestion, indicator, onChange, levelName }) {
  const id = useId();
  const dimText = m.dimensions[dim];
  const option = (n) => `${n} · ${levelName(n)} — ${m.levelsText[n - 1]}`;
  const toLevel = (v) => (v === '' ? null : Number(v));
  return (
    <article className="card mb-3 kt-dd-dimension" aria-labelledby={`${id}-h`}>
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-baseline gap-2 mb-2">
          <h4 className="h5 mb-0" id={`${id}-h`}>{dimText.name}</h4>
          <span className="badge text-bg-light border">{dimText.section}</span>
        </div>
        <div className="row g-3">
          <div className="col-lg-6">
            <label htmlFor={`${id}-level`} className="form-label fw-semibold mb-1">{m.level}</label>
            <select id={`${id}-level`} className="form-select" value={value.level ?? ''} aria-describedby={`${id}-desc`}
              onChange={(e) => onChange({ level: toLevel(e.target.value) })}>
              <option value="">{m.notAssessed}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{option(n)}</option>)}
            </select>
          </div>
          <div className="col-sm-8 col-lg-4">
            <label htmlFor={`${id}-target`} className="form-label fw-semibold mb-1">{m.target}</label>
            <select id={`${id}-target`} className="form-select" value={value.target ?? ''} onChange={(e) => onChange({ target: toLevel(e.target.value) })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{`${n} · ${levelName(n)}`}</option>)}
            </select>
          </div>
          <div className="col-sm-4 col-lg-2">
            <label htmlFor={`${id}-weight`} className="form-label fw-semibold mb-1">{m.weight}</label>
            <input id={`${id}-weight`} type="number" min={0} max={10} step={0.5} className="form-control" value={value.weight ?? 1}
              title={m.weightHelp} aria-describedby={`${id}-wh`}
              onChange={(e) => onChange({ weight: e.target.value === '' ? 1 : Math.min(10, Math.max(0, Number(e.target.value))) })} />
            <span id={`${id}-wh`} className="visually-hidden">{m.weightHelp}</span>
          </div>
        </div>
        <div id={`${id}-desc`} className={`kt-dd-rubric small mt-2 ${value.level ? '' : 'text-body-secondary'}`} aria-live="polite">
          {value.level ? <><strong>{m.selected} ({value.level} · {levelName(value.level)}):</strong> {dimText.rubric[value.level - 1]}</> : m.notAssessed}
        </div>
        <div className="small mt-2 d-flex flex-wrap align-items-center gap-2">
          <i className="bi bi-graph-up text-primary" aria-hidden="true" />
          {indicator && <span>{indicator}</span>}
          {suggestion ? (
            <>
              <span className="fw-semibold">{m.suggestion.replace('{level}', suggestion).replace('{name}', levelName(suggestion))}</span>
              {value.level !== suggestion && (
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onChange({ level: suggestion })}>{m.applySuggestion}</button>
              )}
            </>
          ) : dim !== 'usage' && <span className="text-body-secondary">{m.noSuggestion}</span>}
        </div>
        <details className="small mt-2">
          <summary>{m.rubric}</summary>
          <ol className="mt-2 mb-0 kt-dd-rubric-list">
            {dimText.rubric.map((text, i) => (
              <li key={i} className={value.level === i + 1 ? 'is-selected' : ''}>
                <strong>{levelName(i + 1)}:</strong> {text}
              </li>
            ))}
          </ol>
        </details>
        <div className="mt-3">
          <TextFields values={value} onChange={(v) => onChange({ evidence: v.evidence })} fields={[
            { name: 'evidence', label: m.evidence, help: m.evidenceHelp, type: 'textarea', rows: 2, maxLength: 5000, aiHelp: dimText.rubric.join(' ') },
          ]} />
        </div>
      </div>
    </article>
  );
}

// Radar do perfil de maturidade (atual em área cheia, alvo tracejado); os números estão na tabela ao lado
function RadarChart({ dims, value, labels, m }) {
  const id = useId();
  const R = 110;
  const C = 160;
  const angle = (i) => ((-90 + (360 / dims.length) * i) * Math.PI) / 180;
  const point = (i, level) => [C + Math.cos(angle(i)) * (R * level) / 5, C + Math.sin(angle(i)) * (R * level) / 5];
  const poly = (levels) => levels.map((lv, i) => point(i, lv).join(',')).join(' ');
  const current = dims.map((x) => value[x]?.level ?? 0);
  const target = dims.map((x) => value[x]?.target ?? 0);
  const hasTarget = target.some(Boolean);
  const desc = dims.map((x, i) => `${labels[x]}: ${current[i] || '—'}${target[i] ? ` → ${target[i]}` : ''}`).join('; ');
  return (
    <figure className="mb-0" data-export="skip">
      <svg viewBox="-130 -10 580 340" role="img" aria-labelledby={`${id}-t ${id}-d`} className="w-100 kt-radar">
        <title id={`${id}-t`}>{m.profile}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {[1, 2, 3, 4, 5].map((lv) => <polygon key={lv} points={poly(dims.map(() => lv))} className="kt-radar-ring" />)}
        {dims.map((x, i) => {
          const [x2, y2] = point(i, 5);
          const [lx, ly] = point(i, 6.1);
          return (
            <g key={x}>
              <line x1={C} y1={C} x2={x2} y2={y2} className="kt-radar-axis" />
              <text x={lx} y={ly} textAnchor={Math.abs(lx - C) < 10 ? 'middle' : lx > C ? 'start' : 'end'} dominantBaseline="middle" className="kt-radar-label">{labels[x]}</text>
            </g>
          );
        })}
        {[1, 2, 3, 4, 5].map((lv) => <text key={lv} x={C + 4} y={C - (R * lv) / 5} className="kt-radar-tick">{lv}</text>)}
        {hasTarget && <polygon points={poly(target)} className="kt-radar-target" />}
        <polygon points={poly(current)} className="kt-radar-area" />
        {current.map((lv, i) => lv > 0 && <circle key={i} cx={point(i, lv)[0]} cy={point(i, lv)[1]} r="4" className="kt-radar-dot" />)}
      </svg>
      <figcaption className="small d-flex flex-wrap gap-3 justify-content-center">
        <span><span className="kt-radar-key" aria-hidden="true" />{m.current}</span>
        {hasTarget && <span><span className="kt-radar-key is-target" aria-hidden="true" />{m.target}</span>}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- plano de trabalho
function PlanBody({ c, set, d, locale }) {
  const s = d.plan.sections;
  const f = d.plan.fields;
  const h = d.plan.help;
  const stats = planStats(c);
  const raciOpts = [{ value: '', label: '—' }, ...RACI_LETTERS.map((l) => ({ value: l, label: l }))];
  return (
    <>
      <StatCards items={[
        [d.plan.stats.activities, stats.activities, 'list-task'],
        [d.plan.stats.done, stats.done, 'check2-circle'],
        [d.plan.stats.late, stats.late, 'exclamation-octagon'],
        [d.plan.stats.risks, stats.risks, 'shield-exclamation'],
        [d.plan.stats.goLive, `${stats.goLiveDone}/${stats.goLiveTotal}`, 'rocket-takeoff'],
      ]} />
      <Contents d={d} items={Object.entries(s).map(([k, label]) => [`plan-${k}`, label])} />
      <Section id="plan-identification" title={s.identification} help={h.identification}>
        <TextFields values={c.identification} onChange={(v) => set('identification', v)} fields={[
          { name: 'summary', label: f.summary, help: f.summaryHelp, type: 'textarea', rows: 2, maxLength: 2000 },
          { name: 'system', label: f.system, maxLength: 300, col: 'col-md-6' },
          { name: 'areas', label: f.areas, maxLength: 500, col: 'col-md-6' },
          { name: 'sponsor', label: f.sponsor, maxLength: 300, col: 'col-md-6' },
          { name: 'manager', label: f.manager, maxLength: 300, col: 'col-md-6' },
          { name: 'startDate', label: f.startDate, type: 'date', col: 'col-md-4' },
          { name: 'endDate', label: f.endDate, type: 'date', col: 'col-md-4' },
          { name: 'budget', label: f.budget, type: 'number', min: 0, step: '0.01', col: 'col-md-4' },
          { name: 'replacedSystems', label: f.replacedSystems, maxLength: 500, col: 'col-md-6' },
          { name: 'references', label: f.references, help: f.referencesHelp, maxLength: 1000, col: 'col-md-6' },
        ]} />
      </Section>
      <Section id="plan-scope" title={s.scope}>
        <TextFields values={c.scope} onChange={(v) => set('scope', v)} fields={[
          { name: 'objective', label: f.objective, help: f.objectiveHelp, type: 'textarea', rows: 3, maxLength: 20000 },
          { name: 'modules', label: f.modules, type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6' },
          { name: 'areas', label: f.scopeAreas, type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6' },
          { name: 'integrations', label: f.integrations, help: f.integrationsHelp, type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6' },
          { name: 'dataMigration', label: f.dataMigration, help: f.dataMigrationHelp, type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6' },
          { name: 'training', label: f.training, help: f.trainingHelp, type: 'textarea', rows: 2, maxLength: 5000, col: 'col-lg-6' },
          { name: 'excluded', label: f.excluded, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
          { name: 'assumptions', label: f.assumptions, help: f.assumptionsHelp, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
          { name: 'constraints', label: f.constraints, help: f.constraintsHelp, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
        ]} />
      </Section>
      <Section id="plan-phases" title={s.phases} help={h.phases}>
        <Roadmap value={c.phases ?? {}} onChange={(v) => set('phases', v)} d={d} />
      </Section>
      <Section id="plan-activities" title={s.activities} help={h.activities}>
        <Table d={d} caption={s.activities} rows={c.activities} onChange={(v) => set('activities', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '4.5rem' },
          { name: 'phase', label: f.phase, type: 'select', options: opts(d, 'phases'), minWidth: '11rem' },
          { name: 'activity', label: f.activity, type: 'textarea', maxLength: 500, minWidth: '13rem' },
          { name: 'deliverable', label: f.activityDeliverable, maxLength: 500, minWidth: '10rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '8rem' },
          { name: 'start', label: f.start, type: 'date', minWidth: '9rem' },
          { name: 'end', label: f.end, type: 'date', minWidth: '9rem' },
          { name: 'dependsOn', label: f.dependsOn, maxLength: 100, minWidth: '6rem' },
          { name: 'status', label: f.status, type: 'select', options: opts(d, 'actionStatus'), minWidth: '9rem' },
        ]} />
        <Timeline activities={c.activities ?? []} d={d} locale={locale} />
      </Section>
      <Section id="plan-team" title={s.team}>
        <Table d={d} caption={s.team} rows={c.team} onChange={(v) => set('team', v)} columns={[
          { name: 'role', label: f.role, maxLength: 200, minWidth: '9rem' },
          { name: 'name', label: f.name, maxLength: 200, minWidth: '9rem' },
          { name: 'area', label: f.area, maxLength: 200, minWidth: '8rem' },
          { name: 'dedication', label: f.dedication, maxLength: 50, minWidth: '6rem' },
          { name: 'responsibilities', label: f.responsibilities, type: 'textarea', maxLength: 1000, minWidth: '15rem' },
        ]} />
        <h4 className="h5 mt-3">{h.raci}</h4>
        <Table d={d} wide={false} caption={h.raci} rows={c.raci} onChange={(v) => set('raci', v)} columns={[
          { name: 'deliverable', label: f.raciDeliverable, maxLength: 200, minWidth: '12rem' },
          ...['sponsor', 'manager', 'keyUsers', 'it', 'vendor'].map((k) => ({ name: k, label: d.plan.raciRoles[k], type: 'select', options: raciOpts, minWidth: '5.5rem' })),
        ]} />
      </Section>
      <Section id="plan-risks" title={s.risks}>
        <Table d={d} caption={s.risks} rows={c.risks} onChange={(v) => set('risks', v)} columns={[
          { name: 'code', label: f.code, maxLength: 20, minWidth: '4.5rem' },
          { name: 'risk', label: f.risk, type: 'textarea', maxLength: 1000, minWidth: '12rem' },
          { name: 'probability', label: f.probability, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'impact', label: f.impact, type: 'select', options: opts(d, 'level3'), minWidth: '7rem' },
          { name: 'response', label: f.response, type: 'textarea', maxLength: 2000, minWidth: '14rem' },
          { name: 'owner', label: f.owner, maxLength: 200, minWidth: '8rem' },
          { name: 'trigger', label: f.trigger, maxLength: 500, minWidth: '10rem' },
        ]} />
      </Section>
      <Section id="plan-communication" title={s.communication} help={h.communication}>
        <Table d={d} caption={s.communication} rows={c.communication} onChange={(v) => set('communication', v)} columns={[
          { name: 'meeting', label: f.meeting, maxLength: 200, minWidth: '10rem' },
          { name: 'participants', label: f.participants, maxLength: 500, minWidth: '10rem' },
          { name: 'frequency', label: f.frequency, maxLength: 100, minWidth: '7rem' },
          { name: 'objective', label: f.meetingObjective, type: 'textarea', maxLength: 1000, minWidth: '12rem' },
          { name: 'record', label: f.record, maxLength: 200, minWidth: '8rem' },
        ]} />
        <TextFields values={c} onChange={(v) => { set('changeControl', v.changeControl); set('statusReport', v.statusReport); }} fields={[
          { name: 'changeControl', label: f.changeControl, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
          { name: 'statusReport', label: f.statusReport, help: f.statusReportHelp, type: 'textarea', rows: 2, maxLength: 20000, col: 'col-lg-6' },
        ]} />
      </Section>
      <Section id="plan-acceptance" title={s.acceptance}>
        <TextFields values={c} onChange={(v) => set('acceptanceCriteria', v.acceptanceCriteria)} fields={[
          { name: 'acceptanceCriteria', label: f.acceptanceCriteria, help: f.acceptanceCriteriaHelp, type: 'textarea', rows: 3, maxLength: 20000 },
        ]} />
        <Checklist legend={h.goLive} items={GOLIVE_ITEMS.map((k) => [k, d.plan.goLive[k]])} value={c.goLive} onChange={(v) => set('goLive', v)} />
      </Section>
      <Section id="plan-approvals" title={s.approvals}>
        <Table d={d} wide={false} caption={s.approvals} rows={c.approvals} onChange={(v) => set('approvals', v)} columns={[
          { name: 'role', label: f.role, maxLength: 200 },
          { name: 'name', label: f.name, maxLength: 200 },
          { name: 'date', label: f.date, type: 'date', width: '11rem' },
          { name: 'signature', label: f.signature, render: () => <span className="kt-dd-signature" aria-hidden="true" /> },
        ]} />
      </Section>
    </>
  );
}

// Roteiro das 7 fases com as 3 aprovações formais (depois do planejamento, dos testes e do treinamento)
function Roadmap({ value, onChange, d }) {
  const f = d.plan.fields;
  const GATE_AFTER = { planning: 'planning', testing: 'testing', training: 'training' };
  const setPhase = (phase, patch) => onChange({ ...value, [phase]: { ...value[phase], ...patch } });
  return (
    <>
    <table className="d-none">
      <thead><tr><th>{f.phase}</th><th>{f.deliverable}</th><th>{f.start}</th><th>{f.end}</th></tr></thead>
      <tbody>
        {DD_ENUMS.phases.flatMap((phase) => [
          <tr key={phase}>
            <td>{d.options.phases[phase]}</td><td>{value[phase]?.deliverable ?? ''}</td>
            <td><input type="date" readOnly value={value[phase]?.start ?? ''} /></td><td><input type="date" readOnly value={value[phase]?.end ?? ''} /></td>
          </tr>,
          GATE_AFTER[phase] && <tr key={`${phase}-gate`}><td>◆ {d.plan.gates[GATE_AFTER[phase]]}</td><td /><td /><td /></tr>,
        ])}
      </tbody>
    </table>
    <ol className="list-unstyled kt-roadmap mb-0" data-export="skip">
      {DD_ENUMS.phases.map((phase) => {
        const v = value[phase] ?? {};
        const name = d.options.phases[phase];
        return (
          <li key={phase}>
            <div className={`kt-roadmap-phase ${phase === 'golive' ? 'is-golive' : ''}`}>
              <div className="row g-2 align-items-end">
                <div className="col-lg-3"><strong>{name}</strong></div>
                <div className="col-lg-5">
                  <label className="visually-hidden" htmlFor={`rm-${phase}-d`}>{`${f.deliverable}: ${name}`}</label>
                  <input id={`rm-${phase}-d`} className="form-control form-control-sm" maxLength={500} placeholder={f.deliverable}
                    value={v.deliverable ?? ''} onChange={(e) => setPhase(phase, { deliverable: e.target.value })} />
                </div>
                <div className="col-6 col-lg-2">
                  <label className="small text-body-secondary" htmlFor={`rm-${phase}-s`}>{f.start}<span className="visually-hidden">: {name}</span></label>
                  <input id={`rm-${phase}-s`} type="date" className="form-control form-control-sm" value={v.start ?? ''} onChange={(e) => setPhase(phase, { start: e.target.value })} />
                </div>
                <div className="col-6 col-lg-2">
                  <label className="small text-body-secondary" htmlFor={`rm-${phase}-e`}>{f.end}<span className="visually-hidden">: {name}</span></label>
                  <input id={`rm-${phase}-e`} type="date" className="form-control form-control-sm" value={v.end ?? ''} onChange={(e) => setPhase(phase, { end: e.target.value })} />
                </div>
              </div>
            </div>
            {GATE_AFTER[phase] && (
              <div className="kt-roadmap-gate small fw-semibold">
                <i className="bi bi-diamond-fill me-2" aria-hidden="true" />{d.plan.gates[GATE_AFTER[phase]]}
              </div>
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}

// Cronograma (Gantt simples) das atividades com início e fim; as datas também ficam em texto
function Timeline({ activities, d, locale }) {
  const tl = timeline(activities);
  if (!tl.rows.length) return <p className="small text-body-secondary mt-2 mb-0">{d.plan.timeline.empty}</p>;
  const date = (ms) => formatDate(new Date(ms).toISOString().slice(0, 10), locale);
  return (
    <div className="table-responsive mt-3">
      <table className="table table-sm align-middle kt-gantt mb-0">
        <caption className="small">{d.plan.timeline.title}: {date(tl.min)} – {date(tl.max)}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: '30%' }}>{d.plan.fields.activity}</th>
            <th scope="col" style={{ width: '20%' }}>{d.plan.fields.start} – {d.plan.fields.end}</th>
            <th scope="col"><span className="visually-hidden">{d.plan.timeline.title}</span></th>
          </tr>
        </thead>
        <tbody>
          {tl.rows.map((r) => (
            <tr key={r.index}>
              <th scope="row" className="fw-normal small">{[r.code, r.activity].filter(Boolean).join(' · ')}</th>
              <td className="small text-nowrap">{date(r.s)} – {date(r.e)}</td>
              <td>
                <div className="kt-gantt-track" aria-hidden="true">
                  <span className={`kt-gantt-bar is-${r.status || 'not_started'}`} style={{ left: `${r.left}%`, width: `${Math.min(r.width, 100 - r.left)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
