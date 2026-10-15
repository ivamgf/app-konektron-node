// CommonKADS: planilhas dos modelos de organização, tarefa, agente, conhecimento, comunicação e
// projeto (Schreiber et al., 2000) e a extensão MAS-CommonKADS. As planilhas em linhas (OM-3/TM-1,
// OM-4/TM-2, AM-1/MAS, CM-1/CM-2) são cadastros; as demais são editadas no formato da planilha.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { commonkadsApi, resourceApi } from '../../api/endpoints.js';
import { enumOptions } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { RowsEditor, SectionLayout, StatCards } from '../../components/sections.jsx';
import { sameValues, SaveButton, saveShortcut, useUnsavedChanges } from '../../components/unsaved.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading } from '../../components/ui.jsx';
import { ckText, sheetCode } from '../../content/commonkads.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';
import { badge, ENUMS, opts } from './resources.jsx';

const base = (project) => `/projects/${project.id}/commonkads`;
const STATUS_BADGE = { not_started: 'text-bg-light border', in_progress: 'text-bg-warning', completed: 'text-bg-success' };
const MODELS = ['organization', 'task', 'agent', 'knowledge', 'communication', 'design'];
// Página do app onde cada planilha é preenchida
const SHEET_ROUTE = {
  'om-1': 'organization', 'om-2': 'organization', 'om-3': 'tasks', 'om-4': 'knowledge', 'om-5': 'organization',
  'tm-1': 'tasks', 'tm-2': 'knowledge', 'am-1': 'agents', mas: 'agents', 'ota-1': 'impact', 'km-1': 'knowledge-model',
  'cm-1': 'communication', 'cm-2': 'communication', 'dm-1': 'design', 'dm-2': 'design', 'dm-3': 'design', 'dm-4': 'design',
};
const RESOURCE_ROUTE = { tasks: 'tasks', knowledge: 'knowledge', agents: 'agents', transactions: 'communication' };
const CHARACTERIZATION = {
  nature: ['formal', 'empirical', 'heuristic', 'specialized', 'experienceBased', 'actionBased', 'incomplete', 'uncertain', 'changing', 'hardToVerify', 'tacit'],
  form: ['mind', 'paper', 'electronic', 'actionSkill', 'other'],
  availability: ['time', 'space', 'access', 'quality', 'form'],
};
const ASSESSMENT = ['rightForm', 'rightPlace', 'rightTime', 'rightQuality'];
const MAS_FIELDS = [
  'inputParameters', 'activationCondition', 'terminationCondition', 'successCondition', 'failureCondition',
  'representationLanguage', 'ontology', 'infoEvolution', 'infoEffect', 'infoAssociation', 'aiTechnique',
];

// ---------- Utilitários ----------
const byId = (rows) => Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
const taskLabel = (x) => `${x.code} — ${x.name}`;
const yn = (t, v) => (v == null ? '—' : t(v ? 'common.yes' : 'common.no'));
const yesNo = (t) => [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }];
const toBool = (v) => (v == null || v === '' ? null : v === 'true' || v === true);
const pickNames = (ids, map, label = (x) => x.name) => (ids ?? []).map((id) => map[id]).filter(Boolean).map(label);
const joined = (list) => (list.length ? list.join(', ') : '—');
// campo de formulário com rótulo e orientação da planilha
const field = (txt, name, extra = {}) => ({ name, label: txt[name][0], help: txt[name][1], ...extra });
const hasBottleneck = (c) => Object.keys(CHARACTERIZATION).some((g) => Object.values(c?.[g] ?? {}).some((e) => e?.bottleneck));

// Planilhas, cadastros e uma função para recarregar tudo
function useCkData(project) {
  const [version, setVersion] = useState(0);
  const deps = [project.id, version];
  const list = (r) => resourceApi(`${base(project)}/${r}`).list();
  const worksheets = useAsync(() => commonkadsApi.worksheets(project.id), deps);
  const tasks = useAsync(() => list('tasks'), deps);
  const knowledge = useAsync(() => list('knowledge'), deps);
  const agents = useAsync(() => list('agents'), deps);
  const transactions = useAsync(() => list('transactions'), deps);
  const all = [worksheets, tasks, knowledge, agents, transactions];
  return {
    worksheets: worksheets.data,
    tasks: tasks.data,
    knowledge: knowledge.data,
    agents: agents.data,
    transactions: transactions.data,
    ready: all.every((x) => x.data),
    reload: () => setVersion((v) => v + 1),
  };
}

function Layout() {
  const { t } = useI18n();
  const { project } = useProject();
  const items = [
    ['', 'overview', 'speedometer2'], ['organization', 'organization', 'building'], ['tasks', 'tasks', 'list-task'],
    ['knowledge', 'knowledge', 'lightbulb'], ['agents', 'agents', 'people'], ['impact', 'impact', 'arrow-left-right'],
    ['knowledge-model', 'knowledgeModel', 'diagram-3'], ['communication', 'communication', 'chat-left-text'],
    ['design', 'design', 'cpu'], ['document', 'document', 'file-earmark-text'],
  ].map(([path, key, icon]) => [path, t(`ck.nav.${key}`), icon]);
  return <SectionLayout section="commonkads" base={base(project)} items={items} />;
}

// ---------- Visão geral ----------
function Overview() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const data = useAsync(() => commonkadsApi.overview(project.id), [project.id]);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const { progress, worksheets, counts, gaps } = data.data;
  const txt = ckText(locale);
  const gapEntries = Object.entries(gaps).filter(([, list]) => list.length);
  const registryCount = { tasks: counts.tasks, knowledge: counts.knowledge, agents: counts.agents, transactions: counts.transactions };
  return (
    <>
      <p className="text-body-secondary">{t('ck.intro')}</p>
      <div className="d-flex justify-content-between mb-1">
        <span className="fw-semibold">{t('ck.progress')}</span><span className="fw-bold">{progress}%</span>
      </div>
      <div className="progress kt-progress mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('ck.progress')}>
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <StatCards items={[
        [t('ck.counts.tasks'), counts.tasks, 'list-task'],
        [t('ck.counts.knowledgeIntensiveTasks'), counts.knowledgeIntensiveTasks, 'stars'],
        [t('ck.counts.knowledge'), counts.knowledge, 'lightbulb'],
        [t('ck.counts.bottlenecks'), counts.bottlenecks, 'exclamation-triangle'],
        [t('ck.counts.agents'), `${counts.agents} (${counts.humanAgents}/${counts.systemAgents})`, 'people'],
        [t('ck.counts.transactions'), counts.transactions, 'chat-left-text'],
      ]} />

      <h3 className="h3">{t('ck.gapsTitle')}</h3>
      {gapEntries.length ? (
        <ul className="kt-gaps mb-4">
          {gapEntries.map(([key, list]) => <li key={key}>{t(`ck.gaps.${key}`, { list: list.join(', ') })}</li>)}
        </ul>
      ) : (
        <p className="text-success"><i className="bi bi-check-circle me-1" aria-hidden="true" />{t('ck.noGaps')}</p>
      )}

      {MODELS.map((model) => {
        const sheets = worksheets.filter((w) => w.model === model);
        return (
          <section key={model} className="mb-3">
            <h3 className="h4">{t(`ck.models.${model}`)}</h3>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <tbody>
                  {sheets.map((w) => (
                    <tr key={w.key}>
                      <td style={{ width: '5rem' }}><span className="badge text-bg-success">{sheetCode(w.key)}</span></td>
                      <td><Link to={`${base(project)}/${SHEET_ROUTE[w.key]}`}>{txt.worksheets[w.key].title}</Link></td>
                      <td className="small text-body-secondary">
                        {w.resource
                          ? `${t('ck.fromRegistry', { what: t(`ck.resources.${w.resource}`) })} (${registryCount[w.resource]})`
                          : t('ck.filled', { filled: w.filled, total: w.fields })}
                      </td>
                      <td className="small text-body-secondary d-none d-md-table-cell">{w.updatedAt ? formatDate(w.updatedAt, locale) : ''}</td>
                      <td className="text-end"><span className={`badge ${STATUS_BADGE[w.status]}`}>{t(`enums.phaseStatus.${w.status}`)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

// ---------- Planilhas de texto livre ----------
function StatusSelect({ id, value, onChange, label }) {
  const { t } = useI18n();
  return (
    <select id={id} className="form-select form-select-sm" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {enumOptions(t, 'phaseStatus', ENUMS.phaseStatus).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function WorksheetCard({ project, sheet, onSaved }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const txt = ckText(locale).worksheets[sheet.key];
  const initial = Object.fromEntries(sheet.fields.map((f) => [f, sheet.content[f] ?? '']));
  const [content, setContent] = useState(initial);
  const [status, setStatus] = useState(sheet.status);
  const [notes, setNotes] = useState(sheet.notes ?? '');
  const { submit, busy } = useSubmit((body) => commonkadsApi.updateWorksheet(project.id, sheet.key, body), {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      onSaved(saved);
    },
  });
  const save = (e) => {
    e.preventDefault();
    // a API faz merge: envia só os itens alterados ('' apaga com null)
    const changed = Object.fromEntries(
      Object.entries(content).filter(([k, v]) => v !== initial[k]).map(([k, v]) => [k, v.trim() === '' ? null : v]),
    );
    const body = {};
    if (status !== sheet.status) body.status = status;
    if (notes !== (sheet.notes ?? '')) body.notes = notes.trim() === '' ? null : notes;
    if (Object.keys(changed).length) body.content = changed;
    if (!Object.keys(body).length) return toast.success(t('common.saved'));
    submit(body);
  };
  const code = sheetCode(sheet.key);
  const dirty = status !== sheet.status || notes !== (sheet.notes ?? '') || !sameValues(content, initial);
  useUnsavedChanges(dirty);
  return (
    <form className="mb-5" id={sheet.key} onSubmit={save} onKeyDown={saveShortcut} noValidate>
      <div className="table-responsive">
        <table className="table table-bordered kt-sheet mb-2">
          <thead>
            <tr className="kt-sheet-title"><th colSpan={4} scope="colgroup">{t('ck.worksheet')} {code}: {txt.title}</th></tr>
            <tr>
              <th scope="col" className="kt-sheet-n">Nº</th>
              <th scope="col" className="kt-sheet-item">{t('ck.item')}</th>
              <th scope="col" className="kt-sheet-guide d-none d-md-table-cell">{t('ck.guide')}</th>
              <th scope="col">{t('ck.value')}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.fields.map((f, i) => {
              const [label, guide] = txt.fields[f];
              const id = `${sheet.key}-${f}`;
              return (
                <tr key={f}>
                  <td className="kt-sheet-n">{i + 1}</td>
                  <th scope="row" className="kt-sheet-item"><label htmlFor={id}>{label}</label></th>
                  <td className="kt-sheet-guide d-none d-md-table-cell">{guide}</td>
                  <td>
                    <div className="kt-sheet-guide-inline d-md-none">{guide}</div>
                    <textarea id={id} className="form-control" rows={3} maxLength={20000} value={content[f]}
                      onChange={(e) => setContent((c) => ({ ...c, [f]: e.target.value }))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row g-2 align-items-end">
        <div className="col-md-3">
          <label className="form-label small mb-1" htmlFor={`${sheet.key}-status`}>{t('ck.status')}</label>
          <StatusSelect id={`${sheet.key}-status`} value={status} onChange={setStatus} />
        </div>
        <div className="col-md-6">
          <label className="form-label small mb-1" htmlFor={`${sheet.key}-notes`}>{t('ck.notes')}</label>
          <input id={`${sheet.key}-notes`} className="form-control form-control-sm" value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="col-md-3 text-md-end">
          <SaveButton busy={busy} dirty={dirty} label={t('ck.saveSheet')} className="justify-content-md-end" />
        </div>
      </div>
    </form>
  );
}

// Planilha preenchida por um cadastro: título, explicação, situação e o link para o cadastro
function RegistrySheet({ project, sheet, onSaved, link = true }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const txt = ckText(locale).worksheets[sheet.key];
  const change = async (status) => {
    try {
      onSaved(await commonkadsApi.updateWorksheet(project.id, sheet.key, { status }));
      toast.success(t('common.saved'));
    } catch (err) {
      toast.fromError(err);
    }
  };
  return (
    <div className="card h-100" id={sheet.key}>
      <div className="card-body py-2">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <span className="badge text-bg-success me-1">{sheetCode(sheet.key)}</span>
            {link ? <Link to={`${base(project)}/${RESOURCE_ROUTE[sheet.resource]}`} className="fw-semibold">{txt.title}</Link> : <strong>{txt.title}</strong>}
          </div>
          <div style={{ minWidth: '10rem' }}>
            <StatusSelect value={sheet.status} onChange={change} label={`${t('ck.status')} ${sheetCode(sheet.key)}`} />
          </div>
        </div>
        <p className="small text-body-secondary mb-0 mt-1">{txt.text}</p>
      </div>
    </div>
  );
}

// Situação das planilhas em linhas de uma página de cadastro (ex.: OM-3 e TM-1)
function RegistryHeader({ project, data, keys }) {
  return (
    <div className="row g-3 mb-4">
      {keys.map((k) => (
        <div className="col-md-6" key={k}>
          <RegistrySheet project={project} sheet={data.worksheets.find((w) => w.key === k)} onSaved={data.reload} link={false} />
        </div>
      ))}
    </div>
  );
}

function Sheets({ keys }) {
  const { project } = useProject();
  const ws = useAsync(() => commonkadsApi.worksheets(project.id), [project.id]);
  if (!ws.data) return <Loading small />;
  const replace = (saved) => ws.setData(ws.data.map((w) => (w.key === saved.key ? saved : w)));
  return keys.map((k) => {
    const sheet = ws.data.find((w) => w.key === k);
    return sheet.resource ? (
      <div className="mb-5" key={k}><RegistrySheet project={project} sheet={sheet} onSaved={replace} /></div>
    ) : (
      <WorksheetCard key={k} project={project} sheet={sheet} onSaved={replace} />
    );
  });
}

// ---------- Planilha de um registro (TM-1, TM-2, AM-1, MAS, CM-1, CM-2) ----------
const toFormValue = (row, v) => {
  if (row.type === 'multicheck' || row.control) return v ?? [];
  if (row.type === 'bool') return v == null ? '' : String(v);
  return v == null ? '' : String(v);
};
const toPayloadValue = (row, v) => {
  if (row.type === 'multicheck' || row.control) return v;
  if (row.type === 'bool') return toBool(v);
  if (row.type === 'integer') return v === '' ? null : Number(v);
  return v === '' ? null : v;
};

function SheetControl({ row, id, value, onChange }) {
  const { t } = useI18n();
  if (row.control) return row.control(value, onChange);
  switch (row.type) {
    case 'text':
      return <input id={id} className="form-control" value={value} maxLength={row.maxLength ?? 200} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
    case 'bool':
    case 'integer': {
      const options = row.type === 'bool' ? yesNo(t) : row.options;
      return (
        <select id={id} className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {!row.required && <option value="">{t('common.none')}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'multicheck': {
      if (!row.options.length) return <p className="small text-body-secondary mb-0">{t(row.emptyText ?? 'common.empty')}</p>;
      const chosen = new Set(value);
      return (
        <div className="kt-multicheck" role="group" aria-labelledby={`${id}-label`}>
          {row.options.map((o) => (
            <div className="form-check" key={o.value}>
              <input className="form-check-input" type="checkbox" id={`${id}-${o.value}`} checked={chosen.has(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
              <label className="form-check-label" htmlFor={`${id}-${o.value}`}>{o.label}</label>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <textarea id={id} className="form-control" rows={row.rows ?? 3} maxLength={row.maxLength ?? 10000} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * rows: [{ label, guide, name?, type?: text|textarea|select|bool|integer|multicheck, options?, required?, render?(), control?(value, set) }]
 * Linhas sem `name` são só leitura (`render`); as com `name` entram no PATCH.
 */
function RecordSheet({ code, title, rows, record, onSave, onSaved, transform = (p) => p }) {
  const { t } = useI18n();
  const toast = useToast();
  const editable = rows.filter((r) => r.name);
  const initialValues = Object.fromEntries(editable.map((r) => [r.name, toFormValue(r, record[r.name])]));
  const [values, setValues] = useState(initialValues);
  const dirty = !sameValues(values, initialValues);
  useUnsavedChanges(dirty);
  const { submit, busy, errors } = useSubmit(onSave, {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      onSaved?.(saved);
    },
  });
  const save = (e) => {
    e.preventDefault();
    submit(transform(Object.fromEntries(editable.map((r) => [r.name, toPayloadValue(r, values[r.name])]))));
  };
  return (
    <form className="mb-5" onSubmit={save} onKeyDown={saveShortcut} noValidate>
      <div className="table-responsive">
        <table className="table table-bordered kt-sheet mb-2">
          <thead>
            <tr className="kt-sheet-title"><th colSpan={4} scope="colgroup">{t('ck.worksheet')} {code}: {title}</th></tr>
            <tr>
              <th scope="col" className="kt-sheet-n">Nº</th>
              <th scope="col" className="kt-sheet-item">{t('ck.item')}</th>
              <th scope="col" className="kt-sheet-guide d-none d-md-table-cell">{t('ck.guide')}</th>
              <th scope="col">{t('ck.value')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const id = `${code}-${row.name ?? i}`;
              return (
                <tr key={row.name ?? `r${i}`}>
                  <td className="kt-sheet-n">{i + 1}</td>
                  <th scope="row" className="kt-sheet-item" id={`${id}-label`}>
                    {row.name && !row.control && row.type !== 'multicheck' ? <label htmlFor={id}>{row.label}</label> : row.label}
                    {row.required && <span className="text-danger" aria-hidden="true"> *</span>}
                  </th>
                  <td className="kt-sheet-guide d-none d-md-table-cell">{row.guide}</td>
                  <td>
                    {row.guide && <div className="kt-sheet-guide-inline d-md-none">{row.guide}</div>}
                    {row.name ? (
                      <SheetControl row={row} id={id} value={values[row.name]} onChange={(v) => setValues((s) => ({ ...s, [row.name]: v }))} />
                    ) : (
                      <div className="kt-prewrap">{row.render()}</div>
                    )}
                    {row.name && errors[row.name] && <div className="invalid-feedback d-block">{errors[row.name]}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SaveButton busy={busy} dirty={dirty} label={t('ck.saveSheet')} />
    </form>
  );
}

// Detalhe genérico: carrega o registro e os cadastros, e desenha o cabeçalho
function useDetail(project, resource, id) {
  const api = useMemo(() => resourceApi(`${base(project)}/${resource}`), [project, resource]);
  const item = useAsync(() => api.get(id), [project.id, resource, id]);
  return { api, item };
}

function DetailHeader({ title, children }) {
  return (
    <>
      <h3 className="h2 mb-1">{title}</h3>
      <div className="mb-4">{children}</div>
    </>
  );
}

// ---------- OM-3 / TM-1: tarefas ----------
function taskFields(t, txt, data) {
  return [
    field(txt, 'code', { required: true, maxLength: 20, col: 'col-md-3' }),
    field(txt, 'name', { required: true, maxLength: 200, col: 'col-md-9' }),
    field(txt, 'agentIds', { type: 'multicheck', options: data.agents.map((a) => ({ value: a.id, label: a.name })), emptyText: 'ck.noAgents', col: 'col-md-6' }),
    field(txt, 'knowledgeIds', { type: 'multicheck', options: data.knowledge.map((k) => ({ value: k.id, label: k.name })), emptyText: 'ck.noKnowledge', col: 'col-md-6' }),
    field(txt, 'location', { maxLength: 200, col: 'col-md-6' }),
    field(txt, 'knowledgeIntensive', { type: 'select', options: yesNo(t), col: 'col-md-3' }),
    field(txt, 'significance', { type: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })), col: 'col-md-3' }),
  ];
}
const taskTransform = (p) => ({
  ...p,
  knowledgeIntensive: toBool(p.knowledgeIntensive),
  significance: p.significance == null ? null : Number(p.significance),
});

function Tasks() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const data = useCkData(project);
  if (!data.ready) return <Loading small />;
  const txt = ckText(locale).task;
  const agents = byId(data.agents);
  const knowledge = byId(data.knowledge);
  return (
    <>
      <RegistryHeader project={project} data={data} keys={['om-3', 'tm-1']} />
      <ResourceManager
        path={`${base(project)}/tasks`}
        singular="ck.task"
        fields={taskFields(t, txt, data)}
        transform={taskTransform}
        columns={[
          { key: 'code', label: txt.code[0] },
          { key: 'name', label: txt.name[0] },
          { key: 'agentIds', label: txt.agentIds[0], render: (r) => joined(pickNames(r.agentIds, agents)) },
          { key: 'location', label: txt.location[0] },
          { key: 'knowledgeIds', label: txt.knowledgeIds[0], render: (r) => joined(pickNames(r.knowledgeIds, knowledge)) },
          { key: 'knowledgeIntensive', label: txt.knowledgeIntensive[0], render: (r) => yn(t, r.knowledgeIntensive) },
          { key: 'significance', label: txt.significance[0], render: (r) => r.significance ?? '—' },
        ]}
        rowLink={(r) => `${base(project)}/tasks/${r.id}`}
        nameOf={taskLabel}
        onChange={data.reload}
        afterCreate={(row) => navigate(`${base(project)}/tasks/${row.id}`)}
      />
    </>
  );
}

function TaskDetail() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const { taskId } = useParams();
  const data = useCkData(project);
  const { api, item } = useDetail(project, 'tasks', taskId);
  useCrumbLabel('ckTask', item.data ? taskLabel(item.data) : null);
  if ((item.loading && !item.data) || !data.ready) return <Loading small />;
  if (!item.data) return null;
  const task = item.data;
  const txt = ckText(locale);
  const tt = txt.task;
  const agents = byId(data.agents);
  const row = (name, extra) => ({ name, label: tt[name][0], guide: tt[name][1], ...extra });
  const save = (body) => api.update(task.id, body);
  const saved = (s) => {
    item.setData(s);
    data.reload();
  };
  return (
    <article>
      <DetailHeader title={taskLabel(task)}>
        {task.knowledgeIntensive && badge(tt.knowledgeIntensive[0].replace('?', ''), 'text-bg-primary')}
        {task.significance && <span className="ms-1">{badge(`${tt.significance[0]}: ${task.significance}`)}</span>}
      </DetailHeader>
      <RecordSheet key={`tm1-${task.id}`} code="TM-1" title={txt.worksheets['tm-1'].title} record={task} onSave={save} onSaved={saved} rows={[
        { label: tt.name[0], guide: tt.name[1], render: () => taskLabel(task) },
        row('organization'), row('goalValue'), row('dependencyFlow'), row('objectsHandled'), row('timingControl'),
        {
          label: tt.agents[0], guide: tt.agents[1],
          render: () => {
            const linked = task.agentIds.filter((id) => agents[id]);
            return linked.length
              ? linked.map((id, i) => <span key={id}>{i > 0 && ', '}<Link to={`${base(project)}/agents/${id}`}>{agents[id].name}</Link></span>)
              : '—';
          },
        },
        row('knowledgeCompetence'), row('resources'), row('qualityPerformance'),
      ]} />
      <RecordSheet key={`om3-${task.id}`} code="OM-3" title={txt.worksheets['om-3'].title} record={task} onSave={save} onSaved={saved}
        transform={taskTransform}
        rows={taskFields(t, tt, data).map((f) => ({
          name: f.name, label: f.label, guide: f.help, required: f.required, emptyText: f.emptyText,
          type: f.type ?? 'text', options: f.options, maxLength: f.maxLength,
        }))} />
    </article>
  );
}

// ---------- OM-4 / TM-2: conhecimento ----------
function knowledgeRelations(data) {
  const tasks = data.tasks;
  const agents = data.agents;
  return (k) => ({
    possessedBy: agents.filter((a) => a.knowledgeIds.includes(k.id)),
    usedIn: tasks.filter((x) => x.knowledgeIds.includes(k.id)),
  });
}

function KnowledgeList() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const data = useCkData(project);
  if (!data.ready) return <Loading small />;
  const txt = ckText(locale).knowledge;
  const rel = knowledgeRelations(data);
  const check = (r, f) => {
    const v = yn(t, r[f]);
    const notes = r[`${f}Notes`];
    return notes ? <span title={notes}>{v} <i className="bi bi-chat-left-text small" aria-label={notes} /></span> : v;
  };
  return (
    <>
      <RegistryHeader project={project} data={data} keys={['om-4', 'tm-2']} />
      <ResourceManager
        path={`${base(project)}/knowledge`}
        singular="ck.knowledgeItem"
        fields={[
          field(txt, 'name', { required: true, maxLength: 200, col: 'col-md-6' }),
          field(txt, 'domain', { maxLength: 300, col: 'col-md-6' }),
          ...ASSESSMENT.map((f) => field(txt, f, { type: 'select', options: yesNo(t), col: 'col-md-3' })),
        ]}
        transform={(p) => ({ ...p, ...Object.fromEntries(ASSESSMENT.map((f) => [f, toBool(p[f])])) })}
        columns={[
          { key: 'name', label: txt.name[0] },
          { key: 'possessedBy', label: txt.possessedBy[0], render: (r) => joined(rel(r).possessedBy.map((a) => a.name)) },
          { key: 'usedIn', label: txt.usedIn[0], render: (r) => joined(rel(r).usedIn.map((x) => x.code)) },
          ...ASSESSMENT.map((f) => ({ key: f, label: txt[f][0], render: (r) => check(r, f) })),
          { key: 'characterization', label: t('ck.bottleneck'),
            render: (r) => (hasBottleneck(r.characterization) ? <i className="bi bi-exclamation-triangle-fill text-warning" aria-label={t('common.yes')} /> : '—') },
        ]}
        rowLink={(r) => `${base(project)}/knowledge/${r.id}`}
        nameOf={(r) => r.name}
        onChange={data.reload}
        afterCreate={(row) => navigate(`${base(project)}/knowledge/${row.id}`)}
      />
    </>
  );
}

// Natureza, forma e disponibilidade: aplica? comentários, gargalo?
function CharacterizationTable({ group, value, onChange }) {
  const { t, locale } = useI18n();
  const labels = ckText(locale).characterization[group];
  const set = (key, patch) => onChange({ ...value, [key]: { ...(value[key] ?? {}), ...patch } });
  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm align-middle kt-sheet mb-4">
        <thead>
          <tr>
            <th scope="col" className="kt-sheet-n">Nº</th>
            <th scope="col" className="kt-sheet-item">{t(`ck.groups.${group}`)}</th>
            <th scope="col" className="text-center" style={{ width: '6rem' }}>{t('ck.applies')}</th>
            <th scope="col">{t('ck.comments')}</th>
            <th scope="col" className="text-center" style={{ width: '9rem' }}>{t('ck.bottleneck')}</th>
          </tr>
        </thead>
        <tbody>
          {CHARACTERIZATION[group].map((key, i) => {
            const e = value[key] ?? {};
            return (
              <tr key={key}>
                <td className="kt-sheet-n">{i + 1}</td>
                <th scope="row" className="kt-sheet-item fw-normal">{labels[key]}</th>
                <td className="text-center">
                  <input type="checkbox" className="form-check-input" checked={Boolean(e.applies)} aria-label={`${labels[key]}: ${t('ck.applies')}`}
                    onChange={(ev) => set(key, { applies: ev.target.checked })} />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={e.notes ?? ''} maxLength={2000} aria-label={`${labels[key]}: ${t('ck.comments')}`}
                    onChange={(ev) => set(key, { notes: ev.target.value })} />
                </td>
                <td className="text-center">
                  <input type="checkbox" className="form-check-input" checked={Boolean(e.bottleneck)} aria-label={`${labels[key]}: ${t('ck.bottleneck')}`}
                    onChange={(ev) => set(key, { bottleneck: ev.target.checked })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Só guarda os itens marcados ou comentados
function cleanCharacterization(c) {
  return Object.fromEntries(
    Object.keys(CHARACTERIZATION).map((g) => [
      g,
      Object.fromEntries(
        Object.entries(c[g] ?? {})
          .map(([k, e]) => [k, { applies: Boolean(e.applies), bottleneck: Boolean(e.bottleneck), ...(e.notes?.trim() && { notes: e.notes.trim() }) }])
          .filter(([, e]) => e.applies || e.bottleneck || e.notes),
      ),
    ]),
  );
}

function KnowledgeSheet({ project, record, data, onSaved }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const txt = ckText(locale);
  const kt = txt.knowledge;
  const rel = knowledgeRelations(data)(record);
  const initialValues = {
    name: record.name,
    domain: record.domain ?? '',
    ...Object.fromEntries(ASSESSMENT.flatMap((f) => [[f, record[f] == null ? '' : String(record[f])], [`${f}Notes`, record[`${f}Notes`] ?? '']])),
  };
  const [values, setValues] = useState(initialValues);
  const [characterization, setCharacterization] = useState(() => record.characterization ?? {});
  const dirty = !sameValues(values, initialValues)
    || !sameValues(cleanCharacterization(characterization), cleanCharacterization(record.characterization ?? {}));
  useUnsavedChanges(dirty);
  const { submit, busy, errors } = useSubmit((body) => resourceApi(`${base(project)}/knowledge`).update(record.id, body), {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      onSaved(saved);
    },
  });
  const set = (name) => (e) => setValues((s) => ({ ...s, [name]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    submit({
      name: values.name,
      domain: values.domain.trim() || null,
      ...Object.fromEntries(ASSESSMENT.flatMap((f) => [[f, toBool(values[f])], [`${f}Notes`, values[`${f}Notes`].trim() || null]])),
      characterization: cleanCharacterization(characterization),
    });
  };
  const links = (rows, route, label) =>
    rows.length ? rows.map((r, i) => <span key={r.id}>{i > 0 && ', '}<Link to={`${base(project)}/${route}/${r.id}`}>{label(r)}</Link></span>) : '—';
  return (
    <form onSubmit={save} onKeyDown={saveShortcut} noValidate>
      <div className="table-responsive">
        <table className="table table-bordered kt-sheet mb-4">
          <thead>
            <tr className="kt-sheet-title"><th colSpan={3} scope="colgroup">{t('ck.worksheet')} TM-2: {txt.worksheets['tm-2'].title}</th></tr>
          </thead>
          <tbody>
            {[
              ['name', <input key="n" id="k-name" className="form-control" required maxLength={200} value={values.name} onChange={set('name')} />],
              ['possessedBy', links(rel.possessedBy, 'agents', (a) => a.name)],
              ['usedIn', links(rel.usedIn, 'tasks', taskLabel)],
              ['domain', <input key="d" id="k-domain" className="form-control" maxLength={300} value={values.domain} onChange={set('domain')} />],
            ].map(([key, control]) => (
              <tr key={key}>
                <th scope="row" className="kt-sheet-item">
                  {['name', 'domain'].includes(key) ? <label htmlFor={`k-${key}`}>{kt[key][0]}</label> : kt[key][0]}
                </th>
                <td className="kt-sheet-guide d-none d-md-table-cell">{kt[key][1]}</td>
                <td>{control}{errors[key] && <div className="invalid-feedback d-block">{errors[key]}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="h4">{t('ck.characterization')}</h4>
      {Object.keys(CHARACTERIZATION).map((g) => (
        <CharacterizationTable key={g} group={g} value={characterization[g] ?? {}}
          onChange={(v) => setCharacterization((c) => ({ ...c, [g]: v }))} />
      ))}

      <h4 className="h4">{t('ck.worksheet')} OM-4 · {t('ck.assessment')}</h4>
      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle kt-sheet mb-3">
          <thead>
            <tr>
              <th scope="col" className="kt-sheet-item">{t('ck.item')}</th>
              <th scope="col" style={{ width: '9rem' }}>{t('common.yes')} / {t('common.no')}</th>
              <th scope="col">{t('ck.comments')}</th>
            </tr>
          </thead>
          <tbody>
            {ASSESSMENT.map((f) => (
              <tr key={f}>
                <th scope="row" className="kt-sheet-item fw-normal" title={kt[f][1]}>{kt[f][0]}</th>
                <td>
                  <select className="form-select form-select-sm" value={values[f]} aria-label={kt[f][0]} onChange={set(f)}>
                    <option value="">{t('common.none')}</option>
                    {yesNo(t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <input className="form-control form-control-sm" value={values[`${f}Notes`]} maxLength={2000} aria-label={`${kt[f][0]}: ${t('ck.comments')}`}
                    onChange={set(`${f}Notes`)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton busy={busy} dirty={dirty} label={t('ck.saveSheet')} className="mb-4" />
    </form>
  );
}

function KnowledgeDetail() {
  const { t } = useI18n();
  const { project } = useProject();
  const { knowledgeId } = useParams();
  const data = useCkData(project);
  const { item } = useDetail(project, 'knowledge', knowledgeId);
  useCrumbLabel('ckKnowledge', item.data?.name);
  if ((item.loading && !item.data) || !data.ready) return <Loading small />;
  if (!item.data) return null;
  const k = item.data;
  return (
    <article>
      <DetailHeader title={k.name}>
        {hasBottleneck(k.characterization) && badge(t('ck.counts.bottlenecks'), 'text-bg-warning')}
      </DetailHeader>
      <KnowledgeSheet key={k.id} project={project} record={k} data={data} onSaved={(s) => { item.setData(s); data.reload(); }} />
    </article>
  );
}

// ---------- AM-1 / MAS: agentes ----------
function agentFields(t, txt, data, selfId) {
  return [
    field(txt, 'name', { required: true, maxLength: 200, col: 'col-md-8' }),
    field(txt, 'kind', { type: 'select', required: true, options: opts(t, 'agentKind'), default: 'human', col: 'col-md-4' }),
    field(txt, 'organization', { type: 'textarea', rows: 2, maxLength: 10000 }),
    field(txt, 'knowledgeIds', { type: 'multicheck', options: data.knowledge.map((k) => ({ value: k.id, label: k.name })), emptyText: 'ck.noKnowledge', col: 'col-md-6' }),
    field(txt, 'communicatesWithIds', {
      type: 'multicheck', options: data.agents.filter((a) => a.id !== selfId).map((a) => ({ value: a.id, label: a.name })), emptyText: 'ck.noAgents', col: 'col-md-6',
    }),
    field(txt, 'otherCompetences', { type: 'textarea', rows: 2, maxLength: 10000 }),
    field(txt, 'responsibilities', { type: 'textarea', rows: 2, maxLength: 10000 }),
  ];
}

function Agents() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const data = useCkData(project);
  if (!data.ready) return <Loading small />;
  const txt = ckText(locale).agent;
  const agents = byId(data.agents);
  const knowledge = byId(data.knowledge);
  const engaged = (a) => data.tasks.filter((x) => x.agentIds.includes(a.id)).map((x) => x.code);
  return (
    <>
      <RegistryHeader project={project} data={data} keys={['am-1', 'mas']} />
      <ResourceManager
        path={`${base(project)}/agents`}
        singular="ck.agent"
        fields={agentFields(t, txt, data)}
        columns={[
          { key: 'name', label: txt.name[0] },
          { key: 'kind', label: txt.kind[0], render: (r) => t(`enums.agentKind.${r.kind}`) },
          { key: 'engagedIn', label: txt.engagedIn[0], render: (r) => joined(engaged(r)) },
          { key: 'communicatesWithIds', label: txt.communicatesWithIds[0], render: (r) => joined(pickNames(r.communicatesWithIds, agents)) },
          { key: 'knowledgeIds', label: txt.knowledgeIds[0], render: (r) => joined(pickNames(r.knowledgeIds, knowledge)) },
        ]}
        rowLink={(r) => `${base(project)}/agents/${r.id}`}
        nameOf={(r) => r.name}
        onChange={data.reload}
        afterCreate={(row) => navigate(`${base(project)}/agents/${row.id}`)}
      />
    </>
  );
}

function AgentDetail() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const { agentId } = useParams();
  const data = useCkData(project);
  const { api, item } = useDetail(project, 'agents', agentId);
  useCrumbLabel('ckAgent', item.data?.name);
  if ((item.loading && !item.data) || !data.ready) return <Loading small />;
  if (!item.data) return null;
  const a = item.data;
  const txt = ckText(locale);
  const at = txt.agent;
  const tasks = data.tasks.filter((x) => x.agentIds.includes(a.id));
  const fields = agentFields(t, at, data, a.id);
  const asRow = (f) => ({
    name: f.name, label: f.label, guide: f.help, required: f.required, emptyText: f.emptyText,
    type: f.type === 'select' ? 'select' : f.type === 'multicheck' ? 'multicheck' : f.type === 'textarea' ? 'textarea' : 'text',
    options: f.options, maxLength: f.maxLength,
  });
  const byName = Object.fromEntries(fields.map((f) => [f.name, asRow(f)]));
  const save = (body) => api.update(a.id, body);
  const saved = (s) => {
    item.setData(s);
    data.reload();
  };
  return (
    <article>
      <DetailHeader title={a.name}>
        {badge(t(`enums.agentKind.${a.kind}`))}
      </DetailHeader>
      <RecordSheet key={`am1-${a.id}`} code="AM-1" title={txt.worksheets['am-1'].title} record={a} onSave={save} onSaved={saved} rows={[
        byName.name, byName.kind, byName.organization,
        {
          label: at.engagedIn[0], guide: at.engagedIn[1],
          render: () => (tasks.length ? tasks.map((x, i) => (
            <span key={x.id}>{i > 0 && ', '}<Link to={`${base(project)}/tasks/${x.id}`}>{taskLabel(x)}</Link></span>
          )) : '—'),
        },
        byName.communicatesWithIds, byName.knowledgeIds, byName.otherCompetences, byName.responsibilities,
      ]} />
      <p className="text-body-secondary small">{txt.worksheets.mas.text}</p>
      <RecordSheet key={`mas-${a.id}`} code="MAS" title={txt.worksheets.mas.title} record={a} onSave={save} onSaved={saved}
        rows={MAS_FIELDS.map((f) => ({
          name: f, label: txt.mas[f][0], guide: txt.mas[f][1], type: f === 'representationLanguage' ? 'text' : 'textarea', rows: 2,
        }))} />
    </article>
  );
}

// ---------- CM-1 / CM-2: transações ----------
function transactionFields(txt, data) {
  const taskOptions = data.tasks.map((x) => ({ value: x.id, label: taskLabel(x) }));
  const agentOptions = data.agents.map((a) => ({ value: a.id, label: a.name }));
  return [
    field(txt, 'code', { required: true, maxLength: 20, col: 'col-md-3' }),
    field(txt, 'name', { required: true, maxLength: 200, col: 'col-md-9' }),
    field(txt, 'purpose', { type: 'textarea', rows: 2, maxLength: 5000 }),
    field(txt, 'informationObject', { maxLength: 500 }),
    field(txt, 'fromTaskId', { type: 'select', options: taskOptions, col: 'col-md-6' }),
    field(txt, 'toTaskId', { type: 'select', options: taskOptions, col: 'col-md-6' }),
    field(txt, 'senderAgentId', { type: 'select', options: agentOptions, col: 'col-md-6' }),
    field(txt, 'receiverAgentId', { type: 'select', options: agentOptions, col: 'col-md-6' }),
    field(txt, 'communicationPlan', { type: 'textarea', rows: 2, maxLength: 5000 }),
    field(txt, 'constraints', { type: 'textarea', rows: 2, maxLength: 5000 }),
  ];
}

function Communication() {
  const { locale } = useI18n();
  const { project } = useProject();
  const navigate = useNavigate();
  const data = useCkData(project);
  if (!data.ready) return <Loading small />;
  const txt = ckText(locale).transaction;
  const agents = byId(data.agents);
  return (
    <>
      <RegistryHeader project={project} data={data} keys={['cm-1', 'cm-2']} />
      <ResourceManager
        path={`${base(project)}/transactions`}
        singular="ck.transaction"
        fields={transactionFields(txt, data)}
        columns={[
          { key: 'code', label: txt.code[0] },
          { key: 'name', label: txt.name[0] },
          { key: 'informationObject', label: txt.informationObject[0] },
          { key: 'senderAgentId', label: `${txt.senderAgentId[0]} → ${txt.receiverAgentId[0]}`,
            render: (r) => `${agents[r.senderAgentId]?.name ?? '—'} → ${agents[r.receiverAgentId]?.name ?? '—'}` },
          { key: 'messages', label: txt.messages[0], render: (r) => r.messages.length },
        ]}
        rowLink={(r) => `${base(project)}/communication/${r.id}`}
        nameOf={(r) => `${r.code} — ${r.name}`}
        onChange={data.reload}
        afterCreate={(row) => navigate(`${base(project)}/communication/${row.id}`)}
      />
    </>
  );
}

function TransactionDetail() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const { transactionId } = useParams();
  const data = useCkData(project);
  const { api, item } = useDetail(project, 'transactions', transactionId);
  useCrumbLabel('ckTransaction', item.data ? `${item.data.code} — ${item.data.name}` : null);
  if ((item.loading && !item.data) || !data.ready) return <Loading small />;
  if (!item.data) return null;
  const tr = item.data;
  const txt = ckText(locale);
  const tt = txt.transaction;
  const agents = byId(data.agents);
  const fields = transactionFields(tt, data);
  const save = (body) => api.update(tr.id, body);
  const saved = (s) => {
    item.setData(s);
    data.reload();
  };
  return (
    <article>
      <DetailHeader title={`${tr.code} — ${tr.name}`}>
        <span className="small text-body-secondary">
          {agents[tr.senderAgentId]?.name ?? '—'} → {agents[tr.receiverAgentId]?.name ?? '—'}
        </span>
      </DetailHeader>
      <RecordSheet key={`cm1-${tr.id}`} code="CM-1" title={txt.worksheets['cm-1'].title} record={tr} onSave={save} onSaved={saved}
        rows={fields.map((f) => ({
          name: f.name, label: f.label, guide: f.help, required: f.required,
          type: f.type === 'select' ? 'select' : f.type === 'textarea' ? 'textarea' : 'text', options: f.options, maxLength: f.maxLength,
        }))} />
      <RecordSheet key={`cm2-${tr.id}`} code="CM-2" title={txt.worksheets['cm-2'].title} record={tr} onSave={save} onSaved={saved}
        transform={(p) => ({
          ...p,
          informationItems: p.informationItems.filter((x) => x.name?.trim()).map((x) => ({ ...x, name: x.name.trim() })),
          messages: p.messages.filter((m) => m.content?.trim()).map((m) => ({ ...m, content: m.content.trim() })),
        })}
        rows={[
          { label: tt.code[0], guide: tt.name[1], render: () => `${tr.code} — ${tr.name}` },
          { label: `${tt.senderAgentId[0]} / ${tt.receiverAgentId[0]}`, guide: tt.receiverAgentId[1],
            render: () => `${agents[tr.senderAgentId]?.name ?? '—'} → ${agents[tr.receiverAgentId]?.name ?? '—'}` },
          {
            name: 'informationItems', label: tt.informationItems[0], guide: tt.informationItems[1],
            control: (value, set) => (
              <RowsEditor caption={tt.informationItems[0]} rows={value} onChange={set} addLabel={t('ck.addItem')} empty={t('ck.noRows')}
                columns={[
                  { name: 'name', label: t('ck.item'), required: true, maxLength: 200, width: '30%' },
                  { name: 'role', label: t('ck.role'), type: 'select', options: opts(t, 'itemRole'), width: '15%' },
                  { name: 'form', label: t('ck.form'), maxLength: 500 },
                  { name: 'medium', label: t('ck.medium'), maxLength: 500 },
                ]} />
            ),
          },
          {
            name: 'messages', label: tt.messages[0], guide: tt.messages[1],
            control: (value, set) => (
              <RowsEditor caption={tt.messages[0]} rows={value} onChange={set} addLabel={t('ck.addMessage')} empty={t('ck.noRows')}
                columns={[
                  { name: 'type', label: t('ck.commType'), type: 'select', options: opts(t, 'communicationType'), width: '24%' },
                  { name: 'content', label: t('ck.content'), required: true, maxLength: 2000 },
                  { name: 'reference', label: t('ck.reference'), maxLength: 500, width: '25%' },
                ]} />
            ),
          },
          { name: 'messageControl', label: tt.messageControl[0], guide: tt.messageControl[1], type: 'textarea' },
        ]} />
    </article>
  );
}

// ---------- Documento ----------
function ReadSheet({ code, title, status, rows }) {
  const { t } = useI18n();
  return (
    <div className="table-responsive kt-doc-block">
      <table className="table table-bordered table-sm kt-sheet mb-0">
        <thead>
          <tr className="kt-sheet-title">
            <th colSpan={3} scope="colgroup">
              {t('ck.worksheet')} {code}: {title}
              {status && <span className={`badge ms-2 ${STATUS_BADGE[status]}`}>{t(`enums.phaseStatus.${status}`)}</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i}>
              <td className="kt-sheet-n">{i + 1}</td>
              <th scope="row" className="kt-sheet-item">{label}</th>
              <td className="kt-prewrap">{value == null || value === '' ? '—' : value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const refs = (list) => joined((list ?? []).map((x) => x.label));

function Document() {
  const { t, locale } = useI18n();
  const { project } = useProject();
  const report = useAsync(() => commonkadsApi.report(project.id), [project.id]);
  if (report.loading && !report.data) return <Loading small />;
  if (!report.data) return null;
  const r = report.data;
  const txt = ckText(locale);
  const ws = Object.fromEntries(r.worksheets.map((w) => [w.key, w]));
  const title = (key) => txt.worksheets[key].title;
  const empty = (list) => (list.length ? null : <EmptyState>{t('common.empty')}</EmptyState>);

  const textSheet = (key) => (
    <ReadSheet key={key} code={sheetCode(key)} title={title(key)} status={ws[key].status}
      rows={ws[key].fields.map((f) => [txt.worksheets[key].fields[f][0], ws[key].content[f]])} />
  );
  const sections = {
    'om-3': () => (
      <div className="table-responsive kt-doc-block" key="om-3">
        <table className="table table-bordered table-sm kt-sheet">
          <thead>
            <tr className="kt-sheet-title"><th colSpan={7}>{t('ck.worksheet')} OM-3: {title('om-3')}</th></tr>
            <tr>{['code', 'name', 'agentIds', 'location', 'knowledgeIds', 'knowledgeIntensive', 'significance'].map((f) => <th key={f}>{txt.task[f][0]}</th>)}</tr>
          </thead>
          <tbody>
            {r.tasks.map((x) => (
              <tr key={x.id}>
                <td>{x.code}</td><td>{x.name}</td><td>{refs(x.agents)}</td><td>{x.location ?? '—'}</td>
                <td>{refs(x.knowledge)}</td><td>{yn(t, x.knowledgeIntensive)}</td><td>{x.significance ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {empty(r.tasks)}
      </div>
    ),
    'om-4': () => (
      <div className="table-responsive kt-doc-block" key="om-4">
        <table className="table table-bordered table-sm kt-sheet">
          <thead>
            <tr className="kt-sheet-title"><th colSpan={7}>{t('ck.worksheet')} OM-4: {title('om-4')}</th></tr>
            <tr>{['name', 'possessedBy', 'usedIn', ...ASSESSMENT].map((f) => <th key={f}>{txt.knowledge[f][0]}</th>)}</tr>
          </thead>
          <tbody>
            {r.knowledge.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td><td>{refs(k.possessedBy)}</td><td>{refs(k.usedIn)}</td>
                {ASSESSMENT.map((f) => <td key={f}>{yn(t, k[f])}{k[`${f}Notes`] && `; ${k[`${f}Notes`]}`}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {empty(r.knowledge)}
      </div>
    ),
    'tm-1': () => [empty(r.tasks), ...r.tasks.map((x) => (
      <ReadSheet key={`tm1-${x.id}`} code="TM-1" title={`${title('tm-1')} — ${taskLabel(x)}`} rows={[
        ...['organization', 'goalValue', 'dependencyFlow', 'objectsHandled', 'timingControl'].map((f) => [txt.task[f][0], x[f]]),
        [txt.task.agents[0], refs(x.agents)],
        ...['knowledgeCompetence', 'resources', 'qualityPerformance'].map((f) => [txt.task[f][0], x[f]]),
      ]} />
    ))],
    'tm-2': () => [empty(r.knowledge), ...r.knowledge.map((k) => (
      <ReadSheet key={`tm2-${k.id}`} code="TM-2" title={`${title('tm-2')} — ${k.name}`} rows={[
        [txt.knowledge.possessedBy[0], refs(k.possessedBy)],
        [txt.knowledge.usedIn[0], refs(k.usedIn)],
        [txt.knowledge.domain[0], k.domain],
        ...Object.keys(CHARACTERIZATION).map((g) => [t(`ck.groups.${g}`), Object.entries(k.characterization?.[g] ?? {})
          .map(([key, e]) => `${txt.characterization[g][key]}${e.notes ? ` (${e.notes})` : ''}${e.bottleneck ? ` — ${t('ck.bottleneck')}` : ''}`)
          .join('\n')]),
      ]} />
    ))],
    'am-1': () => [empty(r.agents), ...r.agents.map((a) => (
      <ReadSheet key={`am1-${a.id}`} code="AM-1" title={`${title('am-1')} — ${a.name}`} rows={[
        [txt.agent.kind[0], t(`enums.agentKind.${a.kind}`)],
        [txt.agent.organization[0], a.organization],
        [txt.agent.engagedIn[0], refs(a.engagedIn)],
        [txt.agent.communicatesWithIds[0], refs(a.communicatesWith)],
        [txt.agent.knowledgeIds[0], refs(a.knowledge)],
        [txt.agent.otherCompetences[0], a.otherCompetences],
        [txt.agent.responsibilities[0], a.responsibilities],
      ]} />
    ))],
    mas: () => {
      const filledAgents = r.agents.filter((a) => MAS_FIELDS.some((f) => a[f]));
      return [empty(filledAgents), ...filledAgents.map((a) => (
        <ReadSheet key={`mas-${a.id}`} code="MAS" title={`${title('mas')} — ${a.name}`} rows={MAS_FIELDS.map((f) => [txt.mas[f][0], a[f]])} />
      ))];
    },
    'cm-1': () => [empty(r.transactions), ...r.transactions.map((x) => (
      <ReadSheet key={`cm1-${x.id}`} code="CM-1" title={`${title('cm-1')} — ${x.code} ${x.name}`} rows={[
        [txt.transaction.purpose[0], x.purpose],
        [txt.transaction.informationObject[0], x.informationObject],
        [`${txt.transaction.fromTaskId[0]} → ${txt.transaction.toTaskId[0]}`, `${x.fromTask?.label ?? '—'} → ${x.toTask?.label ?? '—'}`],
        [`${txt.transaction.senderAgentId[0]} → ${txt.transaction.receiverAgentId[0]}`, `${x.sender?.label ?? '—'} → ${x.receiver?.label ?? '—'}`],
        [txt.transaction.communicationPlan[0], x.communicationPlan],
        [txt.transaction.constraints[0], x.constraints],
      ]} />
    ))],
    'cm-2': () => [empty(r.transactions), ...r.transactions.map((x) => (
      <ReadSheet key={`cm2-${x.id}`} code="CM-2" title={`${title('cm-2')} — ${x.code} ${x.name}`} rows={[
        [txt.transaction.informationItems[0], x.informationItems.map((i) => `${i.name} (${t(`enums.itemRole.${i.role}`)}${i.form ? `; ${i.form}` : ''}${i.medium ? `; ${i.medium}` : ''})`).join('\n')],
        [txt.transaction.messages[0], x.messages.map((m, i) => `${i + 1}. ${t(`enums.communicationType.${m.type}`)}: ${m.content}${m.reference ? ` [${m.reference}]` : ''}`).join('\n')],
        [txt.transaction.messageControl[0], x.messageControl],
      ]} />
    ))],
  };

  return (
    <article className="kt-report">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mt-0 border-0">{t('ck.reportTitle')}</h2>
          <p className="text-body-secondary mb-0">{r.project.name} · v{r.project.version} · {formatDate(r.generatedAt, locale)}</p>
        </div>
        <button type="button" className="btn btn-accent kt-no-print" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" aria-hidden="true" />{t('common.print')}
        </button>
      </div>
      {MODELS.map((model) => (
        <section key={model}>
          <h2>{t(`ck.models.${model}`)}</h2>
          {r.worksheets.filter((w) => w.model === model).map((w) => (
            <div key={w.key} className="mb-4">
              {w.resource && <h3 className="h4">{sheetCode(w.key)} — {title(w.key)}</h3>}
              {w.resource ? sections[w.key]() : textSheet(w.key)}
              {w.notes && <p className="small text-body-secondary mt-1">{t('ck.notes')}: {w.notes}</p>}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

export const CkLayout = Layout;
export const CkOverview = Overview;
export const CkOrganization = () => <Sheets keys={['om-1', 'om-2', 'om-3', 'om-4', 'om-5']} />;
export const CkImpact = () => <Sheets keys={['ota-1']} />;
export const CkKnowledgeModel = () => <Sheets keys={['km-1']} />;
export const CkDesign = () => <Sheets keys={['dm-1', 'dm-2', 'dm-3', 'dm-4']} />;
export const CkTasks = Tasks;
export const CkTaskDetail = TaskDetail;
export const CkKnowledge = KnowledgeList;
export const CkKnowledgeDetail = KnowledgeDetail;
export const CkAgents = Agents;
export const CkAgentDetail = AgentDetail;
export const CkCommunication = Communication;
export const CkTransactionDetail = TransactionDetail;
export const CkDocument = Document;
