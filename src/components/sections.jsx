// Peças comuns às seções com sub-navegação (Ontologias, BPM, CommonKADS)
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router';
import { fileApi } from '../api/endpoints.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatDate, useSubmit } from '../lib/hooks.js';
import { FieldGrid, toFormValues, toPayload } from './forms.jsx';
import { useToast } from './Toasts.jsx';
import { sameValues, SaveButton, saveShortcut, useUnsavedChanges } from './unsaved.jsx';

// Metadados do arquivo anexado (iguais aos da API: shared/files.js)
export const FILE_FIELDS = ['fileName', 'fileMime', 'fileSize', 'fileSha256', 'fileUploadedAt'];
export const withoutFile = (record, extra = {}) => ({ ...record, ...Object.fromEntries(FILE_FIELDS.map((f) => [f, null])), ...extra });

export const lines = (text) => String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export function formatBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Layout de seção: desenha a sub-navegação em pílulas.
 * @param {string} section   chave da seção (ex.: 'bpm')
 * @param {string} base      caminho da seção no app (ex.: /projects/:id/bpm)
 * @param {Array}  items     [[subcaminho, rótulo já traduzido, ícone]]
 */
export function SectionLayout({ section, base, items = [], actions }) {
  const { t } = useI18n();
  const context = useOutletContext();
  return (
    <>
      {(items.length > 0 || actions) && (
        <nav aria-label={t(`sections.${section}.name`)} className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4 kt-no-print">
          <ul className="nav nav-pills kt-subnav">
            {items.map(([path, label, icon]) => (
              <li className="nav-item" key={path || 'index'}>
                <NavLink to={path ? `${base}/${path}` : base} end={!path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <i className={`bi bi-${icon} me-1`} aria-hidden="true" />{label}
                </NavLink>
              </li>
            ))}
          </ul>
          {actions}
        </nav>
      )}
      <Outlet context={context} />
    </>
  );
}

export function StatCards({ items }) {
  return (
    <div className="row g-3 mb-4">
      {items.map(([label, value, icon]) => (
        <div className="col-6 col-md-4 col-xl" key={label}>
          <div className="card kt-stat h-100">
            <div className="card-body py-2">
              {icon && <i className={`bi bi-${icon} text-primary`} aria-hidden="true" />}
              <div className="kt-stat-value">{value}</div>
              <div className="small text-body-secondary">{label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Formulário de edição de um registro (PATCH com todos os campos do formulário)
export function EditForm({ fields, initial, onSave, onSaved, transform = (p) => p, id }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState(() => toFormValues(fields, initial));
  const [localErrors, setLocalErrors] = useState({});
  const { submit, busy, errors } = useSubmit(onSave, {
    onSuccess: (saved) => {
      toast.success(t('common.saved'));
      onSaved?.(saved);
    },
  });
  const onSubmit = (e) => {
    e.preventDefault();
    try {
      setLocalErrors({});
      submit(transform(toPayload(fields, values, t)));
    } catch (err) {
      if (err.field) setLocalErrors({ [err.field]: err.message });
    }
  };
  const dirty = !sameValues(values, toFormValues(fields, initial));
  useUnsavedChanges(dirty);
  return (
    <form id={id} noValidate onSubmit={onSubmit} onKeyDown={saveShortcut}>
      <FieldGrid fields={fields} values={values} errors={{ ...errors, ...localErrors }}
        onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      <SaveButton busy={busy} dirty={dirty} />
    </form>
  );
}

const PREVIEWABLE = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/**
 * Arquivo anexado a um registro: enviar (escolher ou arrastar), baixar, remover e pré-visualizar imagens.
 * @param {string}   itemPath  caminho do registro na API (sem /file)
 * @param {object}   record    registro com fileName, fileSize, fileUploadedAt, fileMime
 * @param {string}   accept    extensões aceitas (".owl,.rdf")
 * @param {Function} onChange  (registroAtualizado | null, análise) => void
 */
export function FileCard({ itemPath, record, accept, onChange, help }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const files = fileApi(itemPath);
  const canPreview = PREVIEWABLE.includes(record.fileMime);

  // imagens: a pré-visualização vem da API (com o token), como object URL
  useEffect(() => {
    if (!canPreview || !record.fileSha256) return undefined;
    let url;
    let cancelled = false;
    fileApi(itemPath).download().then(
      (blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      },
      () => setPreview(null),
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [itemPath, canPreview, record.fileSha256]);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      // a resposta é o registro atualizado + `analysis` (na ontologia, é também a coluna gravada)
      const updated = await files.upload(file);
      toast.success(t('files.uploaded'));
      onChange(updated, updated.analysis);
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const download = async () => {
    try {
      saveBlob(await files.download(), record.fileName);
    } catch (err) {
      toast.fromError(err);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('common.confirmDelete', { name: record.fileName }))) return;
    try {
      await files.remove();
      toast.success(t('common.deleted'));
      setPreview(null);
      onChange(null, null);
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <section className="card mb-4" aria-labelledby={`${inputId}-title`}>
      <div className="card-header"><h3 className="h4 mb-0" id={`${inputId}-title`}>{t('files.title')}</h3></div>
      <div className="card-body">
        {record.fileName ? (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
              <strong>{record.fileName}</strong>
              <div className="small text-body-secondary">
                {formatBytes(record.fileSize)} · {t('files.sentAt')} {formatDate(record.fileUploadedAt, locale)}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={download}>
                <i className="bi bi-download me-1" aria-hidden="true" />{t('files.download')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={remove}>
                <i className="bi bi-trash me-1" aria-hidden="true" />{t('files.remove')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-body-secondary">{t('files.none')}</p>
        )}
        {canPreview && preview && (
          <div className="kt-file-preview mb-3">
            <img src={preview} alt={record.fileName} />
          </div>
        )}
        <div
          className={`kt-file-drop ${over ? 'is-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
        >
          <i className="bi bi-cloud-arrow-up fs-3 text-primary d-block" aria-hidden="true" />
          <label htmlFor={inputId} className="form-label mb-2">
            {busy ? t('files.sending') : t(record.fileName ? 'files.replace' : 'files.drop')}
          </label>
          <input ref={inputRef} id={inputId} type="file" className="form-control form-control-sm mx-auto" style={{ maxWidth: 360 }}
            accept={accept} disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          <div className="form-text">{help ?? t('files.limit', { types: accept.replaceAll(',', ' ') })}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Lista editável de linhas (ex.: itens de informação e mensagens do CM-2).
 * columns: [{ name, label, type?: 'text' | 'select', options?, required?, width? }]
 */
export function RowsEditor({ caption, columns, rows, onChange, addLabel, empty }) {
  const { t } = useI18n();
  const blank = () => Object.fromEntries(columns.map((c) => [c.name, c.type === 'select' ? (c.options[0]?.value ?? '') : '']));
  const set = (i, name, value) => onChange(rows.map((r, j) => (j === i ? { ...r, [name]: value } : r)));
  const move = (i, d) => {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="mb-3">
      <div className="table-responsive">
        <table className="table table-sm align-middle kt-sheet mb-2">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="kt-sheet-n">Nº</th>
              {columns.map((c) => <th scope="col" key={c.name} style={{ width: c.width }}>{c.label}{c.required && ' *'}</th>)}
              <th scope="col"><span className="visually-hidden">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2} className="text-body-secondary small">{empty ?? t('common.empty')}</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="kt-sheet-n">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.name}>
                    {c.type === 'select' ? (
                      <select className="form-select form-select-sm" value={row[c.name] ?? ''} aria-label={`${c.label} ${i + 1}`}
                        onChange={(e) => set(i, c.name, e.target.value)}>
                        {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input className="form-control form-control-sm" value={row[c.name] ?? ''} aria-label={`${c.label} ${i + 1}`}
                        maxLength={c.maxLength} onChange={(e) => set(i, c.name, e.target.value)} />
                    )}
                  </td>
                ))}
                <td className="text-nowrap text-end">
                  <button type="button" className="btn btn-sm btn-link px-1" disabled={i === 0} onClick={() => move(i, -1)}
                    aria-label={`${t('common.moveUp')} ${i + 1}`}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
                  <button type="button" className="btn btn-sm btn-link px-1" disabled={i === rows.length - 1} onClick={() => move(i, 1)}
                    aria-label={`${t('common.moveDown')} ${i + 1}`}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
                  <button type="button" className="btn btn-sm btn-link px-1 text-danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label={`${t('common.delete')} ${i + 1}`}><i className="bi bi-x-lg" aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onChange([...rows, blank()])}>
        <i className="bi bi-plus-lg me-1" aria-hidden="true" />{addLabel}
      </button>
    </div>
  );
}

// Lista de registros relacionados (ex.: "Usado em: T1, T3"), com links opcionais
export function RefList({ items, to }) {
  if (!items?.length) return <span className="text-body-secondary">—</span>;
  return items.map((item, i) => (
    <span key={item.id}>
      {i > 0 && ', '}
      {to ? <NavLink to={to(item)}>{item.label}</NavLink> : item.label}
    </span>
  ));
}
