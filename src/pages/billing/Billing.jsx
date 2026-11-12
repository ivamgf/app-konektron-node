// Planos e assinaturas pelo Asaas: cartões dos planos, assinatura (gera a fatura com Pix, boleto ou cartão)
// e a aba Assinatura do perfil
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { refreshSession } from '../../api/client.js';
import { billingApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { FREE_INACTIVE_MONTHS, FREE_PROJECT_LIMIT, PLAN_SECTIONS, SECTION_KEYS } from '../public/PublicPages.jsx';

export const PAID_PLANS = ['standard', 'master'];
// Preços de referência (a API manda os valores vigentes em /billing/plans)
const FALLBACK_PRICES = { free: 0, standard: 7990, master: 17900 };
const FEATURED_PLAN = 'standard';
const STATUS_BADGE = {
  active: 'text-bg-success', pending: 'text-bg-info', overdue: 'text-bg-warning', canceled: 'text-bg-secondary',
};
const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'];
const OPEN = ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'];

const INTL = { en: 'en-US', es: 'es-ES' };
export const formatMoney = (cents, locale) =>
  new Intl.NumberFormat(INTL[locale] ?? 'pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
// Data (sem hora) no fuso de Brasília, como o Asaas
export const formatDay = (value, locale) =>
  value
    ? formatDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), locale)
    : '—';
// CPF 000.000.000-00 ou CNPJ 00.000.000/0000-00 enquanto digita
export function maskCpfCnpj(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_BADGE[status] ?? 'text-bg-secondary'}`}>{t(`billing.status.${status}`)}</span>;
}

function PaymentBadge({ status }) {
  const { t } = useI18n();
  const cls = PAID.includes(status) ? 'text-bg-success' : status === 'OVERDUE' ? 'text-bg-warning' : OPEN.includes(status) ? 'text-bg-info' : 'text-bg-secondary';
  const key = PAID.includes(status) ? 'paid' : status === 'OVERDUE' ? 'overdue' : OPEN.includes(status) ? 'open' : status?.startsWith('REFUND') ? 'refunded' : 'other';
  return <span className={`badge ${cls}`} title={status}>{t(`billing.payment.${key}`)}</span>;
}

// Preços públicos; sem resposta, valem os de referência
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
const priceIn = (catalog, plan) => catalog?.plans?.find((p) => p.plan === plan)?.amount ?? FALLBACK_PRICES[plan];

// O plano novo chega ao token na renovação: renova e recarrega o usuário
async function applyNewPlan(reloadUser) {
  await refreshSession().catch(() => {});
  await reloadUser().catch(() => {});
}

/** Itens de cada plano: seções, IA, limite de projetos e compartilhamento */
function PlanFeatures({ plan }) {
  const { t } = useI18n();
  const included = PLAN_SECTIONS[plan];
  const extras = [
    ['stars', t('billing.featureAi')],
    plan === 'free'
      ? ['folder2', t('billing.featureFreeProjects', { count: FREE_PROJECT_LIMIT, months: FREE_INACTIVE_MONTHS })]
      : ['infinity', t('billing.featureUnlimited')],
    ['people', t('billing.featureShare')],
  ];
  return (
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
      {extras.map(([icon, text]) => (
        <li key={icon}>
          <i className={`bi bi-${icon} me-2 text-primary`} aria-hidden="true" />{text}
        </li>
      ))}
    </ul>
  );
}

/** Cartões dos planos com preço e o botão que leva à assinatura. */
export function PlanCards() {
  const { t, locale } = useI18n();
  const { user, status, isAdmin } = useAuth();
  const authed = status === 'authenticated';
  const catalog = usePlanCatalog();
  const billingOn = catalog?.enabled !== false;

  const action = (plan, featured) => {
    const btn = `btn w-100 ${featured ? 'btn-accent fw-bold' : 'btn-outline-primary'}`;
    if (!authed) {
      const to = plan === 'free' ? '/signup' : `/signup?next=${encodeURIComponent(`/checkout/${plan}`)}`;
      return <Link to={to} className={btn}>{plan === 'free' ? t('home.start') : t('billing.subscribe')}</Link>;
    }
    if (isAdmin) return null;
    if (user?.plan === plan) {
      return <span className="btn w-100 btn-outline-secondary disabled" aria-disabled="true">{t('billing.currentPlan')}</span>;
    }
    if (plan === 'free' || !billingOn) return null;
    return <Link to={`/checkout/${plan}`} className={btn}>{user?.plan === 'free' ? t('billing.subscribe') : t('billing.switchTo', { plan: t(`plans.${plan}`) })}</Link>;
  };

  return (
    <div className="row g-4 pt-2">
      {Object.keys(PLAN_SECTIONS).map((plan) => {
        const featured = plan === FEATURED_PLAN;
        const footer = action(plan, featured);
        return (
          <div className="col-md-4" key={plan}>
            <article className={`kt-home-plan ${featured ? 'is-featured' : ''}`} aria-labelledby={`kt-plan-${plan}`}>
              {featured && <span className="kt-home-ribbon">{t('home.recommended')}</span>}
              <header>
                <h3 id={`kt-plan-${plan}`}>{t(`plans.${plan}`)}</h3>
                <small>{t(`home.tagline.${plan}`)}</small>
                <p className="kt-plan-price mb-0 mt-2">
                  {plan === 'free' ? (
                    <strong>{t('billing.free')}</strong>
                  ) : (
                    <>
                      <strong>{formatMoney(priceIn(catalog, plan), locale)}</strong> <span>{t('billing.perMonth')}</span>
                    </>
                  )}
                </p>
              </header>
              <PlanFeatures plan={plan} />
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

/** Fatura gerada: abrir no Asaas e conferir o pagamento */
function InvoiceStep({ invoiceUrl, startsAt, onPaid }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const check = useSubmit(() => billingApi.refresh(), {
    onSuccess: async (overview) => {
      if (overview.current?.status === 'active') {
        await onPaid(overview);
        toast.success(t('billing.success', { plan: t(`plans.${overview.current.plan}`) }));
      } else {
        toast.error(t('billing.notConfirmed'));
      }
    },
  });
  return (
    <div className="kt-invoice-step">
      <div className="alert alert-success">
        <i className="bi bi-receipt me-2" aria-hidden="true" />
        {startsAt ? t('billing.invoiceScheduled', { date: formatDay(startsAt, locale) }) : t('billing.invoiceReady')}
      </div>
      <div className="d-flex flex-wrap gap-2">
        {invoiceUrl && (
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-lg fw-bold">
            <i className="bi bi-box-arrow-up-right me-2" aria-hidden="true" />{t('billing.openInvoice')}
            <span className="visually-hidden"> ({t('nav.newTab')})</span>
          </a>
        )}
        <button type="button" className="btn btn-outline-primary btn-lg" disabled={check.busy} onClick={() => check.submit()}>
          <i className="bi bi-arrow-repeat me-2" aria-hidden="true" />{check.busy ? t('billing.confirming') : t('billing.checkPayment')}
        </button>
        <Link to="/profile?tab=subscription" className="btn btn-outline-secondary btn-lg">{t('billing.manage')}</Link>
      </div>
      <p className="small text-body-secondary mt-3 mb-0">{t('billing.invoiceHelp')}</p>
    </div>
  );
}

/** Resumo do plano escolhido, CPF/CNPJ e aceite; gera a fatura no Asaas. */
export function Checkout() {
  const { t, locale } = useI18n();
  const { plan } = useParams();
  const { isAdmin, reloadUser } = useAuth();
  const overview = useAsync(() => billingApi.subscription(), []);
  const [doc, setDoc] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState(null);
  const go = useSubmit((body) => billingApi.subscribe(body), { onSuccess: setResult });

  if (!PAID_PLANS.includes(plan)) {
    return (
      <div className="container-xl px-3 mt-3">
        <div className="alert alert-warning">{t('billing.unknownPlan')} <Link to="/plans">{t('billing.seePlans')}</Link></div>
      </div>
    );
  }
  const data = overview.data;
  const price = priceIn(data, plan);
  const planName = t(`plans.${plan}`);
  const current = data?.current && data.current.status !== 'canceled' ? data.current : null;
  const cpfCnpj = doc ?? maskCpfCnpj(data?.cpfCnpj ?? '');
  const pendingSame = current?.plan === plan && current.status === 'pending';

  let blocked = null;
  if (isAdmin || data?.exempt) blocked = t('billing.adminNote');
  else if (data && !data.enabled) blocked = t('billing.unavailable');
  else if (current?.plan === plan && !pendingSame) blocked = t('billing.alreadySubscribed', { plan: planName });

  return (
    <div className="container-xl px-3 mt-3" style={{ maxWidth: 820 }}>
      <ContentCard icon="credit-card" as="h1" title={t('billing.checkoutTitle', { plan: planName })}>
        {!data ? (
          <Loading small />
        ) : (
          <>
            <p className="kt-checkout-price mb-3">
              <strong>{formatMoney(price, locale)}</strong> <span>{t('billing.perMonth')}</span>
              {data.sandbox && <span className="badge text-bg-warning ms-2">{t('billing.sandbox')}</span>}
            </p>
            <h2 className="h5">{t('billing.included')}</h2>
            <ul className="row list-unstyled g-1 mb-3">
              {PLAN_SECTIONS[plan].map((key) => (
                <li className="col-sm-6" key={key}>
                  <i className="bi bi-check-circle-fill text-primary me-2" aria-hidden="true" />{t(`sections.${key}.name`)}
                </li>
              ))}
              <li className="col-sm-6"><i className="bi bi-stars text-primary me-2" aria-hidden="true" />{t('billing.featureAi')}</li>
              <li className="col-sm-6"><i className="bi bi-infinity text-primary me-2" aria-hidden="true" />{t('billing.featureUnlimited')}</li>
            </ul>
            <ul className="small text-body-secondary mb-4">
              <li>{t('billing.howRecurring')}</li>
              <li>{t('billing.howInvoice')}</li>
              <li>{t('billing.howWithdrawal')}</li>
              <li>{t('billing.howCancel')}</li>
            </ul>
            {current && current.plan !== plan && (
              <div className="alert alert-info">{t('billing.switchNote', { plan: t(`plans.${current.plan}`) })}</div>
            )}
            {result ? (
              <InvoiceStep invoiceUrl={result.invoiceUrl} startsAt={result.startsAt}
                onPaid={async () => { await applyNewPlan(reloadUser); overview.reload(); }} />
            ) : blocked ? (
              <div className="alert alert-secondary mb-0">
                {blocked} <Link to="/profile?tab=subscription">{t('billing.manage')}</Link>
              </div>
            ) : (
              <form noValidate onSubmit={(e) => { e.preventDefault(); go.submit({ plan, cpfCnpj }); }}>
                {pendingSame && data.openInvoiceUrl && (
                  <div className="alert alert-info">
                    {t('billing.pendingInvoice')}{' '}
                    <a href={data.openInvoiceUrl} target="_blank" rel="noopener noreferrer">{t('billing.openInvoice')}</a>
                  </div>
                )}
                <div className="mb-3" style={{ maxWidth: 320 }}>
                  <label className="form-label" htmlFor="kt-cpf">{t('billing.cpfCnpj')} <span className="text-danger" aria-hidden="true">*</span></label>
                  <input id="kt-cpf" className={`form-control ${go.errors.cpfCnpj ? 'is-invalid' : ''}`} inputMode="numeric" autoComplete="off"
                    required aria-required="true" aria-describedby="kt-cpf-help" value={cpfCnpj} onChange={(e) => setDoc(maskCpfCnpj(e.target.value))} />
                  {go.errors.cpfCnpj && <div className="invalid-feedback">{go.errors.cpfCnpj}</div>}
                  <div id="kt-cpf-help" className="form-text">{t('billing.cpfCnpjHelp')}</div>
                </div>
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="kt-accept-billing" checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)} />
                  <label className="form-check-label" htmlFor="kt-accept-billing">
                    {t('billing.acceptTerms', { price: formatMoney(price, locale) })}{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer">{t('billing.readTerms')}</Link>
                  </label>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-accent btn-lg fw-bold" disabled={!accepted || go.busy || cpfCnpj.replace(/\D/g, '').length < 11}>
                    <i className="bi bi-lock-fill me-2" aria-hidden="true" />
                    {go.busy ? t('billing.generating') : t('billing.generateInvoice')}
                  </button>
                  <Link to="/plans" className="btn btn-outline-secondary btn-lg">{t('billing.seePlans')}</Link>
                </div>
              </form>
            )}
          </>
        )}
      </ContentCard>
    </div>
  );
}

/** Aba "Assinatura" do perfil: situação, fatura em aberto, cancelamento e histórico. */
export function SubscriptionTab() {
  const { t, locale } = useI18n();
  const { user, reloadUser } = useAuth();
  const toast = useToast();
  const overview = useAsync(() => billingApi.subscription(), []);
  const [confirming, setConfirming] = useState(false);
  const refresh = useSubmit(() => billingApi.refresh(), {
    onSuccess: async (data) => {
      overview.setData(data);
      await applyNewPlan(reloadUser);
      toast.success(t('billing.refreshed'));
    },
  });
  const cancel = useSubmit(() => billingApi.cancel(), {
    onSuccess: async ({ withdrawal, refund, subscription }) => {
      setConfirming(false);
      await applyNewPlan(reloadUser);
      if (withdrawal && refund?.failed) toast.error(t('billing.refundFailed'));
      else if (withdrawal) toast.success(t('billing.refundRequested'));
      else if (subscription.paidUntil) toast.success(t('billing.canceledUntil', { date: formatDay(subscription.paidUntil, locale) }));
      else toast.success(t('billing.canceled'));
      overview.reload();
    },
  });

  if (!overview.data) return <Loading small />;
  const { current, payments, openInvoiceUrl, withdrawal, exempt } = overview.data;
  const live = current && current.status !== 'canceled';

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
            {current.paidUntil && (
              <>
                <dt className="col-sm-3">{current.status === 'canceled' ? t('billing.accessUntil') : t('billing.paidUntil')}</dt>
                <dd className="col-sm-9">{formatDay(current.paidUntil, locale)}</dd>
              </>
            )}
            {live && current.nextDueDate && (
              <>
                <dt className="col-sm-3">{t('billing.nextInvoice')}</dt>
                <dd className="col-sm-9">{formatDay(current.nextDueDate, locale)}</dd>
              </>
            )}
          </>
        )}
      </dl>
      {exempt && <div className="alert alert-secondary">{t('billing.adminNote')}</div>}
      {current?.status === 'overdue' && <div className="alert alert-warning">{t('billing.overdueNote')}</div>}

      <div className="d-flex flex-wrap gap-2 mb-4">
        {openInvoiceUrl && (
          <a href={openInvoiceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent fw-bold">
            <i className="bi bi-receipt me-1" aria-hidden="true" />{t('billing.payInvoice')}
          </a>
        )}
        {live && (
          <button type="button" className="btn btn-outline-primary" disabled={refresh.busy} onClick={() => refresh.submit()}>
            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />{t('billing.checkPayment')}
          </button>
        )}
        {!exempt && (
          <Link to="/plans" className="btn btn-primary">{user.plan === 'free' ? t('billing.seePlans') : t('billing.changePlan')}</Link>
        )}
        {live && (
          <button type="button" className="btn btn-outline-danger" onClick={() => setConfirming(true)}>{t('billing.cancel')}</button>
        )}
      </div>

      {payments.length > 0 && (
        <>
          <h2 className="h5">{t('billing.history')}</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>{t('billing.dueDate')}</th><th>{t('profile.plan')}</th><th className="text-end">{t('billing.amount')}</th>
                  <th>{t('billing.situation')}</th><th><span className="visually-hidden">{t('billing.invoice')}</span></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDay(p.dueDate, locale)}</td>
                    <td>{t(`plans.${p.plan}`)}</td>
                    <td className="text-end">{formatMoney(p.amount, locale)}</td>
                    <td><PaymentBadge status={p.status} /></td>
                    <td>
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">{t('billing.invoice')}</a>
                      )}
                    </td>
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
            {current.status === 'pending'
              ? t('billing.cancelOpen')
              : withdrawal
                ? t('billing.cancelWithdrawal', { amount: formatMoney(current.amount, locale) })
                : t('billing.cancelWarning', { plan: t(`plans.${current.plan}`), date: formatDay(current.paidUntil, locale) })}
          </p>
        </Modal>
      )}
    </>
  );
}
