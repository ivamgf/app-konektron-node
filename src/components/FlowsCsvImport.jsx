// Diagnóstico de dados › Relatório › "5. Mapeamento dos fluxos de dados": botões "Importar CSV" (lê o
// arquivo no navegador, mostra a prévia e põe as linhas na tabela da seção) e "Baixar modelo CSV".
// Nada vai à API aqui: a tabela fica com alterações não salvas até o documento ser salvo.
import { useId, useState } from 'react';
import { DD_ENUMS } from '../content/dataDiagnosis.js';
import { downloadCsv } from '../lib/csv.js';
import { csvToFlows, FLOW_FIELDS, FLOW_OPTIONS, FLOWS_MAX, flowsTemplateCsv } from '../lib/flowsCsv.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from './Toasts.jsx';
import { Modal } from './ui.jsx';

const PREVIEW_ROWS = 10;
const fill = (text, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), text);

function ImportModal({ d, rows, onImport, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const id = useId();
  const x = d.report.flowImport;
  const f = d.report.fields;
  const [file, setFile] = useState(null); // { name, flows, lines, columns, ignored, warnings }
  const [mode, setMode] = useState('append');
  const existing = rows.length;
  const replacing = existing > 0 && mode === 'replace';

  const read = async (picked) => {
    setFile(null);
    if (!picked) return;
    try {
      setFile({ name: picked.name, ...csvToFlows(await picked.text()) });
    } catch {
      toast.error(x.readError);
    }
  };

  const count = file?.flows.length ?? 0;
  const total = (replacing ? 0 : existing) + count;
  const problem = !file ? null
    : file.columns.length === 0 ? x.noColumns
    : count === 0 ? x.empty
    : total > FLOWS_MAX ? fill(x.tooMany, { max: FLOWS_MAX, total })
    : null;

  const submit = () => {
    onImport(replacing ? file.flows : [...rows, ...file.flows]);
    toast.success(fill(x.done, { count }));
    onClose();
  };

  const optionLabel = (field, value) => (FLOW_OPTIONS[field] && value ? d.options[FLOW_OPTIONS[field]][value] : value);
  const warningText = (w) =>
    fill(x[w.kind], { line: w.line, field: f[w.field], value: w.value ?? '', max: w.max ?? '' });

  return (
    <Modal
      title={x.title}
      onClose={onClose}
      size="modal-xl"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!file || !!problem} onClick={submit}>
            <i className="bi bi-upload me-1" aria-hidden="true" />{fill(x.submit, { count })}
          </button>
        </>
      }
    >
      <p className="mb-2">{x.intro}</p>
      <p className="small text-body-secondary mb-1">{fill(x.help, { columns: FLOW_FIELDS.map((k) => f[k]).join(', ') })}</p>
      <p className="small text-body-secondary">
        {fill(x.values, {
          method: f.method,
          methods: DD_ENUMS.flowMethods.map((k) => d.options.flowMethods[k]).join(', '),
          monitored: f.monitored,
          yesNo: DD_ENUMS.yesNo.map((k) => d.options.yesNo[k]).join(', '),
        })}
      </p>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div className="flex-grow-1">
          <label className="form-label" htmlFor={`${id}-file`}>{x.file}</label>
          <input id={`${id}-file`} type="file" className="form-control" accept=".csv,.txt,text/csv"
            onChange={(e) => read(e.target.files?.[0])} />
        </div>
        <TemplateButton d={d} />
      </div>

      {existing > 0 && (
        <fieldset className="mb-3">
          <legend className="fs-6 fw-semibold">{fill(x.mode, { count: existing })}</legend>
          {['append', 'replace'].map((m) => (
            <div className="form-check form-check-inline" key={m}>
              <input className="form-check-input" type="radio" name={`${id}-mode`} id={`${id}-${m}`} value={m}
                checked={mode === m} onChange={() => setMode(m)} />
              <label className="form-check-label" htmlFor={`${id}-${m}`}>{x[m]}</label>
            </div>
          ))}
        </fieldset>
      )}

      {file && (
        <div role="status" aria-live="polite">
          {problem ? (
            <div className="alert alert-warning">{problem}</div>
          ) : (
            <p className="fw-semibold">{fill(x.found, { count, file: file.name })}</p>
          )}
          {file.ignored.length > 0 && <p className="small text-body-secondary">{fill(x.ignored, { columns: file.ignored.join(', ') })}</p>}
          {file.warnings.length > 0 && (
            <div className="alert alert-info small">
              <p className="mb-1 fw-semibold">{x.warnings}</p>
              <ul className="mb-0">
                {file.warnings.slice(0, 20).map((w) => <li key={`${w.line}-${w.field}`}>{warningText(w)}</li>)}
                {file.warnings.length > 20 && <li>…</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {file && !problem && (
        <>
          <h3 className="h5">{fill(x.preview, { count: Math.min(PREVIEW_ROWS, count) })}</h3>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">{x.line}</th>
                  {file.columns.map((k) => <th scope="col" key={k}>{f[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {file.flows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={file.lines[i]}>
                    <td className="text-body-secondary">{file.lines[i]}</td>
                    {file.columns.map((k) => <td key={k}>{optionLabel(k, row[k]) || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function TemplateButton({ d }) {
  const { locale } = useI18n();
  return (
    <button type="button" className="btn btn-outline-secondary btn-sm"
      onClick={() => downloadCsv(flowsTemplateCsv(locale), d.report.flowImport.templateFile)}>
      <i className="bi bi-download me-1" aria-hidden="true" />{d.report.flowImport.template}
    </button>
  );
}

export default function FlowsCsvImport({ d, rows = [], onImport }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="d-flex flex-wrap gap-2 kt-no-print" data-export="skip">
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <i className="bi bi-filetype-csv me-1" aria-hidden="true" />{d.report.flowImport.button}
      </button>
      <TemplateButton d={d} />
      {open && <ImportModal d={d} rows={rows} onImport={onImport} onClose={() => setOpen(false)} />}
    </div>
  );
}
