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

function SectionGrid({ sections, authed }) {
  const { t } = useI18n();
  return (
    <div className="row g-4">
      {sections.map((s) => {
        const usable = s.implemented && (s.enabled ?? true);
        return (
          <div className="col-sm-6 col-lg-4" key={s.key}>
            <div className={`card kt-section-card ${usable ? 'is-available' : ''}`}>
              <div className="card-body d-flex flex-column">
                <i className={`bi bi-${ICONS[s.key]} fs-2 text-primary mb-2`} aria-hidden="true" />
                <h2 className="h3">{t(`sections.${s.key}.name`)}</h2>
                <p className="text-small flex-grow-1">{t(`sections.${s.key}.text`)}</p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className={`badge ${s.implemented ? 'text-bg-primary' : 'text-bg-light border'}`}>
                    {s.implemented ? t('sections.available') : t('sections.soon')}
                  </span>
                  {authed && (
                    <span className={`badge ${s.enabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
                      {s.enabled ? t('sections.inPlan') : t('sections.notInPlan')}
                    </span>
                  )}
                </div>
                {s.projectType && (
                  <p className="ds-caption text-body-secondary">
                    {t('sections.projectType', { type: t(`project.types.${s.projectType}`) })}
                  </p>
                )}
                {usable && (
                  <Link to={authed ? '/projects' : '/signin'} className="btn btn-primary btn-sm align-self-start">
                    {authed ? t('sections.openProjects') : t('nav.signin')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
      <ContentCard icon="box" as="h1" title={t('nav.engineering')}>
        {authed ? <AuthedSections /> : <SectionGrid sections={STATIC} authed={false} />}
      </ContentCard>
    </div>
  );
}
