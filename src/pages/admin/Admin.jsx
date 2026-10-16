import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { adminApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { ContentCard, EmptyState, Loading, Modal, Pagination } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';

const ROLES = ['client', 'admin', 'provider'];
const PLANS = ['free', 'standard', 'master'];
const PAGE_SIZE = 20;

export function AdminLayout() {
  const { t } = useI18n();
  const tabs = [['', 'summary', 'speedometer2'], ['users', 'users', 'people'], ['messages', 'messages', 'envelope'], ['logs', 'logs', 'journal-text']];
  return (
    <div className="container-xl px-3 mt-3">
      <ContentCard icon="shield-lock" as="h1" title={t('admin.title')}>
        <ul className="nav nav-underline kt-tabs mb-4">
          {tabs.map(([path, key, icon]) => (
            <li className="nav-item" key={key}>
              <NavLink to={`/admin/${path}`} end={!path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <i className={`bi bi-${icon} me-1`} aria-hidden="true" />{t(`admin.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
        <Outlet />
      </ContentCard>
    </div>
  );
}

export function AdminSummary() {
  const { t, locale } = useI18n();
  const data = useAsync(() => adminApi.summary(), []);
  if (data.loading && !data.data) return <Loading small />;
  if (!data.data) return null;
  const s = data.data;
  const logins = s.loginsLast30Days.reduce((sum, d) => sum + d.total, 0);
  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="card kt-stat h-100"><div className="card-body">
            <i className="bi bi-people" aria-hidden="true" />
            <div className="kt-stat-value">{s.totalUsers}</div><div className="text-body-secondary">{t('admin.totalUsers')}</div>
          </div></div>
        </div>
        <div className="col-sm-4">
          <div className="card kt-stat h-100"><div className="card-body">
            <i className="bi bi-folder2-open" aria-hidden="true" />
            <div className="kt-stat-value">{s.projectsByType.reduce((n, p) => n + p.total, 0)}</div>
            <div className="text-body-secondary">{t('nav.projects')}</div>
          </div></div>
        </div>
        <div className="col-sm-4">
          <div className="card kt-stat h-100"><div className="card-body">
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <div className="kt-stat-value">{logins}</div><div className="text-body-secondary">{t('admin.loginsLast30Days')}</div>
          </div></div>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-md-6 d-flex flex-column gap-4">
          <section className="kt-count-panel" style={{ '--acc': '#019bcd' }}>
            <h2 className="h3">{t('admin.usersByPlan')}</h2>
            <table className="table table-sm">
              <tbody>
                {s.usersByPlan.map((r) => (
                  <tr key={r.plan}><td>{t(`plans.${r.plan}`)}</td><td className="text-end fw-semibold">{r.total}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="kt-count-panel" style={{ '--acc': '#fe7d05' }}>
            <h2 className="h3">{t('admin.projectsByType')}</h2>
            <table className="table table-sm">
              <tbody>
                {s.projectsByType.map((r) => (
                  <tr key={r.type}><td>{t(`project.types.${r.type}`)}</td><td className="text-end fw-semibold">{r.total}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div className="col-md-6">
          <section className="kt-count-panel" style={{ '--acc': '#11866a' }}>
            <h2 className="h3">{t('admin.loginsLast30Days')}</h2>
            {s.loginsLast30Days.length === 0 ? <EmptyState>{t('common.empty')}</EmptyState> : (
              <table className="table table-sm">
                <thead><tr><th>{t('admin.day')}</th><th className="text-end">{t('admin.total')}</th></tr></thead>
                <tbody>
                  {[...s.loginsLast30Days].reverse().map((d) => (
                    <tr key={d.day}><td>{formatDate(String(d.day).slice(0, 10), locale)}</td><td className="text-end">{d.total}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// Acesso à administração: papel Administrador com plano Master (igual à API: isMasterAdmin)
const hasAdminAccess = (u) => u.role === 'admin' && u.plan === 'master';

// RF5.1: o administrador muda o perfil (papel e plano) dos usuários; todo cadastro novo começa Free
function EditUserModal({ user, isSelf, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState({ role: user.role, plan: user.plan, isActive: user.isActive });
  const { submit, busy } = useSubmit((body) => adminApi.updateUser(user.id, body), {
    onSuccess: () => {
      toast.success(t('common.saved'));
      onSaved();
      onClose();
    },
  });
  const onSubmit = (e) => {
    e.preventDefault();
    // RN5.1: o administrador não muda o próprio perfil nem se desativa (perderia o acesso)
    if (!isSelf) submit(values);
  };
  const admin = hasAdminAccess(values);
  return (
    <Modal
      title={`${t('admin.editUser')}: ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-edit-user" className="btn btn-primary" disabled={busy || isSelf}>{t('common.save')}</button>
        </>
      }
    >
      <form id="kt-edit-user" onSubmit={onSubmit}>
        {isSelf && <p className="alert alert-info small py-2">{t('admin.selfNote')}</p>}
        <label className="form-label fw-semibold" htmlFor="u-role">{t('admin.role')}</label>
        <select id="u-role" className="form-select mb-3" value={values.role} disabled={isSelf}
          onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}>
          {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <label className="form-label fw-semibold" htmlFor="u-plan">{t('profile.plan')}</label>
        <select id="u-plan" className="form-select mb-1" value={values.plan} disabled={isSelf}
          aria-describedby="u-plan-help" onChange={(e) => setValues((v) => ({ ...v, plan: e.target.value }))}>
          {PLANS.map((p) => <option key={p} value={p}>{t(`plans.${p}`)}</option>)}
        </select>
        <div className="form-text mb-3" id="u-plan-help">{t('admin.planHelp')}</div>
        <p className={`small mb-3 ${admin ? 'text-success' : 'text-body-secondary'}`} role="status">
          <i className={`bi ${admin ? 'bi-shield-check' : 'bi-shield-x'} me-1`} aria-hidden="true" />
          {admin ? t('admin.accessYes') : t('admin.accessNo')}
        </p>
        <div className="form-check form-switch">
          <input id="u-active" type="checkbox" className="form-check-input" role="switch" checked={values.isActive} disabled={isSelf}
            onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} />
          <label className="form-check-label" htmlFor="u-active">{t('admin.active')}</label>
        </div>
      </form>
    </Modal>
  );
}

export function AdminUsers() {
  const { t, locale } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', role: '', plan: '' });
  const [applied, setApplied] = useState(filters);
  const [editing, setEditing] = useState(null);
  const users = useAsync(
    () => adminApi.users({ page, pageSize: PAGE_SIZE, search: applied.search || undefined, role: applied.role || undefined, plan: applied.plan || undefined }),
    [page, applied],
  );

  const remove = async (u) => {
    if (!window.confirm(t('common.confirmDelete', { name: u.email }))) return;
    try {
      await adminApi.removeUser(u.id);
      toast.success(t('common.deleted'));
      users.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <>
      <form className="row g-2 align-items-end mb-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }}>
        <div className="col-md-5">
          <label className="form-label small mb-1" htmlFor="u-search">{t('admin.searchEmail')}</label>
          <input id="u-search" type="search" className="form-control form-control-sm" value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small mb-1" htmlFor="u-frole">{t('admin.role')}</label>
          <select id="u-frole" className="form-select form-select-sm" value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
            <option value="">{t('common.all')}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small mb-1" htmlFor="u-fplan">{t('profile.plan')}</label>
          <select id="u-fplan" className="form-select form-select-sm" value={filters.plan}
            onChange={(e) => setFilters((f) => ({ ...f, plan: e.target.value }))}>
            <option value="">{t('common.all')}</option>
            {PLANS.map((p) => <option key={p} value={p}>{t(`plans.${p}`)}</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <button type="submit" className="btn btn-primary btn-sm w-100"><i className="bi bi-search me-1" aria-hidden="true" />{t('common.search')}</button>
        </div>
      </form>

      {users.loading && !users.data ? <Loading small /> : !users.data?.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>{t('auth.email')}</th><th>{t('admin.role')}</th><th>{t('profile.plan')}</th>
                  <th>{t('admin.active')}</th><th>{t('admin.lastLogin')}</th>
                  <th className="kt-table-actions"><span className="visually-hidden">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((u) => {
                  const isSelf = u.id === me.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.email} {!u.emailVerifiedAt && <span className="badge text-bg-warning ms-1">{t('auth.notVerified')}</span>}</td>
                      <td>
                        {t(`roles.${u.role}`)}
                        {hasAdminAccess(u) && <span className="badge text-bg-primary ms-1" title={t('admin.accessYes')}>{t('admin.title')}</span>}
                      </td>
                      <td>{t(`plans.${u.plan}`)}</td>
                      <td>{u.isActive ? <i className="bi bi-check-lg text-success" aria-label={t('common.yes')} /> : <i className="bi bi-x-lg text-danger" aria-label={t('common.no')} />}</td>
                      <td>{formatDate(u.lastLoginAt, locale)}</td>
                      <td className="kt-table-actions">
                        <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setEditing(u)}
                          aria-label={`${t('common.edit')} ${u.email}`}><i className="bi bi-pencil" aria-hidden="true" /></button>
                        {!isSelf && (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(u)}
                            aria-label={`${t('common.delete')} ${u.email}`}><i className="bi bi-trash" aria-hidden="true" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={users.data.total} onChange={setPage} />
        </>
      )}
      {editing && <EditUserModal user={editing} isSelf={editing.id === me.id} onClose={() => setEditing(null)} onSaved={users.reload} />}
    </>
  );
}

export function AdminLogs() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const logs = useAsync(
    () => adminApi.logs({
      page, pageSize: PAGE_SIZE, action: applied.action || undefined,
      from: applied.from ? new Date(`${applied.from}T00:00:00`).toISOString() : undefined,
      to: applied.to ? new Date(`${applied.to}T23:59:59`).toISOString() : undefined,
    }),
    [page, applied],
  );
  return (
    <>
      <form className="row g-2 align-items-end mb-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }}>
        <div className="col-md-4">
          <label className="form-label small mb-1" htmlFor="l-action">{t('admin.action')}</label>
          <input id="l-action" className="form-control form-control-sm" placeholder="auth.login" value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1" htmlFor="l-from">{t('admin.from')}</label>
          <input id="l-from" type="date" className="form-control form-control-sm" value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small mb-1" htmlFor="l-to">{t('admin.to')}</label>
          <input id="l-to" type="date" className="form-control form-control-sm" value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary btn-sm w-100">{t('common.filter')}</button>
        </div>
      </form>
      {logs.loading && !logs.data ? <Loading small /> : !logs.data?.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : (
        <>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>{t('admin.when')}</th><th>{t('admin.action')}</th><th>{t('admin.user')}</th><th>{t('admin.ip')}</th><th>{t('common.details')}</th></tr></thead>
              <tbody>
                {logs.data.data.map((l) => (
                  <tr key={l.id}>
                    <td className="text-nowrap">{formatDate(l.createdAt, locale)}</td>
                    <td><code>{l.action}</code></td>
                    <td>{l.email ?? '—'}</td>
                    <td>{l.ip ?? '—'}</td>
                    <td className="small text-break">{l.description ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={logs.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

// Mensagens do formulário de contato
const MESSAGE_STATUS = ['new', 'read', 'answered', 'archived'];
const MESSAGE_BADGE = { new: 'text-bg-accent', read: 'text-bg-primary', answered: 'text-bg-success', archived: 'text-bg-secondary' };

// Resposta enviada pela plataforma: a API manda o e-mail ao remetente e só marca como respondida se der certo
function ReplyForm({ message, onSent }) {
  const { t } = useI18n();
  const toast = useToast();
  const [text, setText] = useState('');
  const { submit, busy } = useSubmit((body) => adminApi.replyMessage(message.id, body), {
    onSuccess: () => {
      toast.success(t('admin.replySent', { email: message.email }));
      setText('');
      onSent();
    },
  });
  const id = `reply-${message.id}`;
  return (
    <form className="mb-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) submit(text); }}>
      <label className="form-label small fw-semibold" htmlFor={id}>{t('admin.replyTo', { email: message.email })}</label>
      <textarea id={id} className="form-control mb-2" rows={4} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !text.trim()}>
        <i className="bi bi-send me-1" aria-hidden="true" />{busy ? t('contacts.sending') : t('admin.reply')}
      </button>
    </form>
  );
}

export function AdminMessages() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const data = useAsync(() => adminApi.messages({ page, pageSize: PAGE_SIZE, status: status || undefined }), [page, status]);

  const update = async (m, next) => {
    try {
      await adminApi.updateMessage(m.id, { status: next });
      data.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };
  // abrir uma mensagem nova a marca como lida
  const toggle = (m) => {
    setOpenId(openId === m.id ? null : m.id);
    if (openId !== m.id && m.status === 'new') update(m, 'read');
  };
  const remove = async (m) => {
    if (!window.confirm(t('common.confirmDelete', { name: m.subject }))) return;
    try {
      await adminApi.removeMessage(m.id);
      toast.success(t('common.deleted'));
      data.reload();
    } catch (err) {
      toast.fromError(err);
    }
  };

  const by = data.data?.byStatus ?? {};
  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label={t('common.filter')}>
        {['', ...MESSAGE_STATUS].map((st) => (
          <button key={st || 'all'} type="button" aria-pressed={status === st}
            className={`btn btn-sm ${status === st ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => { setStatus(st); setPage(1); }}>
            {st ? t(`enums.contactStatus.${st}`) : t('common.all')}
            {st && by[st] ? <span className="badge text-bg-light ms-1">{by[st]}</span> : null}
          </button>
        ))}
      </div>
      {data.loading && !data.data ? <Loading small /> : !data.data?.data.length ? (
        <EmptyState>{t('admin.noMessages')}</EmptyState>
      ) : (
        <>
          <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
            {data.data.data.map((m) => (
              <li key={m.id} className={`kt-message is-${m.status}`}>
                <button type="button" className="kt-message-head" aria-expanded={openId === m.id} onClick={() => toggle(m)}>
                  <span className={`badge ${MESSAGE_BADGE[m.status]}`}>{t(`enums.contactStatus.${m.status}`)}</span>
                  <strong className="text-truncate">{m.subject}</strong>
                  <span className="small text-body-secondary text-truncate">{m.name} &lt;{m.email}&gt;</span>
                  <span className="small text-body-secondary ms-auto text-nowrap">{formatDate(m.createdAt, locale)}</span>
                  <i className={`bi bi-chevron-${openId === m.id ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
                {openId === m.id && (
                  <div className="kt-message-body">
                    <p className="kt-prewrap">{m.message}</p>
                    {m.reply && (
                      <div className="border-start border-3 border-success ps-3 mb-3">
                        <p className="small text-body-secondary mb-1">
                          <i className="bi bi-reply me-1" aria-hidden="true" />{t('admin.repliedAt', { date: formatDate(m.repliedAt, locale) })}
                        </p>
                        <p className="kt-prewrap mb-0">{m.reply}</p>
                      </div>
                    )}
                    <ReplyForm message={m} onSent={data.reload} />
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <label className="small text-body-secondary" htmlFor={`st-${m.id}`}>{t('admin.markAs')}</label>
                      <select id={`st-${m.id}`} className="form-select form-select-sm w-auto" value={m.status}
                        onChange={(e) => update(m, e.target.value)}>
                        {MESSAGE_STATUS.map((st) => <option key={st} value={st}>{t(`enums.contactStatus.${st}`)}</option>)}
                      </select>
                      <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => remove(m)}>
                        <i className="bi bi-trash me-1" aria-hidden="true" />{t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
