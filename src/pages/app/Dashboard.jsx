import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { authApi, engineeringApi, projectsApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { FieldGrid, toPayload } from '../../components/forms.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, EmptyState, Loading, Modal, Pagination } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';

const PAGE_SIZE = 12;

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

function NewProjectModal({ onClose, canDataAnalysis }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const fields = [
    { name: 'name', label: 'project.name', required: true, maxLength: 200 },
    {
      name: 'type', label: 'project.type', type: 'select', required: true, help: 'project.typeHelp',
      options: [
        { value: 'software', label: t('project.types.software') },
        ...(canDataAnalysis ? [{ value: 'data_analysis', label: t('project.types.data_analysis') }] : []),
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
        {!canDataAnalysis && <p className="small text-body-secondary mb-0">{t('project.dataAnalysisLocked')}</p>}
      </form>
    </Modal>
  );
}

export default function Dashboard() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [creating, setCreating] = useState(false);
  const projects = useAsync(() => projectsApi.list({ page, pageSize: PAGE_SIZE, type: type || undefined }), [page, type]);
  const sections = useAsync(() => engineeringApi.sections(), []);
  const canDataAnalysis = Boolean(sections.data?.find((s) => s.key === 'crisp-dm')?.enabled);

  return (
    <div className="container-xl px-3 mt-3">
      <VerifyBanner />
      <ContentCard
        icon="tools"
        as="h1"
        title={t('dashboard.title')}
        actions={
          <button type="button" className="btn btn-accent fw-bold" onClick={() => setCreating(true)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('dashboard.newProject')}
          </button>
        }
        footer={<Link to="/engineering" className="text-white">{t('dashboard.engineering')} →</Link>}
      >
        <p className="text-large">{t('dashboard.hello', { name: user?.email })}</p>
        <div className="d-flex justify-content-end mb-3">
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
        {projects.loading && !projects.data ? (
          <Loading small />
        ) : !projects.data?.data.length ? (
          <EmptyState>{t('dashboard.noProjects')}</EmptyState>
        ) : (
          <>
            <div className="row g-3">
              {projects.data.data.map((p) => (
                <div className="col-md-6 col-xl-4" key={p.id}>
                  <Link to={`/projects/${p.id}`} className="card h-100 text-decoration-none text-body shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between gap-2 mb-2">
                        <h2 className="h3 mb-0 text-truncate">{p.name}</h2>
                        <span className={`badge ${p.type === 'software' ? 'text-bg-primary' : 'text-bg-accent'}`}>
                          {t(`project.types.${p.type}`)}
                        </span>
                      </div>
                      {p.description && <p className="text-small text-body-secondary mb-2 text-truncate">{p.description}</p>}
                      <p className="ds-caption text-body-secondary mb-0">
                        v{p.version} · {t('common.updatedAt')} {formatDate(p.updatedAt, locale)}
                      </p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={projects.data.total} onChange={setPage} />
          </>
        )}
      </ContentCard>
      {creating && <NewProjectModal onClose={() => setCreating(false)} canDataAnalysis={canDataAnalysis} />}
    </div>
  );
}
