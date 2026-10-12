import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { CONTACT_EMAIL, SITE_URL } from '../../components/Layout.jsx';
import { BrandMark, ContentCard, Panel } from '../../components/ui.jsx';
import { TERMS } from '../../content/terms.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// Planos e seções (espelha a API: config/plans.js)
export const SECTION_KEYS = ['system-analysis', 'system-view', 'ontologies', 'bpm', 'function-point', 'commonkads', 'crisp-dm'];
const PLAN_SECTIONS = {
  free: ['system-analysis'],
  standard: ['system-analysis', 'system-view', 'bpm', 'crisp-dm'],
  master: SECTION_KEYS,
};
const IMPLEMENTED = ['system-analysis', 'crisp-dm'];

export function Home() {
  const { t } = useI18n();
  const { status } = useAuth();
  const authed = status === 'authenticated';
  return (
    <>
      <section className="kt-hero mb-5">
        <div className="container-xl py-5 d-flex flex-wrap align-items-center gap-5">
          <div className="flex-grow-1" style={{ maxWidth: 640 }}>
            <p className="ds-label text-uppercase mb-2">KoneKtron</p>
            <h1 className="display-large text-white mb-3">{t('home.title')}</h1>
            <p className="text-large mb-4">{t('home.lead')}</p>
            {authed ? (
              <Link to="/projects" className="btn btn-accent btn-lg fw-bold">{t('home.goDashboard')}</Link>
            ) : (
              <div className="d-flex flex-wrap gap-3">
                <Link to="/signup" className="btn btn-accent btn-lg fw-bold">{t('home.start')}</Link>
                <Link to="/signin" className="btn btn-outline-light btn-lg">{t('nav.signin')}</Link>
              </div>
            )}
          </div>
          <BrandMark size={240} className="mx-auto" />
        </div>
      </section>

      <div className="container-xl px-3">
        <h2 className="display-tiny mb-4">{t('home.sectionsTitle')}</h2>
        <div className="row g-4 mb-5">
          {SECTION_KEYS.map((key) => {
            const ready = IMPLEMENTED.includes(key);
            return (
              <div className="col-sm-6 col-lg-4" key={key}>
                <div className={`card kt-section-card ${ready ? 'is-available' : ''}`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <h3 className="h3 mb-0">{t(`sections.${key}.name`)}</h3>
                      <span className={`badge ${ready ? 'text-bg-primary' : 'text-bg-light border'}`}>
                        {ready ? t('sections.available') : t('sections.soon')}
                      </span>
                    </div>
                    <p className="text-small mb-0">{t(`sections.${key}.text`)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="display-tiny mb-3">{t('home.plansTitle')}</h2>
        <div className="table-responsive mb-2">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">{t('home.plan')}</th>
                <th scope="col">{t('home.sections')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PLAN_SECTIONS).map(([plan, sections]) => (
                <tr key={plan}>
                  <th scope="row">{t(`plans.${plan}`)}</th>
                  <td>{sections.map((s) => t(`sections.${s}.name`)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-small text-body-secondary">{t('home.adminNote')}</p>
      </div>
    </>
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
  const items = TERMS[locale] ?? TERMS.en;
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
