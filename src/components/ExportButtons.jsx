// Botões de exportação de relatório: imprimir, PDF, DOCX (Word) e CSV (planilha).
import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { exportReport } from '../lib/exportReport.js';
import { useToast } from './Toasts.jsx';

const ICONS = { pdf: 'filetype-pdf', docx: 'filetype-docx', csv: 'filetype-csv' };

/**
 * @param {React.RefObject} targetRef  elemento do relatório a exportar
 * @param {string} title       título do arquivo e da primeira página
 * @param {string} [subtitle]  linha abaixo do título (projeto, versão, data)
 * @param {string} [fileName]  nome do arquivo (sem extensão); padrão: o título
 */
export default function ExportButtons({ targetRef, title, subtitle, fileName, print = true, className = '' }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const run = async (format) => {
    if (!targetRef.current) return;
    setBusy(format);
    try {
      const name = await exportReport(format, targetRef.current, {
        title,
        subtitle,
        fileName,
        locale,
        yes: t('common.yes'),
        no: t('common.no'),
        fieldHeader: [t('export.field'), t('export.value')],
      });
      toast.success(t('export.done', { name }));
    } catch (err) {
      console.error(err);
      toast.error(t('export.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`d-flex flex-wrap gap-2 kt-no-print ${className}`} role="group" aria-label={t('export.group')}>
      {print && (
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" aria-hidden="true" />{t('common.print')}
        </button>
      )}
      {['pdf', 'docx', 'csv'].map((format) => (
        <button key={format} type="button" className="btn btn-outline-primary" disabled={Boolean(busy)} aria-busy={busy === format}
          title={t(`export.${format}Title`)} onClick={() => run(format)}>
          {busy === format
            ? <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            : <i className={`bi bi-${ICONS[format]} me-1`} aria-hidden="true" />}
          {t(`export.${format}`)}
          <span className="visually-hidden"> — {t(`export.${format}Title`)}</span>
        </button>
      ))}
    </div>
  );
}
