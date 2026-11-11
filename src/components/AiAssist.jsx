// Assistente de IA dos campos de texto: gera, melhora, resume ou traduz o conteúdo do campo com a conta
// de IA do próprio usuário (caminho 2) ou copiando o pedido para um assistente na web (caminho 1).
// O texto gerado aparece editável e só entra no campo quando o usuário aplica.
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { projectsApi } from '../api/endpoints.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  ACTIONS, AI_EVENT, AI_STORAGE_KEY, AiError, ASSISTANTS, cleanAnswer, fieldPrompt, generate, isConfigured, openAssistant,
  promptForAssistant, PROVIDERS, readAiConfig,
} from '../lib/ai.js';
import { Modal } from './ui.jsx';

// Contexto do projeto para os pedidos: { projectId, describe: () => string }. Sem ele, não há botão de IA.
const AiContext = createContext(null);
export const AiContextProvider = AiContext.Provider;
export const useAiContext = () => useContext(AiContext);

// Configuração de IA deste navegador (atualiza quando muda no Perfil ou em outra aba)
export function useAiConfig() {
  const [config, setConfig] = useState(readAiConfig);
  useEffect(() => {
    const update = () => setConfig(readAiConfig());
    const onStorage = (e) => (e.key === null || e.key === AI_STORAGE_KEY) && update();
    window.addEventListener(AI_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AI_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return isConfigured(config) ? config : null;
}

// Registra na auditoria do projeto que um texto foi gerado com IA (sem o conteúdo nem a chave)
function logUsage(projectId, feature, config) {
  if (!projectId) return;
  projectsApi
    .aiUsage(projectId, {
      feature: feature.slice(0, 120),
      mode: config ? 'api' : 'assistant',
      provider: config?.provider ?? null,
      model: config?.model ?? null,
    })
    .catch(() => {
      /* a auditoria nunca impede o uso */
    });
}

export const errorText = (t, e) =>
  e instanceof AiError ? `${t(`ai.errors.${e.code}`)}${e.detail ? ` (${e.detail})` : ''}` : (e?.message ?? String(e));

/**
 * Botão "IA" ao lado do rótulo de um campo de texto.
 * @param {string}   label     rótulo do campo (já traduzido)
 * @param {string}  [help]     orientação do campo (já traduzida)
 * @param {string}   value     texto atual
 * @param {Function} onApply   (texto) => void
 * @param {number}  [maxLength]
 */
export function AiButton({ label, help, value = '', onApply, maxLength }) {
  const ctx = useAiContext();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  if (!ctx) return null;
  return (
    <>
      <button type="button" className="btn btn-outline-primary btn-sm py-0 kt-ai-button" onClick={() => setOpen(true)}
        aria-label={t('ai.buttonLabel', { field: label })} title={t('ai.buttonTitle')} aria-haspopup="dialog">
        <i className="bi bi-stars me-1" aria-hidden="true" />{t('ai.button')}
      </button>
      {open && (
        <AiDialog ctx={ctx} label={label} help={help} value={value} maxLength={maxLength} onClose={() => setOpen(false)}
          onApply={(text) => {
            onApply(maxLength ? text.slice(0, maxLength) : text);
            setOpen(false);
          }} />
      )}
    </>
  );
}

function AiDialog({ ctx, label, help, value, maxLength, onClose, onApply }) {
  const { t, locale } = useI18n();
  const config = useAiConfig();
  const id = useId();
  const hasText = Boolean(value.trim());
  const [action, setAction] = useState(hasText ? 'improve' : 'generate');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [assistant, setAssistant] = useState('chatgpt');
  const [notice, setNotice] = useState('');
  const [context] = useState(() => ctx.describe?.() ?? '');
  const prompt = fieldPrompt({ field: label, help, context, current: value, action, extra, locale, maxLength });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(cleanAnswer(await generate(config, prompt)));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  // com a conta conectada, o texto já é gerado ao abrir: um clique no botão "IA" basta
  const started = useRef(false);
  useEffect(() => {
    if (!config || started.current) return;
    started.current = true;
    run();
    // só ao abrir; mudar a ação ou o pedido adicional pede "Gerar novamente"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openWeb = async () => {
    const copied = await openAssistant(assistant, promptForAssistant(prompt));
    setNotice(t(copied ? 'ai.copied' : 'ai.copyFailed'));
  };
  const apply = (mode) => {
    const text = result.trim();
    if (!text) return;
    logUsage(ctx.projectId, `${t(`ai.actions.${action}`)}: ${label}`, config);
    onApply(mode === 'append' && hasText ? `${value.trim()}\n\n${text}` : text);
  };

  return (
    <Modal title={`${t('ai.title')} · ${label}`} onClose={onClose} size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          {hasText && (
            <button type="button" className="btn btn-outline-primary" disabled={!result.trim()} onClick={() => apply('append')}>
              {t('ai.append')}
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={!result.trim()} onClick={() => apply('replace')}>
            {t(hasText ? 'ai.replace' : 'ai.use')}
          </button>
        </>
      }>
      <div className="row g-2 mb-3">
        <div className="col-sm-5">
          <label htmlFor={`${id}-action`} className="form-label small fw-semibold mb-1">{t('ai.action')}</label>
          <select id={`${id}-action`} className="form-select" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.filter((a) => a === 'generate' || hasText).map((a) => (
              <option key={a} value={a}>{t(`ai.actions.${a}`)}</option>
            ))}
          </select>
        </div>
        <div className="col-sm-7">
          <label htmlFor={`${id}-extra`} className="form-label small fw-semibold mb-1">{t('ai.extra')}</label>
          <input id={`${id}-extra`} className="form-control" value={extra} maxLength={1000} placeholder={t('ai.extraPlaceholder')}
            onChange={(e) => setExtra(e.target.value)} />
        </div>
      </div>

      <div className="border rounded p-3 mb-3 bg-body-tertiary">
        {config ? (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy} aria-describedby={`${id}-via`}>
              {busy
                ? <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                : <i className="bi bi-stars me-1" aria-hidden="true" />}
              {t(busy ? 'ai.generating' : result ? 'ai.regenerate' : 'ai.generateWithAccount')}
            </button>
            <span id={`${id}-via`} className="small text-body-secondary">
              {PROVIDERS[config.provider].name} · <span className="font-monospace">{config.model}</span>
            </span>
          </div>
        ) : (
          // sem chave: o único caminho é copiar o pedido para um assistente na web
          <>
            <p className="small mb-2">
              {t('ai.noAccount')} <Link to="/profile?tab=ai">{t('ai.connectInProfile')}</Link>
            </p>
            <div className="d-flex flex-wrap align-items-end gap-2">
              <div>
                <label htmlFor={`${id}-assistant`} className="form-label small mb-1">{t('ai.assistant')}</label>
                <select id={`${id}-assistant`} className="form-select form-select-sm" value={assistant} onChange={(e) => setAssistant(e.target.value)}>
                  {ASSISTANTS.map((a) => <option key={a.id} value={a.id}>{a.name ?? t('ai.copyOnly')}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={openWeb}>
                <i className={`bi ${assistant === 'copy' ? 'bi-clipboard' : 'bi-box-arrow-up-right'} me-1`} aria-hidden="true" />
                {t(assistant === 'copy' ? 'ai.copyPrompt' : 'ai.copyAndOpen')}
                {assistant !== 'copy' && <span className="visually-hidden"> ({t('nav.newTab')})</span>}
              </button>
            </div>
          </>
        )}
        <div className="small text-success mt-2" role="status" aria-live="polite">{notice}</div>
        <details className="small mt-1">
          <summary>{t('ai.showPrompt')}</summary>
          <pre className="small border rounded p-2 mt-2 mb-0 bg-body kt-ai-prompt">{promptForAssistant(prompt)}</pre>
        </details>
      </div>

      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
      <label htmlFor={`${id}-result`} className="form-label fw-semibold">{t('ai.result')}</label>
      <textarea id={`${id}-result`} className="form-control" rows={8} value={result} aria-describedby={`${id}-warning`}
        placeholder={t('ai.resultPlaceholder')} onChange={(e) => setResult(e.target.value)} aria-busy={busy} />
      <div id={`${id}-warning`} className="form-text">
        <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{t('ai.warning')}
        {maxLength ? ` ${t('ai.limit', { count: maxLength })}` : ''}
      </div>
    </Modal>
  );
}
