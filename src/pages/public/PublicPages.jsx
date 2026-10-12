import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { CONTACT_EMAIL, SITE_URL } from '../../components/Layout.jsx';
import { BrandMark, ContentCard, Panel, ThemeToggle } from '../../components/ui.jsx';
import { TERMS } from '../../content/terms.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// Planos e seções (espelha a API: config/plans.js). Kanban está em todos os planos.
export const SECTION_KEYS = ['system-analysis', 'system-view', 'ontologies', 'bpm', 'function-point', 'commonkads', 'crisp-dm', 'kanban'];
export const PLAN_SECTIONS = {
  free: ['system-analysis', 'kanban'],
  standard: ['system-analysis', 'system-view', 'bpm', 'crisp-dm', 'kanban'],
  master: SECTION_KEYS,
};
export const IMPLEMENTED = ['system-analysis', 'crisp-dm', 'kanban'];
// Tipo de projeto exigido; ausente = qualquer tipo (Kanban)
export const SECTION_PROJECT_TYPE = { 'system-analysis': 'software', 'crisp-dm': 'data_analysis' };
export const SECTION_ICONS = {
  'system-analysis': 'diagram-3',
  'system-view': 'window-stack',
  ontologies: 'diagram-2',
  bpm: 'bezier2',
  'function-point': 'calculator',
  commonkads: 'journal-richtext',
  'crisp-dm': 'bar-chart-steps',
  kanban: 'kanban',
};
const FEATURED_PLAN = 'standard';

export function Home() {
  const { t } = useI18n();
  const { status } = useAuth();
  const authed = status === 'authenticated';
  // disponíveis primeiro, na ordem do catálogo
  const sections = [...SECTION_KEYS].sort((a, b) => IMPLEMENTED.includes(b) - IMPLEMENTED.includes(a));
  const stats = [
    [SECTION_KEYS.length, 'sections'],
    [IMPLEMENTED.length, 'available'],
    [Object.keys(PLAN_SECTIONS).length, 'plans'],
  ];

  return (
    <div className="kt-home">
      <section className="kt-home-hero">
        <span className="kt-home-hero-shape d-none d-md-block" aria-hidden="true" />
        <div className="container-xl px-3 py-5 d-flex flex-wrap align-items-center gap-5 position-relative">
          <div className="flex-grow-1 py-md-4" style={{ maxWidth: 640 }}>
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <span className="kt-home-eyebrow">
                <i className="bi bi-diagram-3 me-1" aria-hidden="true" /> KoneKtron
              </span>
              <ThemeToggle />
            </div>
            <h1 className="kt-home-title mb-3">{t('home.title')}</h1>
            <p className="kt-home-lead mb-4">{t('home.lead')}</p>
            <div className="d-flex flex-wrap gap-3 mb-5">
              {authed ? (
                <Link to="/projects" className="btn btn-accent btn-lg fw-bold px-4">
                  {t('home.goDashboard')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="btn btn-accent btn-lg fw-bold px-4">
                    {t('home.start')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                  </Link>
                  <Link to="/signin" className="btn btn-outline-light btn-lg px-4">{t('nav.signin')}</Link>
                </>
              )}
            </div>
            <dl className="kt-home-stats mb-0">
              {stats.map(([n, key]) => (
                <div key={key}>
                  <dt>{n}</dt>
                  <dd>{t(`home.stats.${key}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="kt-home-tile mx-auto">
            <BrandMark size={220} title="KoneKtron" />
          </div>
        </div>
      </section>

      <section className="kt-home-band kt-home-steps kt-on-color" aria-labelledby="kt-home-how">
        <div className="container-xl px-3">
          <h2 className="kt-home-heading" id="kt-home-how">{t('home.howTitle')}</h2>
          <p className="kt-home-sub">{t('home.howLead')}</p>
          <ol className="row g-3 list-unstyled mb-0">
            {['create', 'document', 'report'].map((key) => (
              <li className="col-md-4" key={key}>
                <div className="kt-home-step">
                  <h3>{t(`home.steps.${key}.title`)}</h3>
                  <p>{t(`home.steps.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="kt-home-band kt-home-sections" aria-labelledby="kt-home-sections">
        <div className="container-xl px-3">
          <h2 className="kt-home-heading" id="kt-home-sections">{t('home.sectionsTitle')}</h2>
          <p className="kt-home-sub">{t('home.sectionsLead')}</p>
          <ul className="row g-4 list-unstyled mb-0">
            {sections.map((key) => {
              const ready = IMPLEMENTED.includes(key);
              const body = (
                <>
                  <span className="kt-home-tag">{ready ? t('sections.available') : t('sections.soon')}</span>
                  <span className="kt-home-icon"><i className={`bi bi-${SECTION_ICONS[key]}`} aria-hidden="true" /></span>
                  <h3>{t(`sections.${key}.name`)}</h3>
                  <p>{t(`sections.${key}.text`)}</p>
                  {ready && (
                    <span className="kt-home-more">
                      {t('home.learnMore')} <i className="bi bi-arrow-right" aria-hidden="true" />
                    </span>
                  )}
                </>
              );
              return (
                <li className="col-sm-6 col-lg-4" key={key}>
                  {ready ? (
                    <Link to="/engineering" className="kt-home-card is-available">{body}</Link>
                  ) : (
                    <div className="kt-home-card">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="kt-home-band kt-home-plans kt-on-color" aria-labelledby="kt-home-plans">
        <div className="container-xl px-3">
          <h2 className="kt-home-heading" id="kt-home-plans">{t('home.plansTitle')}</h2>
          <p className="kt-home-sub">{t('home.plansLead')}</p>
          <div className="row g-4 pt-2">
            {Object.entries(PLAN_SECTIONS).map(([plan, included]) => {
              const featured = plan === FEATURED_PLAN;
              return (
                <div className="col-md-4" key={plan}>
                  <article className={`kt-home-plan ${featured ? 'is-featured' : ''}`} aria-labelledby={`kt-plan-${plan}`}>
                    {featured && <span className="kt-home-ribbon">{t('home.recommended')}</span>}
                    <header>
                      <h3 id={`kt-plan-${plan}`}>{t(`plans.${plan}`)}</h3>
                      <small>{t(`home.tagline.${plan}`)}</small>
                    </header>
                    <ul>
                      {SECTION_KEYS.map((key) => {
                        const has = included.includes(key);
                        return (
                          <li key={key} className={has ? '' : 'is-off'}>
                            <i className={`bi ${has ? 'bi-check-circle-fill' : 'bi-dash-circle'} me-2`} aria-hidden="true" />
                            <span className="visually-hidden">{has ? t('common.yes') : t('common.no')}: </span>
                            {t(`sections.${key}.name`)}
                          </li>
                        );
                      })}
                    </ul>
                    {!authed && (
                      <footer>
                        <Link to="/signup" className={`btn w-100 ${featured ? 'btn-accent fw-bold' : 'btn-outline-primary'}`}>
                          {plan === 'free' ? t('home.start') : t('home.choose')}
                        </Link>
                      </footer>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
          <p className="kt-home-note mt-4 mb-0">
            <i className="bi bi-shield-check me-1" aria-hidden="true" /> {t('home.adminNote')}
          </p>
        </div>
      </section>

      <div className="container-xl px-3 pt-5">
        <section className="kt-home-cta p-4 p-md-5 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2 className="h3 text-white mb-1">{t('home.ctaTitle')}</h2>
            {!authed && <p className="mb-0">{t('home.ctaText')}</p>}
          </div>
          <Link to={authed ? '/projects' : '/signup'} className="btn btn-light btn-lg fw-bold position-relative">
            {authed ? t('home.goDashboard') : t('home.start')}
          </Link>
        </section>
      </div>
    </div>
  );
}

export function About() {
  const { t } = useI18n();
  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 1232 }}>
      <ContentCard icon="file-text" title={t('about.title')} as="h1" footer={t('about.open')}>
        <div className="row g-4 align-items-center">
          <div className="col-md-8">
            <h2 className="h1 mb-3">{t('about.heading')}</h2>
            <p>{t('about.text1')}</p>
            <p className="mb-4">{t('about.text2')}</p>
            <Link to="/engineering" className="btn btn-primary">{t('nav.engineering')}</Link>
          </div>
          <div className="col-md-4 text-center">
            <BrandMark size={180} />
          </div>
        </div>
      </ContentCard>
      <ContentCard icon="file-text" title={t('about.missionTitle')} footer="KoneKtron · OrkneyTech">
        <p className="text-large mb-4">{t('about.mission')}</p>
        <Link to="/contacts" className="btn btn-primary">{t('nav.contacts')}</Link>
      </ContentCard>
    </div>
  );
}

export function Contacts() {
  const { t } = useI18n();
  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 1232 }}>
      <ContentCard icon="geo-alt" title={t('contacts.title')} as="h1" footer={`© OrkneyTech · ${SITE_URL}`}>
        <div className="position-relative pe-5">
          <h2 className="h1 mb-3">{t('contacts.heading')}</h2>
          <p className="mb-4">{t('contacts.text')}</p>
          <dl className="row mb-4">
            <dt className="col-sm-2">{t('contacts.site')}</dt>
            <dd className="col-sm-10">
              <a href={`https://${SITE_URL}`} target="_blank" rel="noopener noreferrer">{SITE_URL}</a>
            </dd>
            <dt className="col-sm-2">{t('contacts.email')}</dt>
            <dd className="col-sm-10">
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </dd>
          </dl>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary">{t('contacts.write')}</a>
          <svg className="kt-wave d-none d-md-block" viewBox="0 0 70 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M70 0H8C40 20 40 40 20 60 4 76 0 90 0 100H70Z" fill="currentColor" />
          </svg>
        </div>
      </ContentCard>
    </div>
  );
}

export function Terms() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const items = TERMS[locale] ?? TERMS['pt-BR'];
  const [open, setOpen] = useState(0);
  const baseId = useId();
  return (
    <div className="px-3">
      <Panel title={t('terms.title')} wide>
        <div className="accordion kt-terms mt-4 mx-md-4">
          {items.map(([title, text], i) => {
            const isOpen = open === i;
            const headId = `${baseId}-h${i}`;
            const bodyId = `${baseId}-b${i}`;
            return (
              <div className="accordion-item" key={title}>
                <h2 className="accordion-header" id={headId}>
                  <button
                    type="button"
                    className={`accordion-button ${isOpen ? '' : 'collapsed'}`}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    {i + 1}.{title}
                  </button>
                </h2>
                <div id={bodyId} className={`accordion-collapse collapse ${isOpen ? 'show' : ''}`} role="region" aria-labelledby={headId}>
                  <div className="accordion-body">{text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="d-flex justify-content-between align-items-center mt-4 mx-md-4">
          <small className="text-body-secondary">{t('terms.draft')}</small>
          <button type="button" className="btn btn-link kt-auth-links p-0" onClick={() => navigate(-1)}>
            {t('common.back')}
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-xl px-3 text-center py-5">
      <BrandMark size={120} className="mb-4" />
      <h1 className="display-small mb-3">{t('errors.notFoundTitle')}</h1>
      <p className="mb-4">{t('errors.notFoundText')}</p>
      <Link to="/" className="btn btn-primary">{t('nav.home')}</Link>
    </div>
  );
}
