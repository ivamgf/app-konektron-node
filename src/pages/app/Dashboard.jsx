import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { authApi, projectsApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { FieldGrid, toPayload } from '../../components/forms.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, EmptyState, Loading, Modal, Pagination } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { formatDay } from '../billing/Billing.jsx';

const PAGE_SIZE = 12;

// Cor e ícone por tipo de projeto (as mesmas da Análise de Sistemas e do CRISP-DM em Engenharia)
export const PROJECT_TYPE_STYLE = {
  software: { color: '#0189b6', icon: 'diagram-3', section: 'system-analysis' },
  data_analysis: { color: '#11866a', icon: 'bar-chart-steps', section: 'crisp-dm' },
};

function ProjectTile({ project: p }) {
  const { t, locale } = useI18n();
  const style = PROJECT_TYPE_STYLE[p.type];
  const shared = p.access === 'project' || p.access === 'kanban';
  // quem tem acesso só ao Kanban vai direto para o quadro
  const to = p.access === 'kanban' ? `/projects/${p.id}/kanban` : `/projects/${p.id}`;
  return (
    <Link to={to} className="kt-tile is-available text-decoration-none" style={{ '--sec': style.color }}>
      <header>
        <span className="kt-tile-icon"><i className={`bi bi-${style.icon}`} aria-hidden="true" /></span>
        <h2 className="h3 mb-0" title={p.name}>{p.name}</h2>
        <span className="kt-tile-tag">v{p.version}</span>
      </header>
      <div className="kt-tile-body">
        <p className="kt-tile-text">{p.description || t(`sections.${style.section}.name`)}</p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <span className="kt-tile-chip">
            <i className="bi bi-folder2 me-1" aria-hidden="true" />{t(`project.types.${p.type}`)}
          </span>
          <span className="kt-tile-chip is-muted">
            <i className="bi bi-clock-history me-1" aria-hidden="true" />{formatDate(p.updatedAt, locale)}
          </span>
          {shared && (
            <span className="kt-tile-chip" title={p.ownerEmail}>
              <i className="bi bi-people me-1" aria-hidden="true" />
              {p.access === 'kanban' ? t('share.kanbanOnlyChip') : t('share.sharedBy', { email: p.ownerEmail })}
            </span>
          )}
          {p.purgeAt && (
            <span className="kt-tile-chip is-muted" title={t('dashboard.purgeHelp')}>
              <i className="bi bi-hourglass-split me-1" aria-hidden="true" />{t('dashboard.purgeAt', { date: formatDay(p.purgeAt, locale) })}
            </span>
          )}
        </div>
        <span className="btn btn-sm kt-tile-cta">
          {t('dashboard.open')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export function VerifyBanner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;
  const resend = async () => {
    try {
      await authApi.resendVerification();
      setSent(true);
      toast.success(t('auth.resent'));
    } catch (err) {
      toast.fromError(err);
    }
  };
  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
      <span><i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />{t('auth.notVerified')}</span>
      <button type="button" className="btn btn-sm btn-outline-dark" onClick={resend} disabled={sent}>
        {t('auth.resend')}
      </button>
    </div>
  );
}

function NewProjectModal({ onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const fields = [
    { name: 'name', label: 'project.name', required: true, maxLength: 200 },
    {
      name: 'type', label: 'project.type', type: 'select', required: true, help: 'project.typeHelp',
      options: [
        { value: 'software', label: t('project.types.software') },
        { value: 'data_analysis', label: t('project.types.data_analysis') },
      ],
    },
    { name: 'description', label: 'project.description', type: 'textarea', maxLength: 10000 },
    { name: 'version', label: 'project.version', maxLength: 20, col: 'col-md-4' },
  ];
  const [values, setValues] = useState({ name: '', type: 'software', description: '', version: '1.0.0' });
  const { submit, busy, errors } = useSubmit((body) => projectsApi.create(body), {
    onSuccess: (project) => {
      toast.success(t('project.created'));
      navigate(`/projects/${project.id}`);
    },
  });
  return (
    <Modal
      title={t('dashboard.newProject')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-new-project" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="kt-new-project" noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(fields, values, t)); }}>
        <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      </form>
    </Modal>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [scope, setScope] = useState('all');
  const [creating, setCreating] = useState(false);
  const projects = useAsync(
    () => projectsApi.list({ page, pageSize: PAGE_SIZE, type: type || undefined, scope }),
    [page, type, scope],
  );
  const quota = projects.data?.quota;
  const limitReached = quota && !quota.canCreate;

  return (
    <div className="container-xl px-3 mt-3">
      <VerifyBanner />
      <ContentCard
        icon="tools"
        as="h1"
        title={t('dashboard.title')}
        actions={
          <button type="button" className="btn btn-accent fw-bold" onClick={() => setCreating(true)}
            disabled={limitReached} aria-describedby={limitReached ? 'kt-limit-note' : undefined}
            title={limitReached ? t('dashboard.limitReached', { count: quota.limit }) : undefined}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('dashboard.newProject')}
          </button>
        }
        footer={<Link to="/engineering" className="text-white">{t('dashboard.engineering')} →</Link>}
        bodyClassName="kt-tinted"
      >
        <p className="text-large mb-3">{t('dashboard.hello', { name: user?.email })}</p>
        {limitReached && (
          <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2" id="kt-limit-note" role="status">
            <span><i className="bi bi-lock me-2" aria-hidden="true" />{t('dashboard.limitReached', { count: quota.limit })}</span>
            <Link to="/plans" className="btn btn-sm btn-primary">{t('billing.seePlans')}</Link>
          </div>
        )}
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div className="d-flex flex-wrap gap-2">
            {projects.data && (
              <span className="kt-pill is-on">
                <i className="bi bi-folder2-open me-1" aria-hidden="true" />{t('dashboard.count', { count: projects.data.total })}
              </span>
            )}
            {quota?.limit != null && (
              <span className={`kt-pill ${limitReached ? 'is-soon' : 'is-on'}`} title={t('dashboard.quotaHelp')}>
                <i className="bi bi-speedometer me-1" aria-hidden="true" />{t('dashboard.quota', { used: Math.min(quota.used, quota.limit), limit: quota.limit })}
              </span>
            )}
            {Object.entries(PROJECT_TYPE_STYLE).map(([key, st]) => (
              <span key={key} className="kt-pill is-type" style={{ '--sec': st.color }}>
                <i className={`bi bi-${st.icon} me-1`} aria-hidden="true" />{t(`project.types.${key}`)}
              </span>
            ))}
          </div>
          <div className="d-flex flex-wrap gap-3">
          <div>
            <label className="form-label small mb-1" htmlFor="flt-scope">{t('dashboard.scopeFilter')}</label>
            <select id="flt-scope" className="form-select form-select-sm" value={scope}
              onChange={(e) => { setScope(e.target.value); setPage(1); }}>
              <option value="all">{t('common.all')}</option>
              <option value="owned">{t('dashboard.scopeOwned')}</option>
              <option value="shared">{t('dashboard.scopeShared')}</option>
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="flt-type">{t('dashboard.typeFilter')}</label>
            <select id="flt-type" className="form-select form-select-sm" value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">{t('common.all')}</option>
              <option value="software">{t('project.types.software')}</option>
              <option value="data_analysis">{t('project.types.data_analysis')}</option>
            </select>
          </div>
          </div>
        </div>
        {projects.loading && !projects.data ? (
          <Loading small />
        ) : !projects.data?.data.length ? (
          <EmptyState>{t('dashboard.noProjects')}</EmptyState>
        ) : (
          <>
            <ul className="row g-4 list-unstyled mb-0">
              {projects.data.data.map((p) => (
                <li className="col-md-6 col-xl-4" key={p.id}>
                  <ProjectTile project={p} />
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={projects.data.total} onChange={setPage} />
          </>
        )}
      </ContentCard>
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
