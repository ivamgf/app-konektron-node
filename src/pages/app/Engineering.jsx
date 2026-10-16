import { Link } from 'react-router';
import { engineeringApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { ContentCard, Loading } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync } from '../../lib/hooks.js';
import { IMPLEMENTED, SECTION_ICONS as ICONS, SECTION_KEYS, SECTION_PROJECT_TYPE } from '../public/PublicPages.jsx';

const STATIC = SECTION_KEYS.map((key) => ({
  key,
  implemented: IMPLEMENTED.includes(key),
  projectType: SECTION_PROJECT_TYPE[key] ?? null,
}));

// Cor de cada seção (paleta da marca; todas com texto branco legível por cima)
const SECTION_COLORS = {
  'system-analysis': '#0189b6',
  ontologies: '#0b74e3',
  bpm: '#d96a04',
  'function-point': '#6f42c1',
  commonkads: '#0b39d9',
  'crisp-dm': '#11866a',
  scrum: '#b4410c',
  kanban: '#0c8d8b',
};

function SectionGrid({ sections, authed }) {
  const { t } = useI18n();
  const available = sections.filter((s) => s.implemented).length;
  const soon = sections.filter((s) => !s.implemented).length;
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <span className="kt-pill is-on">
          <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
          {t('sections.summaryAvailable', { count: available })}
        </span>
        <span className="kt-pill is-soon">
          <i className="bi bi-hourglass-split me-1" aria-hidden="true" />{t('sections.summarySoon', { count: soon })}
        </span>
      </div>
      <ul className="row g-4 list-unstyled mb-0">
        {sections.map((s) => {
          const usable = s.implemented;
          const state = usable ? 'is-available' : 'is-soon';
          return (
            <li className="col-sm-6 col-lg-4" key={s.key}>
              <article className={`kt-tile ${state}`} style={{ '--sec': SECTION_COLORS[s.key] }} aria-labelledby={`sec-${s.key}`}>
                <header>
                  <span className="kt-tile-icon"><i className={`bi bi-${ICONS[s.key]}`} aria-hidden="true" /></span>
                  <h2 className="h3 mb-0" id={`sec-${s.key}`}>{t(`sections.${s.key}.name`)}</h2>
                  <span className="kt-tile-tag">{s.implemented ? t('sections.available') : t('sections.soon')}</span>
                </header>
                <div className="kt-tile-body">
                  <p>{t(`sections.${s.key}.text`)}</p>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <span className="kt-tile-chip">
                      <i className="bi bi-folder2 me-1" aria-hidden="true" />
                      {s.projectType ? t(`project.types.${s.projectType}`) : t('sections.anyProject')}
                    </span>
                  </div>
                  {usable && (
                    <Link to={authed ? '/projects' : '/signin'} className="btn btn-sm kt-tile-cta">
                      {authed ? t('sections.openProjects') : t('nav.signin')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function AuthedSections() {
  const sections = useAsync(() => engineeringApi.sections(), []);
  if (sections.loading && !sections.data) return <Loading small />;
  return <SectionGrid sections={sections.data ?? STATIC} authed />;
}

export default function Engineering() {
  const { t } = useI18n();
  const { status } = useAuth();
  const authed = status === 'authenticated';
  return (
    <div className="container-xl px-3 mt-3">
      <ContentCard icon="box" as="h1" title={t('nav.engineering')} bodyClassName="kt-tinted">
        <p className="kt-home-sub mb-3">{t('home.sectionsLead')}</p>
        {authed ? <AuthedSections /> : <SectionGrid sections={STATIC} authed={false} />}
      </ContentCard>
    </div>
  );
}
