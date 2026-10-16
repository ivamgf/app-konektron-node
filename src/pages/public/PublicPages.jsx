import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { contactApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { CONTACT_EMAIL, SITE_URL } from '../../components/Layout.jsx';
import { SaveButton, useUnsavedChanges } from '../../components/unsaved.jsx';
import { BrandMark, ContentCard, Panel, ThemeToggle } from '../../components/ui.jsx';
import { TERMS } from '../../content/terms.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useSubmit } from '../../lib/hooks.js';

// Seções (espelha a API: config/plans.js). Todos os planos, inclusive o Free, acessam todas.
export const SECTION_KEYS = ['system-analysis', 'ontologies', 'bpm', 'function-point', 'commonkads', 'crisp-dm', 'scrum', 'kanban'];
export const IMPLEMENTED = SECTION_KEYS;
// Tipo de projeto exigido; ausente = qualquer tipo (Ontologias, BPM, CommonKADS, Scrum, Kanban)
export const SECTION_PROJECT_TYPE = { 'system-analysis': 'software', 'function-point': 'software', 'crisp-dm': 'data_analysis' };
export const canAccessSection = (user, section) => Boolean(user) && SECTION_KEYS.includes(section);
export const SECTION_ICONS = {
  'system-analysis': 'diagram-3',
  ontologies: 'diagram-2',
  bpm: 'bezier2',
  'function-point': 'calculator',
  commonkads: 'journal-richtext',
  'crisp-dm': 'bar-chart-steps',
  scrum: 'arrow-repeat',
  kanban: 'kanban',
};

export function Home() {
  const { t } = useI18n();
  const { status } = useAuth();
  const authed = status === 'authenticated';
  // disponíveis primeiro, na ordem do catálogo
  const sections = [...SECTION_KEYS].sort((a, b) => IMPLEMENTED.includes(b) - IMPLEMENTED.includes(a));
  const stats = [
    [SECTION_KEYS.length, 'sections'],
    [IMPLEMENTED.length, 'available'],
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

// Formulário de contato: a API guarda a mensagem e a envia para a equipe
function ContactForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const blank = { name: '', email: user?.email ?? '', subject: '', message: '', website: '' };
  const [values, setValues] = useState(blank);
  const [sentTo, setSentTo] = useState(null);
  const id = useId();
  const { submit, busy, errors } = useSubmit((body) => contactApi.send(body), {
    onSuccess: () => {
      setSentTo(values.email.trim());
      setValues(blank);
    },
  });
  // mensagem escrita e não enviada: avisa antes de sair da página
  useUnsavedChanges(!sentTo && Boolean(values.message.trim() || values.subject.trim()));
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  if (sentTo) {
    return (
      <div className="kt-contact-sent text-center py-4" role="status">
        <i className="bi bi-envelope-check fs-1" aria-hidden="true" />
        <h3 className="h3 mt-2">{t('contacts.sentTitle')}</h3>
        <p>{t('contacts.sentText', { email: sentTo })}</p>
        <button type="button" className="btn btn-outline-primary" onClick={() => setSentTo(null)}>{t('contacts.another')}</button>
      </div>
    );
  }

  const field = (name, label, props = {}) => (
    <div className={`mb-3 ${props.col ?? 'col-12'}`}>
      <label className="form-label fw-semibold" htmlFor={`${id}-${name}`}>
        {label}<span className="text-danger" aria-hidden="true"> *</span>
      </label>
      {props.textarea ? (
        <textarea id={`${id}-${name}`} className={`form-control ${errors[name] ? 'is-invalid' : ''}`} rows={6} maxLength={5000}
          required value={values[name]} onChange={set(name)} aria-describedby={`${id}-${name}-help`} />
      ) : (
        <input id={`${id}-${name}`} type={props.type ?? 'text'} className={`form-control ${errors[name] ? 'is-invalid' : ''}`}
          maxLength={props.maxLength} required autoComplete={props.autoComplete} value={values[name]} onChange={set(name)} />
      )}
      {props.help && <div className="form-text" id={`${id}-${name}-help`}>{props.help}</div>}
      {errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>}
    </div>
  );

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(values); }} aria-labelledby={`${id}-title`}>
      <h3 className="h3 mb-1" id={`${id}-title`}>{t('contacts.formTitle')}</h3>
      <p className="small text-body-secondary">{t('contacts.formLead')}</p>
      <div className="row">
        {field('name', t('contacts.name'), { col: 'col-md-6', maxLength: 120, autoComplete: 'name' })}
        {field('email', t('contacts.yourEmail'), { col: 'col-md-6', type: 'email', maxLength: 254, autoComplete: 'email' })}
        {field('subject', t('contacts.subject'), { maxLength: 150 })}
        {field('message', t('contacts.message'), { textarea: true, help: t('contacts.messageHelp', { count: values.message.length }) })}
      </div>
      {/* armadilha para robôs: invisível para pessoas e leitores de tela */}
      <div className="kt-hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>
      <SaveButton busy={busy} label={busy ? t('contacts.sending') : t('contacts.send')} />
    </form>
  );
}

export function Contacts() {
  const { t } = useI18n();
  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 1232 }}>
      <ContentCard icon="geo-alt" title={t('contacts.title')} as="h1" footer={`© OrkneyTech · ${SITE_URL}`} bodyClassName="kt-tinted">
        <div className="row g-4">
          <div className="col-lg-5 position-relative">
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
            <p className="small text-body-secondary mb-2">{t('contacts.or')}</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-outline-primary">
              <i className="bi bi-envelope me-1" aria-hidden="true" />{t('contacts.write')}
            </a>
          </div>
          <div className="col-lg-7">
            <div className="kt-contact-card">
              <ContactForm />
            </div>
          </div>
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
        <div className="d-flex justify-content-end align-items-center mt-4 mx-md-4">
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
