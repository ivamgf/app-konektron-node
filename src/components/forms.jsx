// Campos de formulário guiados por configuração (usados pelo ResourceManager e telas de edição)
import { useId } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

/**
 * Campo: { name, label, type, options, required, help, maxLength, rows, min, max, step, col }
 * type: text | textarea | number | integer | select | multicheck | date | checkbox | url | json | code
 * options: [{ value, label }] já traduzidas (ver enumOptions)
 */
export const enumOptions = (t, enumName, values) =>
  values.map((value) => ({ value, label: t(`enums.${enumName}.${value}`) }));

// Valor vindo da API -> valor do formulário (string, exceto checkbox)
export function toFormValues(fields, record = {}) {
  return Object.fromEntries(
    fields.map((f) => {
      const v = record[f.name];
      if (f.type === 'checkbox') return [f.name, Boolean(v)];
      if (f.type === 'multicheck') return [f.name, Array.isArray(v) ? v : []];
      if (f.type === 'json') return [f.name, v == null ? '' : JSON.stringify(v, null, 2)];
      return [f.name, v == null ? (f.default ?? '') : String(v)];
    }),
  );
}

// Valor do formulário -> corpo da requisição. Lança { field, message } em JSON inválido.
export function toPayload(fields, values, t) {
  const out = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const raw = values[f.name];
    if (f.type === 'checkbox') {
      out[f.name] = Boolean(raw);
      continue;
    }
    if (f.type === 'multicheck') {
      out[f.name] = raw ?? [];
      continue;
    }
    const empty = raw === '' || raw == null;
    if (empty) {
      // obrigatório vazio: a API devolve o erro do campo; opcional vazio: null apaga
      out[f.name] = f.required ? undefined : null;
      continue;
    }
    if (f.type === 'number' || f.type === 'integer') out[f.name] = Number(raw);
    else if (f.type === 'json') {
      try {
        out[f.name] = JSON.parse(raw);
      } catch {
        throw { field: f.name, message: t('dm.jsonInvalid') };
      }
    } else out[f.name] = raw;
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

export function FieldInput({ field, value, onChange, error }) {
  const { t } = useI18n();
  const id = useId();
  const errorId = `${id}-err`;
  const helpId = `${id}-help`;
  const describedBy = [error && errorId, field.help && helpId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: field.name,
    required: field.required,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
  };
  const set = (e) => onChange(field.name, field.type === 'checkbox' ? e.target.checked : e.target.value);
  const cls = `${error ? 'is-invalid' : ''}`;

  let control;
  switch (field.type) {
    case 'textarea':
    case 'code':
    case 'json':
      control = (
        <textarea
          {...common}
          className={`form-control ${field.type !== 'textarea' ? 'font-monospace' : ''} ${cls}`}
          rows={field.rows ?? (field.type === 'textarea' ? 3 : 6)}
          maxLength={field.maxLength}
          value={value}
          onChange={set}
          spellCheck={field.type === 'textarea'}
        />
      );
      break;
    case 'select':
      control = (
        <select {...common} className={`form-select ${cls}`} value={value} onChange={set}>
          {!field.required && <option value="">{t('common.none')}</option>}
          {field.required && value === '' && <option value="" disabled>…</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'multicheck': {
      const chosen = new Set(value);
      return (
        <fieldset className={`mb-3 ${field.col ?? 'col-12'}`} aria-describedby={describedBy}>
          <legend className="form-label fw-semibold fs-6 mb-1">{t(field.label)}</legend>
          {field.options.length === 0 ? (
            <p className="small text-body-secondary mb-0">{t(field.emptyText ?? 'common.empty')}</p>
          ) : (
            <div className="kt-multicheck">
              {field.options.map((o) => (
                <div className="form-check" key={o.value}>
                  <input className="form-check-input" type="checkbox" id={`${id}-${o.value}`} checked={chosen.has(o.value)}
                    onChange={(e) => onChange(field.name, e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
                  <label className="form-check-label" htmlFor={`${id}-${o.value}`}>{o.label}</label>
                </div>
              ))}
            </div>
          )}
          {field.help && <div className="form-text" id={helpId}>{t(field.help)}</div>}
          {error && <div className="invalid-feedback d-block" id={errorId}>{error}</div>}
        </fieldset>
      );
    }
    case 'checkbox':
      return (
        <div className={`form-check mb-3 ${field.col ?? 'col-12'}`}>
          <input {...common} type="checkbox" className={`form-check-input ${cls}`} checked={value} onChange={set} />
          <label className="form-check-label" htmlFor={id}>
            {t(field.label)}
          </label>
          {error && <div className="invalid-feedback d-block" id={errorId}>{error}</div>}
        </div>
      );
    default:
      control = (
        <input
          {...common}
          type={{ integer: 'number', number: 'number', date: 'date', url: 'url' }[field.type] ?? 'text'}
          className={`form-control ${cls}`}
          maxLength={field.maxLength}
          min={field.min}
          max={field.max}
          step={field.step ?? (field.type === 'integer' ? 1 : field.type === 'number' ? 'any' : undefined)}
          value={value}
          onChange={set}
        />
      );
  }

  return (
    <div className={`mb-3 ${field.col ?? 'col-12'}`}>
      <label className="form-label fw-semibold" htmlFor={id}>
        {t(field.label)}
        {field.required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      {control}
      {field.help && <div className="form-text" id={helpId}>{t(field.help)}</div>}
      {error && <div className="invalid-feedback d-block" id={errorId}>{error}</div>}
    </div>
  );
}

export function FieldGrid({ fields, values, onChange, errors = {} }) {
  return (
    <div className="row">
      {fields.map((f) => (
        <FieldInput key={f.name} field={f} value={values[f.name]} onChange={onChange} error={errors[f.name]} />
      ))}
    </div>
  );
}
