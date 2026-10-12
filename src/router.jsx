import { createBrowserRouter } from 'react-router';
import { GuestOnly, RequireAdmin, RequireAuth } from './auth/guards.jsx';
import Layout from './components/Layout.jsx';
import { AdminLayout, AdminLogs, AdminSummary, AdminUsers } from './pages/admin/Admin.jsx';
import Dashboard from './pages/app/Dashboard.jsx';
import Engineering from './pages/app/Engineering.jsx';
import Profile from './pages/app/Profile.jsx';
import { Recover, ResetPassword, Signin, Signup, VerifyEmail } from './pages/auth/AuthPages.jsx';
import {
  DmDatasetDetail, DmDatasets, DmModelDetail, DmModels, DmObjectives, DmOverview, DmPhases, DmPreparation, DmReport,
} from './pages/projects/CrispDm.jsx';
import Kanban from './pages/projects/Kanban.jsx';
import ProjectLayout, { useProject } from './pages/projects/ProjectLayout.jsx';
import { SaAnalysis, SaDiagrams, SaOverview, SaReport, SaRequirements, SaUserStories } from './pages/projects/SystemAnalysis.jsx';
import { About, Contacts, Home, NotFound, Terms } from './pages/public/PublicPages.jsx';

// Visão geral conforme o tipo do projeto
function ProjectOverview() {
  const { project } = useProject();
  return project.type === 'software' ? <SaOverview /> : <DmOverview />;
}

const crumb = (key) => ({ crumb: key });

export const routes = [
  {
    element: <Layout />,
    handle: crumb('nav.home'),
    path: '/',
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About />, handle: crumb('nav.about') },
      { path: 'contacts', element: <Contacts />, handle: crumb('nav.contacts') },
      { path: 'terms', element: <Terms />, handle: crumb('nav.terms') },
      { path: 'engineering', element: <Engineering />, handle: crumb('nav.engineering') },
      { path: 'verify-email', element: <VerifyEmail />, handle: crumb('auth.verifyTitle') },
      { path: 'reset-password', element: <ResetPassword />, handle: crumb('auth.resetTitle') },
      {
        element: <GuestOnly />,
        children: [
          { path: 'signin', element: <Signin />, handle: crumb('nav.signin') },
          { path: 'signup', element: <Signup />, handle: crumb('nav.signup') },
          { path: 'recover', element: <Recover />, handle: crumb('auth.recoverTitle') },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'profile', element: <Profile />, handle: crumb('nav.profile') },
          {
            path: 'projects',
            handle: crumb('nav.projects'),
            children: [
              { index: true, element: <Dashboard /> },
              {
                id: 'project',
                path: ':projectId',
                element: <ProjectLayout />,
                handle: crumb('nav.projects'),
                children: [
                  { index: true, element: <ProjectOverview /> },
                  // Análise de Sistemas (software)
                  { path: 'analysis', element: <SaAnalysis />, handle: crumb('project.tabs.analysis') },
                  { path: 'requirements', element: <SaRequirements />, handle: crumb('project.tabs.requirements') },
                  { path: 'user-stories', element: <SaUserStories />, handle: crumb('project.tabs.userStories') },
                  { path: 'diagrams', element: <SaDiagrams />, handle: crumb('project.tabs.diagrams') },
                  // CRISP-DM (data_analysis)
                  { path: 'phases', element: <DmPhases />, handle: crumb('project.tabs.phases') },
                  { path: 'objectives', element: <DmObjectives />, handle: crumb('project.tabs.objectives') },
                  {
                    path: 'datasets',
                    handle: crumb('project.tabs.datasets'),
                    children: [
                      { index: true, element: <DmDatasets /> },
                      { id: 'dataset', path: ':datasetId', element: <DmDatasetDetail />, handle: crumb('dm.dataset') },
                    ],
                  },
                  { path: 'preparation', element: <DmPreparation />, handle: crumb('project.tabs.preparation') },
                  {
                    path: 'models',
                    handle: crumb('project.tabs.models'),
                    children: [
                      { index: true, element: <DmModels /> },
                      { id: 'model', path: ':modelId', element: <DmModelDetail />, handle: crumb('dm.modelName') },
                    ],
                  },
                  // Kanban (qualquer tipo de projeto)
                  { path: 'kanban', element: <Kanban />, handle: crumb('project.tabs.kanban') },
                  {
                    path: 'report',
                    handle: crumb('project.tabs.report'),
                    element: <ReportSwitch />,
                  },
                ],
              },
            ],
          },
          {
            element: <RequireAdmin />,
            children: [
              {
                path: 'admin',
                element: <AdminLayout />,
                handle: crumb('nav.admin'),
                children: [
                  { index: true, element: <AdminSummary /> },
                  { path: 'users', element: <AdminUsers />, handle: crumb('admin.users') },
                  { path: 'logs', element: <AdminLogs />, handle: crumb('admin.logs') },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

function ReportSwitch() {
  const { project } = useProject();
  return project.type === 'software' ? <SaReport /> : <DmReport />;
}

export const router = createBrowserRouter(routes);
