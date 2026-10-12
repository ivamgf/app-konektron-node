import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { BrandMark, IconInput, Loading, Panel } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useSubmit } from '../../lib/hooks.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Validação no navegador (UC001/UC002/UC004); a API valida de novo
function validate(t, values, { confirm = false, terms = false, minPassword = true } = {}) {
  const errors = {};
  if ('email' in values) {
    if (!values.email.trim()) errors.email = t('errors.required');
    else if (!EMAIL_RE.test(values.email.trim())) errors.email = t('errors.invalidEmail');
  }
  if ('password' in values) {
    if (!values.password) errors.password = t('errors.required');
    else if (minPassword && values.password.length < 8) errors.password = t('errors.minPassword');
  }
  if (confirm && values.password !== values.confirmPassword) {
    errors.confirmPassword = t('errors.passwordsDiffer');
  }
  if (terms && !values.acceptTerms) errors.acceptTerms = t('errors.acceptTerms');
  return errors;
}

// Foca o primeiro campo com erro, só ao enviar (UC001 E1–E3). Como efeito, roubaria o foco
// de quem está digitando sempre que a lista de erros mudasse.
function focusFirstError(formRef, errors) {
  const first = Object.keys(errors)[0];
  if (first) formRef.current?.querySelector(`[name="${first}"]`)?.focus();
}

function AuthLayout({ title, children }) {
  return (
    <div className="px-3">
      <Panel title={title}>
        <BrandMark size={200} className="mt-2 mb-4" title="" />
        {children}
      </Panel>
    </div>
  );
}

export function Signin() {
  const { t } = useI18n();
  const { login } = useAuth();
  const formRef = useRef(null);
  const [values, setValues] = useState({ email: '', password: '' });
  const [localErrors, setLocalErrors] = useState({});
  const { submit, busy, errors } = useSubmit((v) => login(v));
  const allErrors = { ...errors, ...localErrors };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(t, values, { minPassword: false });
    setLocalErrors(found);
    focusFirstError(formRef, found);
    if (Object.keys(found).length) return;
    const ok = await submit({ email: values.email.trim(), password: values.password });
    if (!ok) setValues((v) => ({ ...v, password: '' })); // UC002 E1: limpa a senha
  };

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setLocalErrors(({ [name]: _, ...rest }) => rest);
  };
  return (
    <AuthLayout title={t('auth.signinTitle')}>
      <form ref={formRef} className="kt-form" onSubmit={onSubmit} noValidate>
        <IconInput label={t('auth.email')} icon="person" name="email" type="email" autoComplete="email"
          placeholder={t('auth.emailPlaceholder')} value={values.email} onChange={set('email')} error={allErrors.email} />
        <IconInput label={t('auth.password')} icon="lock" name="password" type="password" autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')} value={values.password} onChange={set('password')} error={allErrors.password} />
        <button type="submit" className="btn btn-primary w-100 fw-bold mt-2" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signinButton')}
        </button>
        <button type="button" className="btn btn-outline-primary w-100 mt-4 text-body" disabled title={t('auth.googleSoon')}>
          <i className="bi bi-google text-primary me-3" aria-hidden="true" />
          {t('auth.google')}
        </button>
        <p className="small text-body-secondary text-center mt-1 mb-0">{t('auth.googleSoon')}</p>
        <div className="d-flex justify-content-between kt-auth-links mt-3">
          <Link to="/recover">{t('auth.forgot')}</Link>
          <Link to="/signup">{t('auth.noAccount')}</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { t } = useI18n();
  const { register } = useAuth();
  const toast = useToast();
  const formRef = useRef(null);
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '', acceptTerms: false });
  const [localErrors, setLocalErrors] = useState({});
  const { submit, busy, errors } = useSubmit((v) => register(v), {
    onSuccess: () => toast.success(t('auth.signedUp')), // UC001: logado e avisado para confirmar o e-mail
  });
  const allErrors = { ...errors, ...localErrors };

  const onSubmit = (e) => {
    e.preventDefault();
    const found = validate(t, values, { confirm: true, terms: true });
    setLocalErrors(found);
    focusFirstError(formRef, found);
    if (Object.keys(found).length) return;
    submit({ ...values, email: values.email.trim() });
  };

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    setLocalErrors(({ [name]: _, ...rest }) => rest);
  };

  return (
    <AuthLayout title={t('auth.signupTitle')}>
      <form ref={formRef} className="kt-form" onSubmit={onSubmit} noValidate>
        <IconInput label={t('auth.email')} icon="envelope" name="email" type="email" autoComplete="email"
          placeholder={t('auth.emailPlaceholder')} value={values.email} onChange={set('email')} error={allErrors.email} />
        <IconInput label={t('auth.password')} icon="lock" name="password" type="password" autoComplete="new-password"
          placeholder={t('auth.passwordPlaceholder')} value={values.password} onChange={set('password')} error={allErrors.password} />
        <IconInput label={t('auth.confirmPassword')} icon="lock-fill" name="confirmPassword" type="password"
          autoComplete="new-password" placeholder={t('auth.confirmPlaceholder')} value={values.confirmPassword}
          onChange={set('confirmPassword')} error={allErrors.confirmPassword} />
        <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signupButton')}
        </button>
        <div className="d-flex justify-content-between align-items-start kt-auth-links mt-4">
          <div className="form-check">
            <input className={`form-check-input ${allErrors.acceptTerms ? 'is-invalid' : ''}`} type="checkbox"
              id="acceptTerms" name="acceptTerms" checked={values.acceptTerms} onChange={set('acceptTerms')}
              aria-describedby={allErrors.acceptTerms ? 'acceptTerms-error' : undefined} />
            <label className="form-check-label" htmlFor="acceptTerms">
              {t('auth.acceptTerms', { terms: '' })}
              <Link to="/terms" target="_blank" rel="noopener">{t('auth.termsLink')}</Link>
            </label>
            {allErrors.acceptTerms && (
              <div className="invalid-feedback d-block fs-6" id="acceptTerms-error">{allErrors.acceptTerms}</div>
            )}
          </div>
          <Link to="/signin">{t('auth.haveAccount')}</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function Recover() {
  const { t } = useI18n();
  const toast = useToast();
  const formRef = useRef(null);
  const [email, setEmail] = useState('');
  const [localErrors, setLocalErrors] = useState({});
  const { submit, busy, errors } = useSubmit((v) => authApi.forgotPassword(v), {
    onSuccess: () => toast.success(t('auth.recoverSent')),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    const found = validate(t, { email });
    setLocalErrors(found);
    focusFirstError(formRef, found);
    if (found.email) return toast.error(found.email); // protótipo: aviso no topo
    submit(email.trim());
  };

  return (
    <AuthLayout title={t('auth.recoverTitle')}>
      <form ref={formRef} className="kt-form" onSubmit={onSubmit} noValidate>
        <p className="kt-form-title">{t('auth.recoverText')}</p>
        <IconInput label={t('auth.email')} icon="envelope" name="email" type="email" autoComplete="email"
          placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => { setEmail(e.target.value); setLocalErrors({}); }}
          error={localErrors.email ?? errors.email} />
        <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={busy}>
          {busy ? t('common.loading') : t('auth.send')}
        </button>
        <div className="text-end kt-auth-links mt-4">
          <Link to="/signin">{t('auth.haveAccount')}</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

// Link do e-mail de recuperação: /reset-password?token=...
export function ResetPassword() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const formRef = useRef(null);
  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [localErrors, setLocalErrors] = useState({});
  const { submit, busy, errors } = useSubmit((v) => authApi.resetPassword(v), {
    onSuccess: () => {
      toast.success(t('auth.resetDone'));
      navigate('/signin'); // UC004: volta para a autenticação
    },
  });

  const onSubmit = (e) => {
    e.preventDefault();
    const found = validate(t, values, { confirm: true });
    setLocalErrors(found);
    focusFirstError(formRef, found);
    if (Object.keys(found).length) return;
    submit({ token, ...values });
  };

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setLocalErrors(({ [name]: _, ...rest }) => rest);
  };
  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {!token ? (
        <div className="kt-form text-center">
          <p className="alert alert-warning">{t('auth.tokenMissing')}</p>
          <Link to="/recover">{t('auth.recoverTitle')}</Link>
        </div>
      ) : (
        <form ref={formRef} className="kt-form" onSubmit={onSubmit} noValidate>
          <p className="kt-form-title">{t('auth.resetText')}</p>
          <IconInput label={t('profile.newPassword')} icon="lock" name="password" type="password" autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder')} value={values.password} onChange={set('password')}
            error={localErrors.password ?? errors.password} />
          <IconInput label={t('auth.confirmPassword')} icon="lock-fill" name="confirmPassword" type="password"
            autoComplete="new-password" placeholder={t('auth.confirmPlaceholder')} value={values.confirmPassword}
            onChange={set('confirmPassword')} error={localErrors.confirmPassword ?? errors.confirmPassword} />
          <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={busy}>
            {busy ? t('common.saving') : t('auth.resetButton')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

// Link do e-mail de ativação: /verify-email?token=...
export function VerifyEmail() {
  const { t } = useI18n();
  const { status, reloadUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'loading' : 'failed');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // o token é de uso único: não repetir no StrictMode
    authApi
      .verifyEmail(token)
      .then(async () => {
        setState('done');
        if (status === 'authenticated') await reloadUser().catch(() => {});
      })
      .catch(() => setState('failed'));
  }, [token, status, reloadUser]);

  return (
    <AuthLayout title={t('auth.verifyTitle')}>
      <div className="kt-form text-center">
        {state === 'loading' && <Loading small label={t('auth.verifying')} />}
        {state === 'done' && (
          <>
            <p className="alert alert-success">{t('auth.verified')}</p>
            <Link to={status === 'authenticated' ? '/projects' : '/signin'} className="btn btn-primary">
              {status === 'authenticated' ? t('dashboard.title') : t('auth.signinButton')}
            </Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <p className="alert alert-warning">{t('auth.verifyFailed')}</p>
            {status === 'authenticated' ? (
              <Link to="/profile" className="btn btn-primary">{t('auth.resend')}</Link>
            ) : (
              <Link to="/signin">{t('auth.signinButton')}</Link>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
