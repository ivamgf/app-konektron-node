import { useState } from 'react';
import { useNavigate } from 'react-router';
import { authApi, profileApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import ResourceManager from '../../components/ResourceManager.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { sameValues, SaveButton, saveShortcut, useUnsavedChanges } from '../../components/unsaved.jsx';
import { ContentCard, Loading, Modal } from '../../components/ui.jsx';
import { LANGUAGES, useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { addressConfig } from '../projects/resources.jsx';
import { VerifyBanner } from './Dashboard.jsx';

const TABS = ['personal', 'social', 'addresses', 'security'];
const ICONS = { personal: 'person', social: 'share', addresses: 'geo-alt', security: 'shield-lock' };

function PersonalTab({ profile, onSaved }) {
  const { t, setLocale } = useI18n();
  const toast = useToast();
  const fields = [
    { name: 'fullName', label: 'profile.fullName', maxLength: 200, col: 'col-md-8' },
    { name: 'nickname', label: 'profile.nickname', maxLength: 100, col: 'col-md-4' },
    { name: 'phoneMobile', label: 'profile.phoneMobile', maxLength: 20, col: 'col-md-4' },
    { name: 'phoneLandline', label: 'profile.phoneLandline', maxLength: 20, col: 'col-md-4' },
    { name: 'birthDate', label: 'profile.birthDate', type: 'date', col: 'col-md-4' },
    { name: 'company', label: 'profile.company', maxLength: 200, col: 'col-md-4' },
    { name: 'department', label: 'profile.department', maxLength: 200, col: 'col-md-4' },
    { name: 'jobTitle', label: 'profile.jobTitle', maxLength: 200, col: 'col-md-4' },
    { name: 'avatarUrl', label: 'profile.avatarUrl', type: 'url', maxLength: 500, col: 'col-md-8' },
    {
      name: 'locale', label: 'profile.locale', type: 'select', required: true, col: 'col-md-4',
      options: LANGUAGES.map(({ code }) => ({ value: code, label: t(`enums.locale.${code}`) })),
    },
  ];
  const [values, setValues] = useState(() => toFormValues(fields, profile));
  const { submit, busy, errors } = useSubmit((body) => profileApi.update(body), {
    onSuccess: (updated) => {
      setLocale(updated.locale); // RNF5: idioma do perfil vale para a interface
      toast.success(t('common.saved'));
      onSaved(updated);
    },
  });
  const dirty = !sameValues(values, toFormValues(fields, profile));
  useUnsavedChanges(dirty);
  return (
    <form noValidate onKeyDown={saveShortcut} onSubmit={(e) => { e.preventDefault(); submit(toPayload(fields, values, t)); }}>
      <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      <SaveButton busy={busy} dirty={dirty} />
    </form>
  );
}

// RF3: "o sistema deve permitir adição de campos" de redes sociais (até 20)
function SocialTab({ profile, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState(() => profile.socialNetworks.map(({ network, url }) => ({ network, url })));
  const { submit, busy, errors } = useSubmit((socialNetworks) => profileApi.update({ socialNetworks }), {
    onSuccess: (updated) => {
      toast.success(t('common.saved'));
      onSaved(updated);
    },
  });
  const update = (i, key, value) => setRows((list) => list.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(rows.filter((r) => r.network || r.url)); }}>
      {rows.map((row, i) => (
        <div className="row g-2 align-items-end mb-2" key={i}>
          <div className="col-md-3">
            <label className="form-label small" htmlFor={`net-${i}`}>{t('profile.network')}</label>
            <input id={`net-${i}`} className="form-control" maxLength={50} value={row.network}
              placeholder="github, linkedin…" onChange={(e) => update(i, 'network', e.target.value)} />
          </div>
          <div className="col">
            <label className="form-label small" htmlFor={`url-${i}`}>URL</label>
            <input id={`url-${i}`} type="url" className="form-control" maxLength={500} value={row.url}
              placeholder="https://" onChange={(e) => update(i, 'url', e.target.value)} />
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-outline-danger" aria-label={`${t('common.delete')} ${row.network}`}
              onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
              <i className="bi bi-trash" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {errors.socialNetworks && <div className="text-danger small mb-2">{errors.socialNetworks}</div>}
      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-outline-primary" disabled={rows.length >= 20}
          onClick={() => setRows((list) => [...list, { network: '', url: '' }])}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('profile.addNetwork')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
      </div>
    </form>
  );
}

function SecurityTab() {
  const { t } = useI18n();
  const { user, replaceTokens, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const change = useSubmit((body) => authApi.changePassword(body), {
    onSuccess: (tokens) => {
      replaceTokens(tokens); // as outras sessões caem; esta continua com tokens novos
      setPwd({ currentPassword: '', password: '', confirmPassword: '' });
      toast.success(t('profile.passwordChanged'));
    },
  });
  const remove = useSubmit((password) => authApi.deleteAccount(password), {
    onSuccess: async () => {
      await logout().catch(() => {});
      toast.success(t('profile.deleted'));
      navigate('/');
    },
  });

  const pwdFields = [
    { name: 'currentPassword', label: 'profile.currentPassword', type: 'password', col: 'col-md-4' },
    { name: 'password', label: 'profile.newPassword', type: 'password', col: 'col-md-4' },
    { name: 'confirmPassword', label: 'auth.confirmPassword', type: 'password', col: 'col-md-4' },
  ];
  const mismatch = pwd.confirmPassword && pwd.password !== pwd.confirmPassword;

  return (
    <>
      <h2 className="h2">{t('profile.account')}</h2>
      <dl className="row mb-4">
        <dt className="col-sm-3">{t('auth.email')}</dt>
        <dd className="col-sm-9">
          {user.email}{' '}
          <span className={`badge ${user.emailVerified ? 'text-bg-success' : 'text-bg-warning'}`}>
            {user.emailVerified ? t('admin.verified') : t('auth.notVerified')}
          </span>
        </dd>
        <dt className="col-sm-3">{t('admin.role')}</dt>
        <dd className="col-sm-9">{t(`roles.${user.role}`)}</dd>
        <dt className="col-sm-3">{t('profile.plan')}</dt>
        <dd className="col-sm-9">{t(`plans.${user.plan}`)}</dd>
      </dl>

      <h2 className="h2">{t('profile.changePassword')}</h2>
      <form className="mb-4" noValidate
        onSubmit={(e) => { e.preventDefault(); if (!mismatch) change.submit(pwd); }}>
        <div className="row">
          {pwdFields.map((f) => (
            <div className={`mb-3 ${f.col}`} key={f.name}>
              <label className="form-label fw-semibold" htmlFor={`pwd-${f.name}`}>{t(f.label)}</label>
              <input id={`pwd-${f.name}`} type="password" className={`form-control ${(change.errors[f.name] || (f.name === 'confirmPassword' && mismatch)) ? 'is-invalid' : ''}`}
                autoComplete={f.name === 'currentPassword' ? 'current-password' : 'new-password'}
                value={pwd[f.name]} onChange={(e) => setPwd((s) => ({ ...s, [f.name]: e.target.value }))} />
              <div className="invalid-feedback">
                {f.name === 'confirmPassword' && mismatch ? t('errors.passwordsDiffer') : change.errors[f.name]}
              </div>
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={change.busy || !pwd.currentPassword || !pwd.password}>
          {change.busy ? t('common.saving') : t('profile.changePassword')}
        </button>
      </form>

      <div className="d-flex flex-wrap gap-2 border-top pt-4">
        <button type="button" className="btn btn-outline-secondary"
          onClick={async () => { await logout({ allDevices: true }); toast.success(t('auth.signedOut')); navigate('/signin'); }}>
          <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />{t('profile.signoutAll')}
        </button>
        <button type="button" className="btn btn-outline-danger" onClick={() => setDeleting(true)}>
          <i className="bi bi-person-x me-1" aria-hidden="true" />{t('profile.deleteAccount')}
        </button>
      </div>

      {deleting && (
        <Modal
          title={t('profile.deleteAccount')}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleting(false)}>{t('common.cancel')}</button>
              <button type="submit" form="kt-delete-account" className="btn btn-danger" disabled={remove.busy || !deletePassword}>
                {t('common.delete')}
              </button>
            </>
          }
        >
          <form id="kt-delete-account" onSubmit={(e) => { e.preventDefault(); remove.submit(deletePassword); }}>
            <p>{t('profile.deleteWarning')}</p>
            <label className="form-label fw-semibold" htmlFor="delete-password">{t('auth.password')}</label>
            <input id="delete-password" type="password" className="form-control" autoComplete="current-password"
              value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Profile() {
  const { t } = useI18n();
  const [tab, setTab] = useState('personal');
  const profile = useAsync(() => profileApi.get(), []);
  const addresses = addressConfig(t);

  return (
    <div className="container-xl px-3 mt-3">
      <VerifyBanner />
      <ContentCard icon="person-circle" as="h1" title={t('profile.title')}>
        <ul className="nav nav-underline kt-tabs mb-4" role="tablist">
          {TABS.map((key) => (
            <li className="nav-item" key={key} role="presentation">
              <button type="button" role="tab" aria-selected={tab === key}
                className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                <i className={`bi bi-${ICONS[key]} me-1`} aria-hidden="true" />{t(`profile.${key}`)}
              </button>
            </li>
          ))}
        </ul>
        {tab === 'addresses' ? (
          <ResourceManager path="/addresses" {...addresses} />
        ) : tab === 'security' ? (
          <SecurityTab />
        ) : profile.loading && !profile.data ? (
          <Loading small />
        ) : profile.data ? (
          tab === 'personal' ? (
            <PersonalTab key="personal" profile={profile.data} onSaved={profile.setData} />
          ) : (
            <SocialTab key="social" profile={profile.data} onSaved={profile.setData} />
          )
        ) : null}
      </ContentCard>
    </div>
  );
}
