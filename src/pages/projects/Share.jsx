// Compartilhamento do projeto: o dono convida contas pelo e-mail com acesso ao projeto inteiro ou só ao
// Kanban. Cada participante só usa as seções do próprio plano que também estão no plano do dono.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { projectsApi } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { useAsync, useSubmit } from '../../lib/hooks.js';
import { PLAN_SECTIONS } from '../public/PublicPages.jsx';

// Seções do plano do dono que o plano do participante não inclui (ele não as vê no projeto)
export const blockedFor = (ownerPlan, memberPlan) =>
  (PLAN_SECTIONS[ownerPlan] ?? []).filter((s) => !(PLAN_SECTIONS[memberPlan] ?? []).includes(s));

export const ACCESS_OPTIONS = ['project', 'kanban'];

function AccessSelect({ id, value, onChange, disabled }) {
  const { t } = useI18n();
  return (
    <select id={id} className="form-select form-select-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {ACCESS_OPTIONS.map((a) => <option key={a} value={a}>{t(`share.access.${a}`)}</option>)}
    </select>
  );
}

export function ShareModal({ project, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const manager = project.access === 'owner' || project.access === 'admin';
  const members = useAsync(() => projectsApi.members(project.id), [project.id]);
  const [form, setForm] = useState({ email: '', access: 'project' });
  const [busyId, setBusyId] = useState(null);

  const invite = useSubmit((body) => projectsApi.addMember(project.id, body), {
    onSuccess: (m) => {
      toast.success(t('share.invited', { email: m.email }));
      setForm({ email: '', access: form.access });
      members.reload();
    },
  });

  const run = async (id, action, message) => {
    setBusyId(id);
    try {
      await action();
      if (message) toast.success(message);
      members.reload();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusyId(null);
    }
  };

  const leave = (m) =>
    run(m.id, async () => {
      if (!window.confirm(t('share.confirmLeave', { name: project.name }))) return;
      await projectsApi.removeMember(project.id, m.id);
      toast.success(t('share.left'));
      onClose();
      navigate('/projects');
    });

  const data = members.data;
  return (
    <Modal title={t('share.title')} onClose={onClose} size="modal-lg"
      footer={<button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.close')}</button>}>
      <p className="small text-body-secondary">{t('share.lead')}</p>
      {manager && (
        <form className="row g-2 align-items-end mb-4" noValidate
          onSubmit={(e) => { e.preventDefault(); invite.submit(form); }}>
          <div className="col-sm-6">
            <label className="form-label small mb-1" htmlFor="kt-share-email">{t('share.email')}</label>
            <input id="kt-share-email" type="email" className={`form-control form-control-sm ${invite.errors.email ? 'is-invalid' : ''}`}
              autoComplete="off" value={form.email} required aria-required="true"
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            {invite.errors.email && <div className="invalid-feedback">{invite.errors.email}</div>}
          </div>
          <div className="col-sm-3">
            <label className="form-label small mb-1" htmlFor="kt-share-access">{t('share.accessLabel')}</label>
            <AccessSelect id="kt-share-access" value={form.access} onChange={(access) => setForm((f) => ({ ...f, access }))} />
          </div>
          <div className="col-sm-3 d-grid">
            <button type="submit" className="btn btn-sm btn-primary" disabled={invite.busy || !form.email.trim()}>
              <i className="bi bi-person-plus me-1" aria-hidden="true" />{t('share.invite')}
            </button>
          </div>
          <div className="col-12 form-text">{t('share.planNote')}</div>
        </form>
      )}

      {!data ? (
        <Loading small />
      ) : (
        <ul className="list-group">
          <li className="list-group-item d-flex flex-wrap align-items-center gap-2">
            <i className="bi bi-person-badge" aria-hidden="true" />
            <span className="flex-grow-1">{data.owner?.fullName || data.owner?.email}{data.owner?.fullName && <span className="text-body-secondary small ms-1">{data.owner.email}</span>}</span>
            <span className="badge text-bg-primary">{t('share.owner')}</span>
            <span className="badge text-bg-light">{t(`plans.${data.owner?.plan}`)}</span>
          </li>
          {data.data.map((m) => {
            const self = m.userId === user?.id;
            const blocked = m.access === 'kanban' ? [] : blockedFor(data.owner?.plan, m.plan);
            return (
              <li key={m.id} className="list-group-item">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <i className="bi bi-person" aria-hidden="true" />
                  <span className="flex-grow-1 text-break">{m.fullName || m.email}{m.fullName && <span className="text-body-secondary small ms-1">{m.email}</span>}</span>
                  <span className="badge text-bg-light">{t(`plans.${m.plan}`)}</span>
                  {manager ? (
                    <>
                      <div style={{ minWidth: 170 }}>
                        <label className="visually-hidden" htmlFor={`kt-acc-${m.id}`}>{t('share.accessFor', { email: m.email })}</label>
                        <AccessSelect id={`kt-acc-${m.id}`} value={m.access} disabled={busyId === m.id}
                          onChange={(access) => run(m.id, () => projectsApi.updateMember(project.id, m.id, access), t('common.saved'))} />
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === m.id}
                        aria-label={t('share.remove', { email: m.email })} title={t('share.remove', { email: m.email })}
                        onClick={() => window.confirm(t('share.confirmRemove', { email: m.email })) &&
                          run(m.id, () => projectsApi.removeMember(project.id, m.id), t('share.removed'))}>
                        <i className="bi bi-person-dash" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <span className="badge text-bg-secondary">{t(`share.access.${m.access}`)}</span>
                  )}
                  {self && !manager && (
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === m.id} onClick={() => leave(m)}>
                      <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />{t('share.leave')}
                    </button>
                  )}
                </div>
                {blocked.length > 0 && (
                  <div className="small text-body-secondary mt-1">
                    <i className="bi bi-lock me-1" aria-hidden="true" />
                    {t('share.blocked', { sections: blocked.map((k) => t(`sections.${k}.name`)).join(', ') })}
                  </div>
                )}
              </li>
            );
          })}
          {data.data.length === 0 && <li className="list-group-item text-body-secondary small">{t('share.empty')}</li>}
        </ul>
      )}
    </Modal>
  );
}
