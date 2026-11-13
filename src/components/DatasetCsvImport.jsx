// Importa uma lista de datasets (CRISP-DM) de um arquivo CSV: lê no navegador, mostra a prévia e envia
// tudo de uma vez para a API (tudo ou nada; nomes que já existem são pulados)
import { useId, useState } from 'react';
import { ApiError } from '../api/client.js';
import { crispdmApi } from '../api/endpoints.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { csvToDatasets, DATASET_FIELDS, toCsv } from '../lib/csv.js';
import { useToast } from './Toasts.jsx';
import { Modal } from './ui.jsx';

export const DATASET_IMPORT_MAX = 1000; // igual à API (crispdm.schemas.js)
const PREVIEW_ROWS = 10;

// Rótulos das colunas (os mesmos dos formulários); o leitor aceita estes nomes nos três idiomas
export const DATASET_LABELS = {
  name: 'dm.datasetName', source: 'dm.source', format: 'dm.format', location: 'dm.location',
  rowCount: 'dm.rowCount', columnCount: 'dm.columnCount', sizeBytes: 'dm.sizeBytes',
  collectedAt: 'dm.collectedAt', description: 'project.description', qualityNotes: 'dm.qualityNotes',
};

function downloadTemplate(t) {
  const csv = toCsv([
    DATASET_FIELDS.map((f) => t(DATASET_LABELS[f])),
    ['clientes_2025', 'CRM', 'csv', 's3://dados/clientes.csv', '48000', '12', '5242880', '31/01/2026', 'Cadastro de clientes ativos', 'Sem e-mails duplicados'],
    ['vendas_2025', 'ERP', 'parquet', 's3://dados/vendas', '1200000', '25', '', '2026-02-28', '', ''],
  ]);
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'datasets.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ImportModal({ projectId, onClose, onImported }) {
  const { t } = useI18n();
  const toast = useToast();
  const inputId = useId();
  const [file, setFile] = useState(null); // { name, datasets, lines, columns, ignored, missingName }
  const [rowErrors, setRowErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const read = async (f) => {
    setRowErrors([]);
    setFile(null);
    if (!f) return;
    try {
      setFile({ name: f.name, ...csvToDatasets(await f.text()) });
    } catch {
      toast.error(t('dm.import.readError'));
    }
  };

  const count = file?.datasets.length ?? 0;
  const problem = !file ? null
    : file.missingName ? t('dm.import.missingName')
    : count === 0 ? t('dm.import.empty')
    : count > DATASET_IMPORT_MAX ? t('dm.import.tooMany', { max: DATASET_IMPORT_MAX })
    : null;

  const submit = async () => {
    setBusy(true);
    setRowErrors([]);
    try {
      const r = await crispdmApi.importDatasets(projectId, file.datasets);
      toast.success(t('dm.import.done', { created: r.created }));
      if (r.skipped.length) toast.success(t('dm.import.skipped', { n: r.skipped.length, names: r.skipped.join(', ') }));
      await onImported(r);
      onClose();
    } catch (err) {
      // erros por linha: mostra a linha do arquivo (o cabeçalho é a linha 1)
      if (err instanceof ApiError && err.status === 422 && err.details?.rows) {
        setRowErrors(err.details.rows.map(({ row, errors }) => ({
          line: file.lines[row - 1] ?? row,
          messages: Object.entries(errors).map(([field, msgs]) =>
            `${DATASET_LABELS[field] ? t(DATASET_LABELS[field]) : field}: ${[].concat(msgs)[0]}`),
        })));
      }
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  };

  const shown = file?.columns ?? [];
  return (
    <Modal
      title={t('dm.import.title')}
      onClose={onClose}
      size="modal-xl"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || !file || !!problem} onClick={submit}>
            <i className="bi bi-upload me-1" aria-hidden="true" />
            {busy ? t('dm.import.importing') : t('dm.import.submit', { n: count })}
          </button>
        </>
      }
    >
      <p className="mb-2">{t('dm.import.intro')}</p>
      <p className="small text-body-secondary">
        {t('dm.import.help', { columns: DATASET_FIELDS.map((f) => t(DATASET_LABELS[f])).join(', ') })}
      </p>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div className="flex-grow-1">
          <label className="form-label" htmlFor={inputId}>{t('dm.import.file')}</label>
          <input id={inputId} type="file" className="form-control" accept=".csv,.txt,text/csv"
            onChange={(e) => read(e.target.files?.[0])} />
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={() => downloadTemplate(t)}>
          <i className="bi bi-download me-1" aria-hidden="true" />{t('dm.import.template')}
        </button>
      </div>

      {file && (
        <div role="status" aria-live="polite">
          {problem ? (
            <div className="alert alert-warning">{problem}</div>
          ) : (
            <p className="fw-semibold">{t('dm.import.found', { n: count, file: file.name })}</p>
          )}
          {file.ignored.length > 0 && (
            <p className="small text-body-secondary">{t('dm.import.ignored', { columns: file.ignored.join(', ') })}</p>
          )}
        </div>
      )}

      {rowErrors.length > 0 && (
        <div className="alert alert-danger" role="alert">
          <p className="mb-1 fw-semibold">{t('dm.import.rowErrors')}</p>
          <ul className="mb-0">
            {rowErrors.map((r) => (
              <li key={r.line}>{t('dm.import.line', { line: r.line })} — {r.messages.join('; ')}</li>
            ))}
          </ul>
        </div>
      )}

      {file && !problem && (
        <>
          <h3 className="h5">{t('dm.import.preview', { n: Math.min(PREVIEW_ROWS, count) })}</h3>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {shown.map((f) => <th scope="col" key={f}>{t(DATASET_LABELS[f])}</th>)}
                </tr>
              </thead>
              <tbody>
                {file.datasets.slice(0, PREVIEW_ROWS).map((d, i) => (
                  <tr key={file.lines[i]}>
                    <td className="text-body-secondary">{file.lines[i]}</td>
                    {shown.map((f) => <td key={f}>{d[f] ?? '—'}</td>)}
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

export default function DatasetCsvImport({ projectId, onImported }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-outline-primary" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <i className="bi bi-filetype-csv me-1" aria-hidden="true" />{t('dm.import.button')}
      </button>
      {open && <ImportModal projectId={projectId} onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}
