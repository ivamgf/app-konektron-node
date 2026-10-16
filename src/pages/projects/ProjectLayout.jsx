import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { projectsApi } from '../../api/endpoints.js';
import { FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import { useCrumbLabel } from '../../components/Layout.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { NotFound } from '../public/PublicPages.jsx';

// Seções para qualquer tipo de projeto: [caminho, rótulo, ícone, seção]
const SHARED_TABS = [
  ['ontologies', 'ontologies', 'diagram-2', 'ontologies'],
  ['bpm', 'bpm', 'bezier2', 'bpm'],
  ['commonkads', 'commonkads', 'journal-richtext', 'commonkads'],
  ['scrum', 'scrum', 'arrow-repeat', 'scrum'],
];

const TABS = {
  software: [
    ['', 'overview', 'speedometer2'],
    ['analysis', 'analysis', 'journal-text'],
    ['requirements', 'requirements', 'list-check'],
    ['user-stories', 'userStories', 'person-lines-fill'],
    ['diagrams', 'diagrams', 'diagram-3'],
    ['function-points', 'functionPoints', 'calculator', 'function-point'],
    ...SHARED_TABS,
    ['kanban', 'kanban', 'kanban'],
    ['report', 'report', 'file-earmark-pdf'],
  ],
  data_analysis: [
    ['', 'overview', 'speedometer2'],
    ['phases', 'phases', 'bar-chart-steps'],
    ['objectives', 'objectives', 'bullseye'],
    ['datasets', 'datasets', 'table'],
    ['preparation', 'preparation', 'funnel'],
    ['models', 'models', 'cpu'],
    ...SHARED_TABS,
    ['kanban', 'kanban', 'kanban'],
    ['report', 'report', 'file-earmark-pdf'],
  ],
};

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
  const project = useAsync(() => projectsApi.get(projectId), [projectId]);
  useCrumbLabel('project', project.data?.name);

  if (project.loading && !project.data) return <Loading />;
  if (!project.data) return <NotFound />;
  const p = project.data;
  const sectionKey = p.type === 'software' ? 'system-analysis' : 'crisp-dm';

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
            <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setEditing(true)}
              aria-label={t('project.settings')} title={t('project.settings')}>
              <i className="bi bi-gear" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={remove}
              aria-label={t('project.deleteProject')} title={t('project.deleteProject')}>
              <i className="bi bi-trash" aria-hidden="true" />
            </button>
          </div>
        }
        footer={`${t(`sections.${sectionKey}.name`)} · ${t(`project.types.${p.type}`)} · v${p.version}`}
      >
        {p.description && <p className="text-body-secondary kt-prewrap kt-no-print">{p.description}</p>}
        <ul className="nav nav-underline kt-tabs mb-4 kt-no-print">
          {TABS[p.type].map(([path, key, icon]) => (
            <li className="nav-item" key={key}>
              <NavLink to={path ? `/projects/${p.id}/${path}` : `/projects/${p.id}`} end={!path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <i className={`bi bi-${icon} me-1`} aria-hidden="true" />{t(`project.tabs.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
        <Outlet context={{ project: p, reloadProject: project.reload }} />
      </ContentCard>
      {editing && <EditProjectModal project={p} onClose={() => setEditing(false)} onSaved={project.setData} />}
    </div>
  );
}
