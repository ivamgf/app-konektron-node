// Assinaturas: planos com preço, checkout (redireciona ao PagBank), volta do pagamento e a aba do perfil
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { refreshSession } from '../../api/client.js';
import { billingApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { PLAN_SECTIONS, SECTION_KEYS } from '../public/PublicPages.jsx';

export const PAID_PLANS = ['standard', 'master'];
// Assinatura que libera o plano (espelha a API: billing.service.js). Em atraso ou com ação pendente,
// só quem já pagou ao menos uma vez mantém o acesso: o 1º pagamento recusado também vira OVERDUE.
// Cancelada depois do prazo de arrependimento: o acesso segue até accessUntil (fim do período pago).
export const hasAccess = (s) =>
  ['active', 'trial'].includes(s?.status) ||
  (['overdue', 'pending_action'].includes(s?.status) && Boolean(s.activatedAt)) ||
  (s?.status === 'canceled' && Boolean(s.accessUntil) && new Date(s.accessUntil) > new Date());
// Direito de arrependimento (CDC art. 49): 7 dias do 1º pagamento, com estorno integral
export const inWithdrawalPeriod = (s) => Boolean(s?.activatedAt) && Date.now() - new Date(s.activatedAt) <= 7 * 86_400_000;
const WAITING = ['checkout', 'pending'];
const FEATURED_PLAN = 'standard';
const POLL_MS = 3000;
const POLL_TRIES = 10;
const STATUS_BADGE = {
  active: 'text-bg-success', trial: 'text-bg-success', overdue: 'text-bg-warning', pending_action: 'text-bg-warning',
  checkout: 'text-bg-info', pending: 'text-bg-info',
};

const INTL = { en: 'en-US', es: 'es-ES' };
export const formatMoney = (cents, locale) =>
  new Intl.NumberFormat(INTL[locale] ?? 'pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_BADGE[status] ?? 'text-bg-secondary'}`}>{t(`billing.status.${status}`)}</span>;
}

// Preços públicos; sem resposta, os cartões aparecem sem preço e sem botão de assinar
function usePlanCatalog() {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let cancelled = false;
    billingApi.plans().then((c) => !cancelled && setCatalog(c), () => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

// Plano já pago fica no token só depois da renovação: renova e recarrega o usuário
async function applyNewPlan(reloadUser) {
  await refreshSession().catch(() => {});
  await reloadUser().catch(() => {});
}

/** Cartões dos planos com preço e o botão que leva ao checkout. */
export function PlanCards() {
  const { t, locale } = useI18n();
  const { user, status, isAdmin } = useAuth();
  const authed = status === 'authenticated';
  const catalog = usePlanCatalog();
  const priceOf = (plan) => (catalog?.enabled ? catalog.plans.find((p) => p.plan === plan)?.amount : undefined);

  const action = (plan, featured) => {
    const price = priceOf(plan);
    const btn = `btn w-100 ${featured ? 'btn-accent fw-bold' : 'btn-outline-primary'}`;
    if (!authed) {
      const to = plan !== 'free' && price ? `/signup?next=${encodeURIComponent(`/checkout/${plan}`)}` : '/signup';
      return <Link to={to} className={btn}>{plan === 'free' ? t('home.start') : price ? t('billing.subscribe') : t('home.choose')}</Link>;
    }
    if (isAdmin) return null;
    if (user?.plan === plan) {
      return <span className="btn w-100 btn-outline-secondary disabled" aria-disabled="true">{t('billing.currentPlan')}</span>;
    }
    if (plan === 'free' || !price) return null;
    return <Link to={`/checkout/${plan}`} className={btn}>{t('billing.subscribe')}</Link>;
  };

  return (
    <div className="row g-4 pt-2">
      {Object.entries(PLAN_SECTIONS).map(([plan, included]) => {
        const featured = plan === FEATURED_PLAN;
        const price = priceOf(plan);
        const footer = action(plan, featured);
        return (
          <div className="col-md-4" key={plan}>
            <article className={`kt-home-plan ${featured ? 'is-featured' : ''}`} aria-labelledby={`kt-plan-${plan}`}>
              {featured && <span className="kt-home-ribbon">{t('home.recommended')}</span>}
              <header>
                <h3 id={`kt-plan-${plan}`}>{t(`plans.${plan}`)}</h3>
                <small>{t(`home.tagline.${plan}`)}</small>
                {(plan === 'free' || price) && (
                  <p className="kt-plan-price mb-0 mt-2">
                    {plan === 'free' ? (
                      <strong>{t('billing.free')}</strong>
                    ) : (
                      <>
                        <strong>{formatMoney(price, locale)}</strong> <span>{t('billing.perMonth')}</span>
                      </>
                    )}
                  </p>
                )}
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
              {footer && <footer>{footer}</footer>}
            </article>
          </div>
        );
      })}
    </div>
  );
}

export function Plans() {
  const { t } = useI18n();
  return (
    <section className="kt-home-band kt-home-plans kt-on-color" aria-labelledby="kt-plans-title">
      <div className="container-xl px-3">
        <h1 className="kt-home-heading" id="kt-plans-title">{t('home.plansTitle')}</h1>
        <p className="kt-home-sub">{t('home.plansLead')}</p>
        <PlanCards />
        <p className="kt-home-note mt-4 mb-0">
          <i className="bi bi-credit-card me-1" aria-hidden="true" /> {t('billing.plansNote')}
        </p>
      </div>
    </section>
  );
}

/** Resumo do plano escolhido; "Ir para o pagamento" leva à página do PagBank. */
export function Checkout() {
  const { t, locale } = useI18n();
  const { plan } = useParams();
  const { isAdmin } = useAuth();
  const overview = useAsync(() => billingApi.subscription(), []);
  // continua "ocupado" depois do sucesso: a página está saindo para o PagBank
  const [leaving, setLeaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const go = useSubmit((p) => billingApi.checkout(p, true), {
    onSuccess: ({ payUrl }) => {
      setLeaving(true);
      window.location.assign(payUrl);
    },
  });

  if (!PAID_PLANS.includes(plan)) {
    return (
      <div className="container-xl px-3 mt-3">
        <div className="alert alert-warning">{t('billing.unknownPlan')} <Link to="/plans">{t('billing.seePlans')}</Link></div>
      </div>
    );
  }
  const data = overview.data;
  const price = data?.enabled ? data.plans.find((p) => p.plan === plan)?.amount : undefined;
  const current = hasAccess(data?.current) ? data.current : null;
  const planName = t(`plans.${plan}`);

  let blocked = null;
  if (isAdmin) blocked = t('billing.adminNote');
  else if (data && !price) blocked = t('billing.unavailable');
  else if (current?.plan === plan && current.status !== 'canceled') blocked = t('billing.alreadySubscribed', { plan: planName });

  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 760 }}>
      <ContentCard icon="credit-card" as="h1" title={t('billing.checkoutTitle', { plan: planName })}>
        {!data ? (
          <Loading small />
        ) : (
          <>
            {price && (
              <p className="kt-checkout-price mb-3">
                <strong>{formatMoney(price, locale)}</strong> <span>{t('billing.perMonth')}</span>
              </p>
            )}
            <h2 className="h5">{t('billing.included')}</h2>
            <ul className="row list-unstyled g-1 mb-4">
              {PLAN_SECTIONS[plan].map((key) => (
                <li className="col-sm-6" key={key}>
                  <i className="bi bi-check-circle-fill text-primary me-2" aria-hidden="true" />{t(`sections.${key}.name`)}
                </li>
              ))}
            </ul>
            <ul className="small text-body-secondary mb-4">
              <li>{t('billing.howRecurring')}</li>
              <li>{t('billing.howRedirect')}</li>
              <li>{t('billing.howWithdrawal')}</li>
              <li>{t('billing.howCancel')}</li>
            </ul>
            {current && current.plan !== plan && (
              <div className="alert alert-info">{t('billing.switchNote', { plan: t(`plans.${current.plan}`) })}</div>
            )}
            {blocked ? (
              <div className="alert alert-secondary mb-0">
                {blocked} <Link to="/profile?tab=subscription">{t('billing.manage')}</Link>
              </div>
            ) : (
              <>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="kt-accept-billing" checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)} />
                <label className="form-check-label" htmlFor="kt-accept-billing">
                  {t('billing.acceptTerms', { price: price ? formatMoney(price, locale) : '' })}{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">{t('billing.readTerms')}</Link>
                </label>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-accent btn-lg fw-bold" disabled={!accepted || go.busy || leaving} onClick={() => go.submit(plan)}>
                  <i className="bi bi-lock-fill me-2" aria-hidden="true" />
                  {go.busy || leaving ? t('billing.redirecting') : t('billing.goToPayment')}
                </button>
                <Link to="/plans" className="btn btn-outline-secondary btn-lg">{t('billing.seePlans')}</Link>
              </div>
              </>
            )}
          </>
        )}
      </ContentCard>
    </div>
  );
}

/** Volta do PagBank (redirect_url): confere a assinatura até o pagamento ser confirmado. */
export function BillingReturn() {
  const { t } = useI18n();
  const { reloadUser } = useAuth();
  // reloadUser muda quando o usuário recarrega; numa dependência do efeito, a conferência recomeçaria
  const reloadRef = useRef(reloadUser);
  useLayoutEffect(() => {
    reloadRef.current = reloadUser;
  });
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [state, setState] = useState({ subscription: null, tries: 0, error: false });

  useEffect(() => {
    if (!ref) return undefined;
    let cancelled = false;
    let timer;
    const check = async (tries) => {
      try {
        const { subscription } = await billingApi.refresh(ref);
        if (cancelled) return;
        if (hasAccess(subscription)) await applyNewPlan(reloadRef.current);
        if (cancelled) return;
        setState({ subscription, tries, error: false });
        if (WAITING.includes(subscription.status) && tries < POLL_TRIES) timer = setTimeout(() => check(tries + 1), POLL_MS);
      } catch {
        if (!cancelled) setState((s) => ({ ...s, tries, error: true }));
      }
    };
    check(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref]);

  const sub = state.subscription;
  const planName = sub ? t(`plans.${sub.plan}`) : '';
  let body;
  if (!ref || state.error) {
    body = <div className="alert alert-warning mb-0">{t('billing.returnError')}</div>;
  } else if (!sub) {
    body = <Loading small label={t('billing.confirming')} />;
  } else if (hasAccess(sub)) {
    body = (
      <>
        <div className="alert alert-success">
          <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />{t('billing.success', { plan: planName })}
        </div>
        <Link to="/projects" className="btn btn-primary me-2">{t('home.goDashboard')}</Link>
        <Link to="/profile?tab=subscription" className="btn btn-outline-secondary">{t('billing.manage')}</Link>
      </>
    );
  } else if (WAITING.includes(sub.status) && state.tries < POLL_TRIES) {
    body = <Loading small label={t('billing.confirming')} />;
  } else if (WAITING.includes(sub.status)) {
    // sem confirmação ainda: o pagamento pode não ter sido concluído ou o aviso do PagBank está a caminho
    body = (
      <>
        <p>{t('billing.notConfirmed')}</p>
        <div className="d-flex flex-wrap gap-2">
          {sub.status === 'checkout' && sub.payUrl && (
            <a href={sub.payUrl} className="btn btn-accent fw-bold">{t('billing.continuePayment')}</a>
          )}
          <Link to="/profile?tab=subscription" className="btn btn-outline-secondary">{t('billing.manage')}</Link>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="alert alert-warning">{t('billing.failed', { status: t(`billing.status.${sub.status}`) })}</div>
        <Link to={`/checkout/${sub.plan}`} className="btn btn-primary">{t('billing.tryAgain')}</Link>
      </>
    );
  }

  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 760 }}>
      <ContentCard icon="receipt" as="h1" title={t('billing.returnTitle')}>{body}</ContentCard>
    </div>
  );
}

/** Aba "Assinatura" do perfil: situação, próxima cobrança, cancelamento e histórico. */
export function SubscriptionTab() {
  const { t, locale } = useI18n();
  const { user, reloadUser } = useAuth();
  const toast = useToast();
  const overview = useAsync(() => billingApi.subscription(), []);
  const [confirming, setConfirming] = useState(false);
  const cancel = useSubmit(() => billingApi.cancel(), {
    onSuccess: async ({ withdrawal, refund, subscription }) => {
      setConfirming(false);
      await applyNewPlan(reloadUser);
      if (withdrawal && refund?.failed) toast.error(t('billing.refundFailed'));
      else if (withdrawal) toast.success(t('billing.refundRequested'));
      else if (subscription.accessUntil) toast.success(t('billing.canceledUntil', { date: formatDate(String(subscription.accessUntil).slice(0, 10), locale) }));
      else toast.success(t('billing.canceled'));
      overview.reload();
    },
  });

  if (!overview.data) return <Loading small />;
  const { current, history } = overview.data;
  const active = hasAccess(current);
  const stillBilled = active && current.status !== 'canceled';
  const withdrawal = stillBilled && inWithdrawalPeriod(current);
  const open = current && current.status === 'checkout' && current.payUrl;

  return (
    <>
      <dl className="row mb-4">
        <dt className="col-sm-3">{t('profile.plan')}</dt>
        <dd className="col-sm-9">{t(`plans.${user.plan}`)}</dd>
        {current && (
          <>
            <dt className="col-sm-3">{t('billing.subscription')}</dt>
            <dd className="col-sm-9">
              {t(`plans.${current.plan}`)} · {formatMoney(current.amount, locale)} {t('billing.perMonth')} <StatusBadge status={current.status} />
            </dd>
            {current.status === 'canceled' && current.accessUntil && (
              <>
                <dt className="col-sm-3">{t('billing.accessUntil')}</dt>
                <dd className="col-sm-9">{formatDate(String(current.accessUntil).slice(0, 10), locale)}</dd>
              </>
            )}
            {stillBilled && current.nextInvoiceAt && (
              <>
                <dt className="col-sm-3">{t('billing.nextInvoice')}</dt>
                <dd className="col-sm-9">{formatDate(current.nextInvoiceAt, locale)}</dd>
              </>
            )}
          </>
        )}
      </dl>
      {active && ['overdue', 'pending_action'].includes(current.status) && <div className="alert alert-warning">{t('billing.overdueNote')}</div>}

      <div className="d-flex flex-wrap gap-2 mb-4">
        {open && <a href={current.payUrl} className="btn btn-accent fw-bold">{t('billing.continuePayment')}</a>}
        {user.role !== 'admin' && (
          <Link to="/plans" className="btn btn-primary">{active ? t('billing.changePlan') : t('billing.seePlans')}</Link>
        )}
        {(stillBilled || open) && (
          <button type="button" className="btn btn-outline-danger" onClick={() => setConfirming(true)}>{t('billing.cancel')}</button>
        )}
      </div>

      {history.length > 0 && (
        <>
          <h2 className="h5">{t('billing.history')}</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr><th>{t('billing.date')}</th><th>{t('profile.plan')}</th><th className="text-end">{t('billing.amount')}</th><th>{t('billing.situation')}</th></tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.createdAt, locale)}</td>
                    <td>{t(`plans.${s.plan}`)}</td>
                    <td className="text-end">{formatMoney(s.amount, locale)}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirming && (
        <Modal
          title={t('billing.cancel')}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-danger" disabled={cancel.busy} onClick={() => cancel.submit()}>
                {t('billing.confirmCancel')}
              </button>
            </>
          }
        >
          <p className="mb-0">
            {!stillBilled
              ? t('billing.cancelOpen')
              : withdrawal
                ? t('billing.cancelWithdrawal', { amount: formatMoney(current.amount, locale) })
                : t('billing.cancelWarning', { plan: t(`plans.${current.plan}`), date: formatDate(current.nextInvoiceAt, locale) })}
          </p>
        </Modal>
      )}
    </>
  );
}
