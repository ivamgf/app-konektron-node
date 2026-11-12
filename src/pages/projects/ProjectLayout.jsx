import { useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { projectsApi } from '../../api/endpoints.js';
import { AiContextProvider } from '../../components/AiAssist.jsx';
import { FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { canAccessSection, NotFound, plansWithSection } from '../public/PublicPages.jsx';
import { ShareModal } from './Share.jsx';

// Seções para qualquer tipo de projeto: [caminho, rótulo, ícone, seção]
const SHARED_TABS = [
  ['ontologies', 'ontologies', 'diagram-2', 'ontologies'],
  ['bpm', 'bpm', 'bezier2', 'bpm'],
  ['commonkads', 'commonkads', 'journal-richtext', 'commonkads'],
  ['scrum', 'scrum', 'arrow-repeat', 'scrum'],
  ['data-diagnosis', 'dataDiagnosis', 'clipboard-data', 'data-diagnosis'],
];

// [caminho, rótulo, ícone, seção do plano]
const SA = 'system-analysis';
const DM = 'crisp-dm';
const TABS = {
  software: [
    ['', 'overview', 'speedometer2', SA],
    ['analysis', 'analysis', 'journal-text', SA],
    ['requirements', 'requirements', 'list-check', SA],
    ['user-stories', 'userStories', 'person-lines-fill', SA],
    ['diagrams', 'diagrams', 'diagram-3', SA],
    ['function-points', 'functionPoints', 'calculator', 'function-point'],
    ...SHARED_TABS,
    ['kanban', 'kanban', 'kanban', 'kanban'],
    ['report', 'report', 'file-earmark-pdf', SA],
  ],
  data_analysis: [
    ['', 'overview', 'speedometer2', DM],
    ['phases', 'phases', 'bar-chart-steps', DM],
    ['objectives', 'objectives', 'bullseye', DM],
    ['datasets', 'datasets', 'table', DM],
    ['preparation', 'preparation', 'funnel', DM],
    ['models', 'models', 'cpu', DM],
    ...SHARED_TABS,
    ['kanban', 'kanban', 'kanban', 'kanban'],
    ['report', 'report', 'file-earmark-pdf', DM],
  ],
};

// Seção da página aberta, pelo primeiro trecho do caminho depois de /projects/:id
export function sectionOfPath(type, pathname, projectId) {
  const rest = pathname.split(`/projects/${projectId}`)[1] ?? '';
  const segment = rest.replace(/^\//, '').split('/')[0];
  return TABS[type]?.find(([path]) => path === segment)?.[3] ?? null;
}
const isManager = (access) => access === 'owner' || access === 'admin';

// Seção fora do alcance: explica por quê (plano próprio, plano do dono ou acesso só ao Kanban)
export function SectionLocked({ section, project }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const plans = plansWithSection(section).map((plan) => t(`plans.${plan}`)).join(', ');
  const own = canAccessSection(user, section);
  let reason;
  if (project.access === 'kanban') reason = t('share.kanbanOnly');
  else if (!own) reason = t('sections.locked', { plans });
  else reason = t('sections.ownerLocked', { plans });
  return (
    <div className="text-center py-4">
      <i className="bi bi-lock fs-1 text-body-secondary" aria-hidden="true" />
      <h2 className="h3 mt-2">{t(`sections.${section}.name`)}</h2>
      <p className="mb-2">{reason}</p>
      <p className="small text-body-secondary">{t(`sections.${section}.text`)}</p>
      {project.access !== 'kanban' && !own && <Link to="/plans" className="btn btn-primary">{t('billing.seePlans')}</Link>}
    </div>
  );
}

export const useProject = () => useOutletContext();

// Páginas exclusivas de um tipo de projeto: no outro tipo, volta para a visão geral
export function RequireType({ type, children }) {
  const { project } = useProject();
  return project.type === type ? children : <Navigate to={`/projects/${project.id}`} replace />;
}

function EditProjectModal({ project, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const fields = [
    { name: 'name', label: 'project.name', required: true, maxLength: 200 },
    { name: 'description', label: 'project.description', type: 'textarea', maxLength: 10000 },
    { name: 'version', label: 'project.version', maxLength: 20, col: 'col-md-4' },
  ];
  const [values, setValues] = useState(() => toFormValues(fields, project));
  const { submit, busy, errors } = useSubmit((body) => projectsApi.update(project.id, body), {
    onSuccess: (updated) => {
      toast.success(t('common.saved'));
      onSaved(updated);
      onClose();
    },
  });
  return (
    <Modal
      title={t('project.settings')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-edit-project" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="kt-edit-project" noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(fields, values, t)); }}>
        <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
        <p className="small text-body-secondary mb-0">
          {t('project.type')}: {t(`project.types.${project.type}`)} — {t('project.typeHelp')}
        </p>
      </form>
    </Modal>
  );
}

export default function ProjectLayout() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const location = useLocation();
  const project = useAsync(() => projectsApi.get(projectId), [projectId]);
  useCrumbLabel('project', project.data?.name);
  // contexto que acompanha os pedidos de IA dos campos deste projeto
  const p0 = project.data;
  const ai = useMemo(
    () =>
      p0 && {
        projectId: p0.id,
        describe: () =>
          [
            `${t('project.name')}: ${p0.name}`,
            `${t('project.type')}: ${t(`project.types.${p0.type}`)}`,
            p0.version && `${t('project.version')}: ${p0.version}`,
            p0.description && `${t('project.description')}: ${p0.description}`,
            `${t('ai.page')}: ${document.title}`,
          ]
            .filter(Boolean)
            .join('\n'),
      },
    [p0, t],
  );

  if (project.loading && !project.data) return <Loading />;
  if (!project.data) return <NotFound />;
  const p = project.data;
  const sectionKey = p.type === 'software' ? 'system-analysis' : 'crisp-dm';
  const allowed = p.sections ?? [];
  const current = sectionOfPath(p.type, location.pathname, p.id);
  const manager = isManager(p.access);
  // acesso só ao Kanban: as outras páginas levam ao quadro e as demais abas somem
  if (p.access === 'kanban' && current !== 'kanban') return <Navigate to={`/projects/${p.id}/kanban`} replace />;
  const tabs = TABS[p.type].filter(([, , , section]) => p.access !== 'kanban' || section === 'kanban');

  const remove = async () => {
    if (!window.confirm(t('common.confirmDelete', { name: p.name }))) return;
    try {
      await projectsApi.remove(p.id);
      toast.success(t('common.deleted'));
      navigate('/projects');
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <div className="container-xl px-3 mt-3">
      <ContentCard
        icon={p.type === 'software' ? 'diagram-3' : 'bar-chart-steps'}
        as="h1"
        title={p.name}
        actions={
          <div className="d-flex gap-2 kt-no-print">
            <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setSharing(true)}
              aria-label={t('share.title')} title={t('share.title')} aria-haspopup="dialog">
              <i className="bi bi-people" aria-hidden="true" />
            </button>
            {manager && (
              <>
                <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setEditing(true)}
                  aria-label={t('project.settings')} title={t('project.settings')}>
                  <i className="bi bi-gear" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-sm btn-outline-light" onClick={remove}
                  aria-label={t('project.deleteProject')} title={t('project.deleteProject')}>
                  <i className="bi bi-trash" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        }
        footer={[
          t(`sections.${sectionKey}.name`), t(`project.types.${p.type}`), `v${p.version}`,
          p.ownerEmail && t('share.sharedBy', { email: p.ownerEmail }),
        ].filter(Boolean).join(' · ')}
      >
        {p.description && <p className="text-body-secondary kt-prewrap kt-no-print">{p.description}</p>}
        <ul className="nav nav-underline kt-tabs mb-4 kt-no-print">
          {tabs.map(([path, key, icon, section]) => (
            <li className="nav-item" key={key}>
              <NavLink to={path ? `/projects/${p.id}/${path}` : `/projects/${p.id}`} end={!path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <i className={`bi bi-${icon} me-1`} aria-hidden="true" />{t(`project.tabs.${key}`)}
                {!allowed.includes(section) && (
                  <i className="bi bi-lock ms-1 small" title={t('sections.notInPlan')} aria-label={t('sections.notInPlan')} />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <AiContextProvider value={ai}>
          {current && !allowed.includes(current) ? (
            <SectionLocked section={current} project={p} />
          ) : (
            <Outlet context={{ project: p, reloadProject: project.reload }} />
          )}
        </AiContextProvider>
      </ContentCard>
      {sharing && <ShareModal project={p} onClose={() => setSharing(false)} />}
      {editing && (
        <AiContextProvider value={ai}>
          <EditProjectModal project={p} onClose={() => setEditing(false)} onSaved={project.setData} />
        </AiContextProvider>
      )}
    </div>
  );
}
