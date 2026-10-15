// Scrum (Guia do Scrum 2020): dados gerais, papéis, Product/Sprint Backlog, sprints com tasks,
// eventos e artefatos com seus compromissos (Meta do Produto, Meta da Sprint, Definição de Pronto).
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { resourceApi, scrumApi } from '../../api/endpoints.js';
import { BurndownChart, VelocityChart } from '../../components/charts.jsx';
import { FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { EditForm, RowsEditor, SectionLayout, StatCards } from '../../components/sections.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading, Modal } from '../../components/ui.jsx';
import { saveShortcut } from '../../components/unsaved.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';
import { badge, ENUMS, opts } from './resources.jsx';

const base = (project) => `/projects/${project.id}/scrum`;
const res = (project, r) => resourceApi(`${base(project)}/${r}`);
const byId = (rows) => Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
const ROLE_COLORS = { product_owner: '#0189b6', scrum_master: '#d96a04', developer: '#11866a', stakeholder: '#6c757d' };
const EVENT_COLORS = { planning: '#0189b6', daily: '#0c8d8b', review: '#d96a04', retrospective: '#6f42c1', refinement: '#11866a' };
const ITEM_STATUS_BADGE = { new: 'text-bg-light border', ready: 'text-bg-primary', in_progress: 'text-bg-warning', done: 'text-bg-success' };
const SPRINT_STATUS_BADGE = { planned: 'text-bg-light border', active: 'text-bg-primary', completed: 'text-bg-success', cancelled: 'text-bg-secondary' };
const toNumber = (v) => (v == null || v === '' ? null : Number(v));

// Membros, sprints e itens do backlog, com um único recarregar
function useScrumData(project) {
  const [version, setVersion] = useState(0);
  const deps = [project.id, version];
  const members = useAsync(() => res(project, 'members').list(), deps);
  const sprints = useAsync(() => res(project, 'sprints').list(), deps);
  const items = useAsync(() => res(project, 'items').list(), deps);
  return {
    members: members.data,
    sprints: sprints.data,
    items: items.data,
    ready: Boolean(members.data && sprints.data && items.data),
    reload: () => setVersion((v) => v + 1),
  };
}

function Layout() {
  const { t } = useI18n();
  const { project } = useProject();
  const items = [
    ['', 'overview', 'speedometer2'], ['project', 'project', 'people'], ['backlog', 'backlog', 'list-ol'],
    ['sprints', 'sprints', 'arrow-repeat'], ['events', 'events', 'calendar-event'], ['artifacts', 'artifacts', 'box-seam'],
  ].map(([path, key, icon]) => [path, t(`scrum.nav.${key}`), icon]);
  return <SectionLayout section="scrum" base={base(project)} items={items} />;
}

const sprintLabel = (s) => `Sprint ${s.number}${s.name ? ` · ${s.name}` : ''}`;

// ---------- Visão geral ----------
function Overview() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => scrumApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const o = data.data;
  const cs = o.currentSprint;
  const pct = cs && cs.points ? Math.round((cs.donePoints / cs.points) * 100) : 0;
  return (
    <>
      <p className="text-body-secondary">{t('scrum.intro')}</p>
      <StatCards items={[
        [t('scrum.counts.members'), o.counts.members, 'people'],
        [t('scrum.counts.sprints'), o.counts.sprints, 'arrow-repeat'],
        [t('scrum.counts.productBacklog'), o.counts.productBacklog, 'list-ol'],
        [t('scrum.counts.productBacklogPoints'), o.counts.productBacklogPoints, '123'],
        [t('scrum.averageVelocity'), o.averageVelocity ?? '—', 'speedometer'],
      ]} />
      <div className="row g-4 mb-4">
        <div className="col-lg-5">
          <section className="kt-count-panel" style={{ '--acc': '#b4410c' }}>
            <h3>{t('scrum.currentSprint')}</h3>
            {!cs ? <p className="text-body-secondary">{t('scrum.noSprint')}</p> : (
              <div className="p-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <Link to={`${base(project)}/sprints/${cs.id}`} className="fw-semibold">{sprintLabel(cs)}</Link>
                  {badge(t(`enums.sprintStatus.${cs.status}`), SPRINT_STATUS_BADGE[cs.status])}
                </div>
                <p className="small text-body-secondary mb-2">
                  {cs.startDate ? formatDate(cs.startDate, locale) : '—'} → {cs.endDate ? formatDate(cs.endDate, locale) : '—'}
                </p>
                <p className="mb-2"><strong>{t('scrum.goal')}:</strong> {cs.goal || t('scrum.notDefined')}</p>
                <div className="d-flex justify-content-between small"><span>{t('scrum.pointsDone', { done: cs.donePoints, total: cs.points })}</span><span>{pct}%</span></div>
                <div className="progress kt-progress mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('scrum.pointsDone', { done: cs.donePoints, total: cs.points })}>
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {['todo', 'in_progress', 'done'].map((st) => (
                    <span key={st} className="kt-tile-chip">{t(`enums.taskStatus.${st}`)}: {cs.tasks[st]}</span>
                  ))}
                  <span className="kt-tile-chip is-muted">{t('scrum.remainingHours')}: {cs.remainingHours}</span>
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="col-lg-7">
          {cs?.burndown?.total ? (
            <BurndownChart burndown={cs.burndown} title={`${t('scrum.burndown')} · ${sprintLabel(cs)}`} />
          ) : (
            <p className="text-body-secondary">{t('scrum.burndownEmpty')}</p>
          )}
        </div>
      </div>
      {o.velocity.length ? (
        <VelocityChart velocity={o.velocity} title={t('scrum.velocity')} />
      ) : (
        <p className="text-body-secondary">{t('scrum.velocityEmpty')}</p>
      )}
    </>
  );
}

// ---------- Projeto e papéis ----------
const SETTINGS_FIELDS = [
  { name: 'vision', label: 'scrum.vision', type: 'textarea', rows: 2 },
  { name: 'productGoal', label: 'scrum.productGoal', type: 'textarea', rows: 2 },
  { name: 'definitionOfReady', label: 'scrum.definitionOfReady', type: 'textarea', rows: 3, col: 'col-md-6' },
  { name: 'definitionOfDone', label: 'scrum.definitionOfDone', type: 'textarea', rows: 3, col: 'col-md-6' },
  { name: 'sprintLengthDays', label: 'scrum.sprintLengthDays', type: 'integer', min: 1, max: 31, col: 'col-md-4' },
  { name: 'startDate', label: 'scrum.startDate', type: 'date', col: 'col-md-4' },
  { name: 'workingAgreements', label: 'scrum.workingAgreements', type: 'textarea', rows: 2 },
  { name: 'notes', label: 'scrum.notes', type: 'textarea', rows: 2 },
];

function memberConfig(t) {
  return {
    singular: 'scrum.member',
    fields: [
      { name: 'name', label: 'scrum.memberName', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'role', label: 'scrum.role', type: 'select', required: true, options: opts(t, 'scrumRole'), default: 'developer', col: 'col-md-6' },
      { name: 'email', label: 'scrum.email', type: 'text', maxLength: 254, col: 'col-md-6' },
      { name: 'capacityHours', label: 'scrum.capacityHours', type: 'integer', min: 0, col: 'col-md-3' },
      { name: 'active', label: 'scrum.active', type: 'checkbox', default: true, col: 'col-md-3 pt-md-4' },
      { name: 'responsibilities', label: 'scrum.responsibilities', type: 'textarea', rows: 2, maxLength: 5000 },
    ],
    columns: [
      { key: 'name', label: 'scrum.memberName' },
      { key: 'role', label: 'scrum.role', render: (r) => <span className="kt-tile-chip" style={{ '--sec': ROLE_COLORS[r.role] }}>{t(`enums.scrumRole.${r.role}`)}</span> },
      { key: 'email', label: 'scrum.email' },
      { key: 'capacityHours', label: 'scrum.capacityHours', render: (r) => r.capacityHours ?? '—' },
      { key: 'active', label: 'scrum.active', render: (r) => t(r.active ? 'common.yes' : 'common.no') },
    ],
    nameOf: (r) => r.name,
  };
}

function ProjectPage() {
  const { t } = useI18n();
  const { project } = useProject();
  const settings = useAsync(() => scrumApi.settings(project.id), [project.id]);
  const members = useAsync(() => res(project, 'members').list(), [project.id]);
  const roles = Object.keys(ROLE_COLORS);
  return (
    <>
      <ul className="row g-3 list-unstyled mb-4">
        {roles.map((role) => (
          <li className="col-sm-6 col-xl-3" key={role}>
            <article className="kt-tile is-available" style={{ '--sec': ROLE_COLORS[role] }}>
              <header>
                <span className="kt-tile-icon"><i className={`bi bi-${{ product_owner: 'person-badge', scrum_master: 'person-gear', developer: 'code-slash', stakeholder: 'people' }[role]}`} aria-hidden="true" /></span>
                <h3 className="h4 mb-0">{t(`enums.scrumRole.${role}`)}</h3>
                <span className="kt-tile-tag">{(members.data ?? []).filter((m) => m.role === role && m.active).length}</span>
              </header>
              <div className="kt-tile-body"><p className="mb-0">{t(`scrum.roleText.${role}`)}</p></div>
            </article>
          </li>
        ))}
      </ul>
      <h3 className="h3">{t('scrum.team')}</h3>
      <ResourceManager path={`${base(project)}/members`} {...memberConfig(t)} onChange={members.reload} />
      <section className="card mt-4" aria-labelledby="sc-settings">
        <div className="card-header"><h3 className="h4 mb-0" id="sc-settings">{t('scrum.settings')}</h3></div>
        <div className="card-body">
          {settings.loading && !settings.data ? <Loading small /> : settings.data && (
            <EditForm fields={SETTINGS_FIELDS} initial={settings.data}
              onSave={(body) => scrumApi.updateSettings(project.id, body)} onSaved={settings.setData} />
          )}
        </div>
      </section>
    </>
  );
}

// ---------- Product Backlog ----------
function itemFields(t, sprints = []) {
  return [
    { name: 'code', label: 'scrum.code', required: true, maxLength: 20, help: 'scrum.codeHelp', col: 'col-md-3' },
    { name: 'title', label: 'scrum.title', required: true, maxLength: 200, col: 'col-md-9' },
    { name: 'type', label: 'scrum.itemType', type: 'select', required: true, options: opts(t, 'itemType'), default: 'story', col: 'col-md-3' },
    { name: 'storyPoints', label: 'scrum.storyPoints', type: 'select', col: 'col-md-3',
      options: [0, 1, 2, 3, 5, 8, 13, 21, 40, 100].map((n) => ({ value: String(n), label: String(n) })) },
    { name: 'businessValue', label: 'scrum.businessValue', type: 'integer', min: 0, max: 100, col: 'col-md-3' },
    { name: 'status', label: 'scrum.status', type: 'select', required: true, options: opts(t, 'itemStatus'), default: 'new', col: 'col-md-3' },
    { name: 'sprintId', label: 'scrum.sprint', type: 'select', options: sprints.map((s) => ({ value: s.id, label: sprintLabel(s) })), col: 'col-md-6' },
    { name: 'description', label: 'scrum.description', type: 'textarea', rows: 3 },
    { name: 'acceptanceCriteria', label: 'scrum.acceptanceCriteria', type: 'textarea', rows: 3 },
  ];
}
const itemTransform = (p) => ({ ...p, storyPoints: toNumber(p.storyPoints) });

// Modal de criação/edição reaproveitado pelo backlog e pela sprint
function FormModal({ title, fields, initial, transform = (p) => p, onSave, onClose, onSaved, onDelete, children, extra = (p) => p }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState(() => toFormValues(fields, initial ?? {}));
  const { submit, busy, errors } = useSubmit(onSave, {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      onSaved(saved);
    },
  });
  return (
    <Modal title={title} onClose={onClose} size="modal-lg"
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-outline-danger me-auto" onClick={onDelete}>
              <i className="bi bi-trash me-1" aria-hidden="true" />{t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-scrum-form" className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </>
      }>
      <form id="kt-scrum-form" noValidate onKeyDown={saveShortcut}
        onSubmit={(e) => { e.preventDefault(); submit(extra(transform(toPayload(fields, values, t)))); }}>
        <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
        {children}
      </form>
    </Modal>
  );
}

function Backlog() {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const data = useScrumData(project);
  const [view, setView] = useState('open');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  if (!data.ready) return <Loading small />;
  const sprints = byId(data.sprints);
  const openSprints = data.sprints.filter((s) => ['planned', 'active'].includes(s.status));
  const all = data.items;
  const visible = all.filter((i) => (view === 'open' ? !i.sprintId && i.status !== 'done' : view === 'done' ? i.status === 'done' : true));
  const api = res(project, 'items');
  const run = async (fn) => {
    try {
      await fn();
      data.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };
  // a ordem é global: mover para o lugar do vizinho visível
  const move = (item, d) => run(() => scrumApi.moveItem(project.id, item.id, all.indexOf(visible[visible.indexOf(item) + d])));
  const remove = (item) => window.confirm(t('common.confirmDelete', { name: item.code })) && run(() => api.remove(item.id));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="btn-group" role="group" aria-label={t('common.filter')}>
          {['open', 'done', 'all'].map((v) => (
            <button key={v} type="button" className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={view === v} onClick={() => setView(v)}>{t(`scrum.backlogView.${v}`)}</button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('scrum.newItem')}
        </button>
      </div>
      {!visible.length ? <EmptyState>{t('scrum.emptyBacklog')}</EmptyState> : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th scope="col">{t('scrum.order')}</th><th scope="col">{t('scrum.code')}</th><th scope="col">{t('scrum.title')}</th>
                <th scope="col">{t('scrum.itemType')}</th><th scope="col">{t('scrum.storyPoints')}</th>
                <th scope="col">{t('scrum.status')}</th><th scope="col">{t('scrum.sprint')}</th>
                <th scope="col" className="kt-table-actions"><span className="visually-hidden">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it, i) => (
                <tr key={it.id}>
                  <td className="text-nowrap">
                    <span className="fw-semibold me-1">{i + 1}</span>
                    {view === 'open' && (
                      <>
                        <button type="button" className="btn btn-sm btn-link px-1" disabled={i === 0} onClick={() => move(it, -1)}
                          aria-label={`${t('scrum.moveUp')}: ${it.code}`} title={t('scrum.moveUp')}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
                        <button type="button" className="btn btn-sm btn-link px-1" disabled={i === visible.length - 1} onClick={() => move(it, 1)}
                          aria-label={`${t('scrum.moveDown')}: ${it.code}`} title={t('scrum.moveDown')}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
                      </>
                    )}
                  </td>
                  <td className="fw-semibold">{it.code}</td>
                  <td>{it.title}{it.businessValue != null && <div className="small text-body-secondary">{t('scrum.businessValue')}: {it.businessValue}</div>}</td>
                  <td>{t(`enums.itemType.${it.type}`)}</td>
                  <td>{it.storyPoints ?? '—'}</td>
                  <td>{badge(t(`enums.itemStatus.${it.status}`), ITEM_STATUS_BADGE[it.status])}</td>
                  <td>
                    {it.sprintId ? <Link to={`${base(project)}/sprints/${it.sprintId}`}>{sprints[it.sprintId] ? `S${sprints[it.sprintId].number}` : '—'}</Link> : (
                      openSprints.length > 0 && it.status !== 'done' && (
                        <select className="form-select form-select-sm" value="" aria-label={`${t('scrum.toSprint')} ${it.code}`}
                          onChange={(e) => e.target.value && run(() => api.update(it.id, { sprintId: e.target.value }))}>
                          <option value="">{t('scrum.toSprint')}</option>
                          {openSprints.map((s) => <option key={s.id} value={s.id}>{sprintLabel(s)}</option>)}
                        </select>
                      )
                    )}
                  </td>
                  <td className="kt-table-actions">
                    <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setEditing(it)}
                      aria-label={`${t('common.edit')} ${it.code}`}><i className="bi bi-pencil" aria-hidden="true" /></button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(it)}
                      aria-label={`${t('common.delete')} ${it.code}`}><i className="bi bi-trash" aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <FormModal
          title={`${editing === 'new' ? t('common.new') : t('common.edit')}: ${t('scrum.item')}`}
          fields={itemFields(t, data.sprints)}
          initial={editing === 'new' ? {} : editing}
          transform={itemTransform}
          onSave={(body) => (editing === 'new' ? api.create(body) : api.update(editing.id, body))}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); data.reload(); }}
        />
      )}
    </>
  );
}

// ---------- Sprints ----------
function sprintFields(t) {
  return [
    { name: 'number', label: 'scrum.sprintNumber', type: 'integer', required: true, min: 1, col: 'col-md-2' },
    { name: 'name', label: 'scrum.sprintName', maxLength: 200, col: 'col-md-6' },
    { name: 'status', label: 'scrum.status', type: 'select', required: true, options: opts(t, 'sprintStatus'), default: 'planned', col: 'col-md-4' },
    { name: 'goal', label: 'scrum.goal', type: 'textarea', rows: 2, maxLength: 5000 },
    { name: 'startDate', label: 'scrum.startDate', type: 'date', col: 'col-md-6' },
    { name: 'endDate', label: 'scrum.endDate', type: 'date', col: 'col-md-6' },
    { name: 'increment', label: 'scrum.increment', type: 'textarea', rows: 2 },
    { name: 'incrementVersion', label: 'scrum.incrementVersion', maxLength: 50, col: 'col-md-4' },
    { name: 'incrementUrl', label: 'scrum.incrementUrl', type: 'url', maxLength: 1000, col: 'col-md-8' },
    { name: 'notes', label: 'scrum.notes', type: 'textarea', rows: 2 },
  ];
}

function Sprints() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const sprints = useAsync(() => res(project, 'sprints').list(), [project.id]);
  if (sprints.loading && !sprints.data) return <Loading small />;
  const next = Math.max(0, ...(sprints.data ?? []).map((s) => s.number)) + 1;
  const fields = sprintFields(t).map((f) => (f.name === 'number' ? { ...f, default: String(next) } : f));
  return (
    <ResourceManager
      path={`${base(project)}/sprints`}
      singular="scrum.sprint"
      fields={fields.filter((f) => !['increment', 'incrementVersion', 'incrementUrl', 'notes'].includes(f.name))}
      columns={[
        { key: 'number', label: 'scrum.sprintNumber', render: (r) => `S${r.number}` },
        { key: 'name', label: 'scrum.sprintName', render: (r) => r.name ?? '—' },
        { key: 'goal', label: 'scrum.goal', render: (r) => <span className="small kt-prewrap">{r.goal ?? '—'}</span> },
        { key: 'startDate', label: 'scrum.startDate', render: (r) => `${r.startDate ? formatDate(r.startDate, locale) : '—'} → ${r.endDate ? formatDate(r.endDate, locale) : '—'}` },
        { key: 'status', label: 'scrum.status', render: (r) => badge(t(`enums.sprintStatus.${r.status}`), SPRINT_STATUS_BADGE[r.status]) },
      ]}
      rowLink={(r) => `${base(project)}/sprints/${r.id}`}
      nameOf={sprintLabel}
      onChange={sprints.reload}
      afterCreate={(row) => navigate(`${base(project)}/sprints/${row.id}`)}
    />
  );
}

function taskFields(t, items, members) {
  return [
    { name: 'title', label: 'scrum.title', required: true, maxLength: 200, col: 'col-md-8' },
    { name: 'status', label: 'scrum.status', type: 'select', required: true, options: opts(t, 'taskStatus'), default: 'todo', col: 'col-md-4' },
    { name: 'itemId', label: 'scrum.linkedItem', type: 'select', options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.title}` })), col: 'col-md-6' },
    { name: 'assigneeId', label: 'scrum.assignee', type: 'select', options: members.map((m) => ({ value: m.id, label: m.name })), col: 'col-md-6' },
    { name: 'estimateHours', label: 'scrum.estimateHours', type: 'number', min: 0, step: '0.5', col: 'col-md-6' },
    { name: 'remainingHours', label: 'scrum.remainingHours', type: 'number', min: 0, step: '0.5', col: 'col-md-6' },
    { name: 'description', label: 'scrum.description', type: 'textarea', rows: 2, maxLength: 5000 },
  ];
}

// Incremento entregue: o que foi concluído na sprint (no Scrum ou movendo o cartão no Kanban)
function Delivered({ sprint: s, items }) {
  const { t, locale } = useI18n();
  const { delivered } = s;
  const doneOn = (d) => t('scrum.doneOn', { date: formatDate(d, locale) });
  const empty = !delivered.items.length && !delivered.tasks.length;
  return (
    <section className="kt-increment mb-4" aria-labelledby="kt-increment-title">
      <header className="d-flex flex-wrap align-items-center gap-2">
        <i className="bi bi-box-seam" aria-hidden="true" />
        <h4 className="h3 mb-0" id="kt-increment-title">{t('scrum.increment')}</h4>
        {s.incrementVersion && <span className="kt-tile-chip">v{s.incrementVersion}</span>}
        {!empty && <span className="kt-tile-chip ms-auto">{t('scrum.deliveredPoints', { points: delivered.points })}</span>}
      </header>
      <div className="kt-increment-body">
        {(s.increment || s.incrementUrl) && (
          <p className="small kt-prewrap">
            {s.increment}
            {s.incrementUrl && (
              <a href={s.incrementUrl} target="_blank" rel="noopener noreferrer" className="ms-2">
                {t('scrum.incrementUrl')} <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              </a>
            )}
          </p>
        )}
        {empty ? <p className="small text-body-secondary mb-0">{t('scrum.noDelivered')}</p> : (
          <div className="row g-3">
            <div className="col-md-6">
              <h5 className="h5">{t('scrum.deliveredItems')} <span className="badge text-bg-light">{delivered.items.length}</span></h5>
              <ul className="list-unstyled mb-0">
                {delivered.items.map((i) => (
                  <li key={i.id}>
                    <i className="bi bi-check-circle-fill text-success me-1" aria-hidden="true" />
                    <strong>{i.code}</strong> {i.title}
                    {i.storyPoints != null && <span className="text-body-secondary"> · {i.storyPoints} pts</span>}
                    {i.doneAt && <span className="small text-body-secondary"> · {doneOn(i.doneAt)}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-6">
              <h5 className="h5">{t('scrum.deliveredTasks')} <span className="badge text-bg-light">{delivered.tasks.length}</span></h5>
              <ul className="list-unstyled mb-0">
                {delivered.tasks.map((tk) => (
                  <li key={tk.id}>
                    <i className="bi bi-check2 text-success me-1" aria-hidden="true" />
                    {items[tk.itemId]?.code && <span className="text-body-secondary">{items[tk.itemId].code} · </span>}
                    {tk.title}
                    {tk.doneAt && <span className="small text-body-secondary"> · {doneOn(tk.doneAt)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SprintDetail() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const { sprintId } = useParams();
  const data = useScrumData(project);
  const detail = useAsync(() => scrumApi.sprint(project.id, sprintId), [project.id, sprintId]);
  const [taskEdit, setTaskEdit] = useState(null);
  const [publishing, setPublishing] = useState(false);
  useCrumbLabel('scrumSprint', detail.data ? sprintLabel(detail.data) : null);
  const sprintApi = useMemo(() => res(project, 'sprints'), [project]);
  if ((detail.loading && !detail.data) || !data.ready) return <Loading small />;
  if (!detail.data) return null;
  const s = detail.data;
  const members = byId(data.members);
  const items = byId(s.items);
  const available = data.items.filter((i) => !i.sprintId && i.status !== 'done');
  const refresh = () => { detail.reload(); data.reload(); };
  // fora do Kanban: tasks sem cartão e itens do Sprint Backlog sem tasks (ganham uma ao publicar)
  const itemsWithTasks = new Set(s.tasks.map((tk) => tk.itemId));
  const unpublished = s.tasks.filter((tk) => !tk.kanbanCardId).length + s.items.filter((i) => !itemsWithTasks.has(i.id)).length;
  const publish = async () => {
    setPublishing(true);
    try {
      const result = await scrumApi.publishKanban(project.id, s.id, {
        columnNames: { todo: t('kb.defaults.todo'), in_progress: t('kb.defaults.doing'), done: t('kb.defaults.done') },
      });
      toast.success(t('scrum.publishedKanban', { count: result.published }));
      detail.setData(result.sprint);
      data.reload();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setPublishing(false);
    }
  };
  const run = async (fn) => {
    try {
      await fn();
      refresh();
    } catch (err) {
      toast.fromError(err);
    }
  };
  const itemsApi = res(project, 'items');
  const tasksApi = res(project, 'tasks');
  const STEPS = ENUMS.taskStatus;

  return (
    <article>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="h2 mb-1">{sprintLabel(s)}</h3>
          {badge(t(`enums.sprintStatus.${s.status}`), SPRINT_STATUS_BADGE[s.status])}
          <span className="small text-body-secondary ms-2">
            {s.startDate ? formatDate(s.startDate, locale) : '—'} → {s.endDate ? formatDate(s.endDate, locale) : '—'}
          </span>
        </div>
      </div>
      <p className="kt-goal"><strong>{t('scrum.goal')}:</strong> {s.goal || t('scrum.notDefined')}</p>

      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          {s.burndown?.total ? <BurndownChart burndown={s.burndown} title={t('scrum.burndown')} /> : <p className="text-body-secondary">{t('scrum.burndownEmpty')}</p>}
        </div>
        <div className="col-lg-5">
          <details className="card">
            <summary className="card-header fw-semibold">{t('scrum.sprint')}: {t('common.details')} · {t('scrum.increment')}</summary>
            <div className="card-body">
              <EditForm fields={sprintFields(t)} initial={s} onSave={(body) => sprintApi.update(s.id, body)} onSaved={refresh} />
            </div>
          </details>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h4 className="h3 mb-0">{t('scrum.sprintBacklog')}</h4>
        {available.length > 0 && (
          <select className="form-select form-select-sm w-auto" value="" aria-label={t('scrum.addToSprint')}
            onChange={(e) => e.target.value && run(() => itemsApi.update(e.target.value, { sprintId: s.id }))}>
            <option value="">{t('scrum.addToSprint')}</option>
            {available.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.title}</option>)}
          </select>
        )}
      </div>
      {!s.items.length ? <EmptyState>{t('common.empty')}</EmptyState> : (
        <div className="table-responsive mb-4">
          <table className="table align-middle">
            <thead>
              <tr><th scope="col">{t('scrum.code')}</th><th scope="col">{t('scrum.title')}</th><th scope="col">{t('scrum.storyPoints')}</th><th scope="col">{t('scrum.status')}</th><th scope="col" className="kt-table-actions" /></tr>
            </thead>
            <tbody>
              {s.items.map((it) => (
                <tr key={it.id}>
                  <td className="fw-semibold">{it.code}</td>
                  <td>{it.title}</td>
                  <td>{it.storyPoints ?? '—'}</td>
                  <td>
                    <select className="form-select form-select-sm" value={it.status} aria-label={`${t('scrum.status')} ${it.code}`}
                      onChange={(e) => run(() => itemsApi.update(it.id, { status: e.target.value }))}>
                      {ENUMS.itemStatus.map((st) => <option key={st} value={st}>{t(`enums.itemStatus.${st}`)}</option>)}
                    </select>
                  </td>
                  <td className="kt-table-actions">
                    <button type="button" className="btn btn-sm btn-outline-secondary" title={t('scrum.backToBacklog')} aria-label={`${t('scrum.backToBacklog')}: ${it.code}`}
                      onClick={() => run(() => itemsApi.update(it.id, { sprintId: null }))}><i className="bi bi-box-arrow-left" aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h4 className="h3 mb-0">{t('scrum.board')}</h4>
        <div className="d-flex flex-wrap gap-2">
          {unpublished > 0 && (
            <button type="button" className="btn btn-sm kt-tile-cta" style={{ '--sec': '#0c8d8b' }} onClick={publish} disabled={publishing}>
              <i className="bi bi-kanban me-1" aria-hidden="true" />{publishing ? t('common.saving') : t('scrum.publishKanban')}
            </button>
          )}
          <Link to={`/projects/${project.id}/kanban`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />{t('scrum.openKanban')}
          </Link>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setTaskEdit('new')}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('scrum.newTask')}
          </button>
        </div>
      </div>
      <p className="small text-body-secondary mb-2">
        <i className="bi bi-kanban me-1" aria-hidden="true" />
        {unpublished > 0 ? t('scrum.publishKanbanHint', { count: unpublished }) : t('scrum.allOnKanban')}
      </p>
      <div className="row g-3 mb-4">
        {STEPS.map((step, si) => {
          const tasks = s.tasks.filter((tk) => tk.status === step);
          return (
            <div className="col-md-4" key={step}>
              <section className={`kt-scrum-col is-${step}`} aria-label={t(`enums.taskStatus.${step}`)}>
                <h5 className="h5">{t(`enums.taskStatus.${step}`)} <span className="badge text-bg-light">{tasks.length}</span></h5>
                {!tasks.length && <p className="small text-body-secondary mb-0">{t('scrum.noTasks')}</p>}
                {tasks.map((tk) => (
                  <article key={tk.id} className="kt-scrum-task">
                    <button type="button" className="btn btn-link p-0 text-start fw-semibold" onClick={() => setTaskEdit(tk)}>{tk.title}</button>
                    <div className="small text-body-secondary">
                      {items[tk.itemId]?.code && <span className="me-2">{items[tk.itemId].code}</span>}
                      {members[tk.assigneeId]?.name && <span className="me-2"><i className="bi bi-person me-1" aria-hidden="true" />{members[tk.assigneeId].name}</span>}
                      {tk.remainingHours != null && <span className="me-2">{tk.remainingHours} h</span>}
                      {tk.kanbanCardId && (
                        <span className="kt-on-kanban" title={t('scrum.onKanban')}>
                          <i className="bi bi-kanban" aria-hidden="true" /><span className="visually-hidden">{t('scrum.onKanban')}</span>
                        </span>
                      )}
                    </div>
                    <div className="d-flex justify-content-between mt-1">
                      <button type="button" className="btn btn-sm btn-link px-1" disabled={si === 0}
                        aria-label={`${t('scrum.moveLeft')}: ${tk.title}`} title={t('scrum.moveLeft')}
                        onClick={() => run(() => tasksApi.update(tk.id, { status: STEPS[si - 1] }))}><i className="bi bi-arrow-left" aria-hidden="true" /></button>
                      <button type="button" className="btn btn-sm btn-link px-1 text-danger"
                        aria-label={`${t('common.delete')}: ${tk.title}`}
                        onClick={() => window.confirm(t('common.confirmDelete', { name: tk.title })) && run(() => tasksApi.remove(tk.id))}><i className="bi bi-trash" aria-hidden="true" /></button>
                      <button type="button" className="btn btn-sm btn-link px-1" disabled={si === STEPS.length - 1}
                        aria-label={`${t('scrum.moveRight')}: ${tk.title}`} title={t('scrum.moveRight')}
                        onClick={() => run(() => tasksApi.update(tk.id, { status: STEPS[si + 1] }))}><i className="bi bi-arrow-right" aria-hidden="true" /></button>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          );
        })}
      </div>

      <Delivered sprint={s} items={items} />

      {s.events.length > 0 && (
        <>
          <h4 className="h3">{t('scrum.nav.events')}</h4>
          <EventList events={s.events} members={members} sprints={byId(data.sprints)} project={project} />
        </>
      )}

      {taskEdit && (
        <FormModal
          title={`${taskEdit === 'new' ? t('common.new') : t('common.edit')}: ${t('scrum.task')}`}
          fields={taskFields(t, s.items, data.members)}
          initial={taskEdit === 'new' ? {} : taskEdit}
          transform={(p) => ({ ...p, estimateHours: toNumber(p.estimateHours), remainingHours: toNumber(p.remainingHours) })}
          extra={(p) => (taskEdit === 'new' ? { ...p, sprintId: s.id } : p)}
          onSave={(body) => (taskEdit === 'new' ? tasksApi.create(body) : tasksApi.update(taskEdit.id, body))}
          onClose={() => setTaskEdit(null)}
          onSaved={() => { setTaskEdit(null); refresh(); }}
        />
      )}
    </article>
  );
}

// ---------- Eventos ----------
const EVENT_EXTRA = {
  planning: ['decisions'],
  daily: ['impediments'],
  review: ['feedback', 'decisions'],
  retrospective: ['wentWell', 'toImprove', 'actionItems'],
  refinement: ['decisions'],
};

function eventFields(t, type, sprints, members) {
  return [
    { name: 'date', label: 'scrum.date', type: 'date', required: true, col: 'col-md-4' },
    { name: 'durationMinutes', label: 'scrum.durationMinutes', type: 'integer', min: 0, col: 'col-md-4' },
    { name: 'sprintId', label: 'scrum.sprint', type: 'select', options: sprints.map((s) => ({ value: s.id, label: sprintLabel(s) })), col: 'col-md-4' },
    { name: 'facilitatorId', label: 'scrum.facilitator', type: 'select', options: members.map((m) => ({ value: m.id, label: m.name })), col: 'col-md-6' },
    { name: 'participantIds', label: 'scrum.participants', type: 'multicheck', options: members.map((m) => ({ value: m.id, label: `${m.name} (${t(`enums.scrumRole.${m.role}`)})` })), col: 'col-md-6' },
    ...EVENT_EXTRA[type].map((name) => ({ name, label: `scrum.${name}`, type: 'textarea', rows: 3, col: 'col-12' })),
    { name: 'notes', label: 'scrum.notes', type: 'textarea', rows: 2 },
  ];
}

function EventModal({ project, type, event, sprints, members, defaultSprintId, onClose, onSaved, onDelete }) {
  const { t } = useI18n();
  const [updates, setUpdates] = useState(() => event?.updates ?? []);
  const api = res(project, 'events');
  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));
  return (
    <FormModal
      title={`${t(`enums.eventType.${type}`)}`}
      fields={eventFields(t, type, sprints, members)}
      initial={event ?? { date: new Date().toISOString().slice(0, 10), sprintId: defaultSprintId, participantIds: members.filter((m) => m.active).map((m) => m.id) }}
      extra={(p) => ({
        ...p,
        type,
        ...(type === 'daily' && {
          updates: updates.filter((u) => u.memberId).map((u) => ({ memberId: u.memberId, yesterday: u.yesterday ?? '', today: u.today ?? '', impediments: u.impediments ?? '' })),
        }),
      })}
      onSave={(body) => (event ? api.update(event.id, body) : api.create(body))}
      onClose={onClose}
      onSaved={onSaved}
      onDelete={onDelete}
    >
      <p className="small text-body-secondary">{t(`scrum.eventText.${type}`)}</p>
      {type === 'daily' && memberOptions.length > 0 && (
        <>
          <h3 className="h5">{t('scrum.updates')}</h3>
          <RowsEditor caption={t('scrum.updates')} rows={updates} onChange={setUpdates} addLabel={t('scrum.addUpdate')}
            columns={[
              { name: 'memberId', label: t('scrum.member'), type: 'select', options: memberOptions, width: '20%' },
              { name: 'yesterday', label: t('scrum.yesterday'), maxLength: 2000 },
              { name: 'today', label: t('scrum.today'), maxLength: 2000 },
              { name: 'impediments', label: t('scrum.blockers'), maxLength: 2000 },
            ]} />
        </>
      )}
    </FormModal>
  );
}

function EventList({ events, members, sprints, onEdit }) {
  const { t, locale } = useI18n();
  return (
    <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
      {events.map((e) => (
        <li key={e.id} className="kt-event" style={{ '--sec': EVENT_COLORS[e.type] }}>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="kt-tile-chip">{t(`enums.eventType.${e.type}`)}</span>
            <strong>{formatDate(e.date, locale)}</strong>
            {sprints[e.sprintId] && <span className="small text-body-secondary">{sprintLabel(sprints[e.sprintId])}</span>}
            {e.durationMinutes != null && <span className="small text-body-secondary">· {e.durationMinutes} min</span>}
            {members[e.facilitatorId] && <span className="small text-body-secondary">· {t('scrum.facilitator')}: {members[e.facilitatorId].name}</span>}
            {onEdit && (
              <button type="button" className="btn btn-sm btn-link ms-auto" onClick={() => onEdit(e)} aria-label={`${t('common.edit')} ${t(`enums.eventType.${e.type}`)}`}>
                <i className="bi bi-pencil" aria-hidden="true" />
              </button>
            )}
          </div>
          {e.updates?.length > 0 && (
            <ul className="small mb-1 mt-1">
              {e.updates.map((u, i) => (
                <li key={i}>
                  <strong>{members[u.memberId]?.name ?? '—'}:</strong> {u.yesterday && `${t('scrum.yesterday')}: ${u.yesterday}. `}
                  {u.today && `${t('scrum.today')}: ${u.today}. `}{u.impediments && <span className="text-danger">{t('scrum.blockers')}: {u.impediments}</span>}
                </li>
              ))}
            </ul>
          )}
          {['wentWell', 'toImprove', 'actionItems', 'feedback', 'decisions', 'impediments', 'notes'].filter((f) => e[f]).map((f) => (
            <p key={f} className="small mb-1 kt-prewrap"><strong>{t(`scrum.${f}`)}:</strong> {e[f]}</p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Events() {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const data = useScrumData(project);
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null); // { type, event? }
  const events = useAsync(() => res(project, 'events').list({ type: type || undefined }), [project.id, type]);
  if (!data.ready) return <Loading small />;
  const current = data.sprints.find((s) => s.status === 'active') ?? data.sprints.find((s) => s.status === 'planned');
  const remove = async (e) => {
    if (!window.confirm(t('common.confirmDelete', { name: t(`enums.eventType.${e.type}`) }))) return;
    try {
      await res(project, 'events').remove(e.id);
      toast.success(t('common.deleted'));
      setEditing(null);
      events.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };
  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {ENUMS.eventType.map((ty) => (
          <button key={ty} type="button" className="btn btn-sm kt-tile-cta" style={{ '--sec': EVENT_COLORS[ty] }} onClick={() => setEditing({ type: ty })}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t(`enums.eventType.${ty}`)}
          </button>
        ))}
      </div>
      <div className="mb-3" style={{ maxWidth: 260 }}>
        <label className="form-label small mb-1" htmlFor="ev-type">{t('scrum.event')}</label>
        <select id="ev-type" className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('scrum.allTypes')}</option>
          {ENUMS.eventType.map((ty) => <option key={ty} value={ty}>{t(`enums.eventType.${ty}`)}</option>)}
        </select>
      </div>
      {events.loading && !events.data ? <Loading small /> : !events.data?.length ? <EmptyState>{t('scrum.noEvents')}</EmptyState> : (
        <EventList events={events.data} members={byId(data.members)} sprints={byId(data.sprints)}
          onEdit={(e) => setEditing({ type: e.type, event: e })} />
      )}
      {editing && (
        <EventModal project={project} type={editing.type} event={editing.event} sprints={data.sprints} members={data.members}
          defaultSprintId={current?.id} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); events.reload(); }}
          onDelete={editing.event ? () => remove(editing.event) : undefined} />
      )}
    </>
  );
}

// ---------- Artefatos ----------
function Artifacts() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useScrumData(project);
  const settings = useAsync(() => scrumApi.settings(project.id), [project.id]);
  if (!data.ready || !settings.data) return <Loading small />;
  const current = data.sprints.find((s) => s.status === 'active') ?? data.sprints.find((s) => s.status === 'planned');
  const backlog = data.items.filter((i) => !i.sprintId && i.status !== 'done');
  const sprintItems = current ? data.items.filter((i) => i.sprintId === current.id) : [];
  // incremento de cada sprint: o que foi concluído nela (tasks finalizadas no Scrum ou no Kanban) e o texto/versão
  const doneBySprint = Object.groupBy(data.items.filter((i) => i.sprintId && i.status === 'done'), (i) => i.sprintId);
  const increments = data.sprints.filter((s) => doneBySprint[s.id] || s.increment || s.incrementVersion || s.incrementUrl);
  const tiles = [
    { key: 'productBacklog', title: 'Product Backlog', icon: 'list-ol', color: '#0189b6', text: t('scrum.productBacklogText'),
      commitment: t('scrum.productGoal'), value: settings.data.productGoal, meta: t('scrum.items', { count: backlog.length }), to: 'backlog' },
    { key: 'sprintBacklog', title: 'Sprint Backlog', icon: 'kanban', color: '#d96a04', text: t('scrum.sprintBacklogText'),
      commitment: t('scrum.goal'), value: current?.goal, meta: current ? `${sprintLabel(current)} · ${t('scrum.items', { count: sprintItems.length })}` : t('scrum.noSprint'),
      to: current ? `sprints/${current.id}` : 'sprints' },
    { key: 'increment', title: t('scrum.increment'), icon: 'box-seam', color: '#11866a', text: t('scrum.incrementText'),
      commitment: t('scrum.definitionOfDone'), value: settings.data.definitionOfDone, meta: t('scrum.items', { count: increments.length }), to: 'project' },
  ];
  return (
    <>
      <p className="text-body-secondary">{t('scrum.artifactsIntro')}</p>
      <ul className="row g-4 list-unstyled mb-4">
        {tiles.map((a) => (
          <li className="col-md-4" key={a.key}>
            <article className="kt-tile is-available" style={{ '--sec': a.color }}>
              <header>
                <span className="kt-tile-icon"><i className={`bi bi-${a.icon}`} aria-hidden="true" /></span>
                <h3 className="h4 mb-0">{a.title}</h3>
              </header>
              <div className="kt-tile-body">
                <p>{a.text}</p>
                <div className="kt-commitment mb-3">
                  <span className="small fw-semibold">{t('scrum.commitment')}: {a.commitment}</span>
                  <div className="kt-prewrap small">{a.value || t('scrum.notDefined')}</div>
                </div>
                <span className="kt-tile-chip mb-3 align-self-start">{a.meta}</span>
                <Link to={`${base(project)}/${a.to}`} className="btn btn-sm kt-tile-cta">{t('scrum.open')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" /></Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <h3 className="h3">{t('scrum.increments')}</h3>
      {!increments.length ? <EmptyState>{t('scrum.noIncrements')}</EmptyState> : (
        <ul className="list-unstyled d-flex flex-column gap-2">
          {increments.map((s) => (
            <li key={s.id} className="kt-event" style={{ '--sec': '#11866a' }}>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Link to={`${base(project)}/sprints/${s.id}`} className="fw-semibold">{sprintLabel(s)}</Link>
                {s.incrementVersion && <span className="kt-tile-chip">v{s.incrementVersion}</span>}
                {s.endDate && <span className="small text-body-secondary">{formatDate(s.endDate, locale)}</span>}
                {s.incrementUrl && <a href={s.incrementUrl} target="_blank" rel="noopener noreferrer" className="small ms-auto">{t('scrum.incrementUrl')} <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}
              </div>
              {s.increment && <p className="small mb-0 mt-1 kt-prewrap">{s.increment}</p>}
              {doneBySprint[s.id] && (
                <p className="small mb-0 mt-1">
                  <i className="bi bi-check-circle-fill text-success me-1" aria-hidden="true" />
                  {doneBySprint[s.id].map((i) => i.code).join(', ')}
                  <span className="text-body-secondary"> · {t('scrum.deliveredPoints', { points: doneBySprint[s.id].reduce((n, i) => n + (i.storyPoints ?? 0), 0) })}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const ScrumLayout = Layout;
export const ScrumOverview = Overview;
export const ScrumProject = ProjectPage;
export const ScrumBacklog = Backlog;
export const ScrumSprints = Sprints;
export const ScrumSprintDetail = SprintDetail;
export const ScrumEvents = Events;
export const ScrumArtifacts = Artifacts;
