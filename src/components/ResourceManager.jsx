// CRUD guiado por configuração para os recursos que seguem o crudRouter da API
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { resourceApi } from '../api/endpoints.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useAsync, useSubmit } from '../lib/hooks.js';
import { FieldGrid, toFormValues, toPayload } from './forms.jsx';
import { useToast } from './Toasts.jsx';
import { EmptyState, Loading, Modal } from './ui.jsx';

/**
 * @param {object} p
 * @param {string} p.path         caminho base do recurso na API (ex.: /addresses)
 * @param {Array}  p.fields       campos do formulário (forms.jsx)
 * @param {Array}  p.columns      [{ key, label, render?(row) }]
 * @param {Array} [p.filters]     [{ name, label, options }] → query do GET
 * @param {Function} [p.rowLink]  (row) => caminho do detalhe
 * @param {Function} [p.nameOf]   (row) => texto para a confirmação de exclusão
 * @param {string} p.singular     chave i18n do nome do recurso
 * @param {Function} [p.transform] ajusta o corpo antes de enviar (ex.: texto -> número)
 * @param {Function} [p.onChange] chamado após criar/editar/excluir
 * @param {Function} [p.afterCreate] (registro) => void, ex.: abrir o detalhe para enviar o arquivo
 */
export default function ResourceManager({
  path,
  fields,
  columns,
  filters = [],
  rowLink,
  nameOf = (row) => row.code ?? row.name ?? row.title ?? row.metric ?? '',
  singular,
  transform = (payload) => payload,
  onChange,
  afterCreate,
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState({});
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [values, setValues] = useState({});
  const [localErrors, setLocalErrors] = useState({});
  const api = useMemo(() => resourceApi(path), [path]);
  const list = useAsync(() => api.list(query), [path, query]);

  const open = (row) => {
    setEditing(row);
    setLocalErrors({});
    setValues(toFormValues(fields, row === 'new' ? {} : row));
  };
  const close = () => setEditing(null);

  const save = useSubmit(
    (payload) => (editing === 'new' ? api.create(payload) : api.update(editing.id, payload)),
    {
      onSuccess: async (saved) => {
        const created = editing === 'new';
        toast.success(t('common.saved'));
        close();
        if (created && afterCreate) return afterCreate(saved);
        await list.reload();
        onChange?.();
      },
    },
  );

  const onSubmit = (e) => {
    e.preventDefault();
    try {
      setLocalErrors({});
      save.submit(transform(toPayload(fields, values, t)));
    } catch (err) {
      if (err.field) setLocalErrors({ [err.field]: err.message });
    }
  };

  const remove = async (row) => {
    if (!window.confirm(t('common.confirmDelete', { name: nameOf(row) }))) return;
    try {
      await api.remove(row.id);
      toast.success(t('common.deleted'));
      await list.reload();
      onChange?.();
    } catch (err) {
      toast.fromError(err);
    }
  };

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const errors = { ...save.errors, ...localErrors };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div className="d-flex flex-wrap gap-3">
          {filters.map((f) => (
            <div key={f.name}>
              <label className="form-label small mb-1" htmlFor={`flt-${f.name}`}>{t(f.label)}</label>
              <select
                id={`flt-${f.name}`}
                className="form-select form-select-sm"
                value={query[f.name] ?? ''}
                onChange={(e) => setQuery((q) => ({ ...q, [f.name]: e.target.value || undefined }))}
              >
                <option value="">{t('common.all')}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open('new')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          {t('common.new')}
        </button>
      </div>

      {list.loading && !list.data ? (
        <Loading small />
      ) : rows.length === 0 ? (
        <EmptyState>{t('common.empty')}</EmptyState>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col">{t(c.label)}</th>
                ))}
                <th scope="col" className="kt-table-actions"><span className="visually-hidden">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c, i) => {
                    const content = c.render ? c.render(row) : (row[c.key] ?? '—');
                    return (
                      <td key={c.key}>
                        {i === 0 && rowLink ? <Link to={rowLink(row)} className="fw-semibold">{content}</Link> : content}
                      </td>
                    );
                  })}
                  <td className="kt-table-actions">
                    <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => open(row)}
                      aria-label={`${t('common.edit')} ${nameOf(row)}`}>
                      <i className="bi bi-pencil" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(row)}
                      aria-label={`${t('common.delete')} ${nameOf(row)}`}>
                      <i className="bi bi-trash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={`${editing === 'new' ? t('common.new') : t('common.edit')}: ${t(singular)}`}
          onClose={close}
          size="modal-lg"
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={close}>{t('common.cancel')}</button>
              <button type="submit" form="kt-resource-form" className="btn btn-primary" disabled={save.busy}>
                {save.busy ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <form id="kt-resource-form" onSubmit={onSubmit} noValidate>
            <FieldGrid fields={fields} values={values} errors={errors}
              onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
          </form>
        </Modal>
      )}
    </div>
  );
}
