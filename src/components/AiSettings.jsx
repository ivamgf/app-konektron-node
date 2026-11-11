// Perfil › IA: conectar a conta de IA do usuário. A chave fica só neste navegador e vai direto ao provedor.
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  connectOpenRouter, finishOpenRouter, generate, newConfig, PROVIDER_KEYS, PROVIDERS, readAiConfig, saveAiConfig,
} from '../lib/ai.js';
import { errorText } from './AiAssist.jsx';

export default function AiSettings() {
  const { t } = useI18n();
  const id = useId();
  const [config, setConfig] = useState(() => readAiConfig() ?? newConfig());
  const [saved, setSaved] = useState(() => Boolean(readAiConfig()));
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const handledCode = useRef(false);
  const provider = PROVIDERS[config.provider];

  // volta do OpenRouter com ?code=...
  useEffect(() => {
    const code = params.get('code');
    if (!code || handledCode.current) return;
    handledCode.current = true;
    finishOpenRouter(code)
      .then((key) => {
        const next = { ...newConfig('openrouter'), key };
        saveAiConfig(next);
        setConfig(next);
        setSaved(true);
        setMessage(t('ai.settings.openrouterConnected'));
      })
      .catch((e) => setError(errorText(t, e)))
      .finally(() => navigate('/profile?tab=ai', { replace: true }));
  }, [params, navigate, t]);

  const change = (partial) => {
    setConfig((c) => ({ ...c, ...partial }));
    setSaved(false);
    setMessage(null);
  };
  const save = (e) => {
    e.preventDefault();
    saveAiConfig(config);
    setSaved(true);
    setError(null);
    setMessage(t(config.remember ? 'ai.settings.savedBrowser' : 'ai.settings.savedSession'));
  };
  const test = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const answer = await generate(config, { system: 'Responda só com a palavra OK.', message: 'Teste de conexão.' });
      setMessage(t('ai.settings.testOk', { provider: provider.name, answer: answer.trim().slice(0, 40) }));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setTesting(false);
    }
  };
  const disconnect = () => {
    saveAiConfig(null);
    setConfig(newConfig(config.provider));
    setSaved(false);
    setMessage(t('ai.settings.removed'));
  };

  return (
    <form onSubmit={save} noValidate aria-labelledby={`${id}-title`}>
      <h2 className="h4" id={`${id}-title`}><i className="bi bi-stars me-1" aria-hidden="true" />{t('ai.settings.title')}</h2>
      <p className="text-body-secondary">{t('ai.settings.intro')}</p>
      <div aria-live="polite">
        {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
        {message && <div className="alert alert-success py-2 small" role="status">{message}</div>}
      </div>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor={`${id}-provider`} className="form-label fw-semibold">{t('ai.settings.provider')}</label>
          <select id={`${id}-provider`} className="form-select" value={config.provider} aria-describedby={`${id}-provider-help`}
            onChange={(e) => {
              setConfig({ ...newConfig(e.target.value), remember: config.remember });
              setSaved(false);
            }}>
            {PROVIDER_KEYS.map((k) => <option key={k} value={k}>{PROVIDERS[k].name}</option>)}
          </select>
          <div className="form-text" id={`${id}-provider-help`}>
            {t(`ai.settings.help.${config.provider}`)}{' '}
            {provider.keyUrl && (
              <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer">
                {t('ai.settings.createKey')}<span className="visually-hidden"> ({t('nav.newTab')})</span>
              </a>
            )}
          </div>
          {config.provider === 'openrouter' && (
            <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={() => connectOpenRouter()}>
              <i className="bi bi-link-45deg me-1" aria-hidden="true" />{t('ai.settings.connectOpenRouter')}
            </button>
          )}
        </div>
        <div className="col-md-6 mb-3">
          {config.provider === 'ollama' ? (
            <>
              <label htmlFor={`${id}-url`} className="form-label fw-semibold">{t('ai.settings.url')}</label>
              <input id={`${id}-url`} className="form-control font-monospace" value={config.url ?? ''} type="url"
                onChange={(e) => change({ url: e.target.value })} />
            </>
          ) : (
            <>
              <label htmlFor={`${id}-key`} className="form-label fw-semibold">{t('ai.settings.key')}</label>
              <input id={`${id}-key`} type="password" autoComplete="off" spellCheck={false} className="form-control font-monospace"
                aria-describedby={`${id}-provider-help`} value={config.key} onChange={(e) => change({ key: e.target.value.trim() })} />
            </>
          )}
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor={`${id}-model`} className="form-label fw-semibold">{t('ai.settings.model')}</label>
          <input id={`${id}-model`} className="form-control font-monospace" list={`${id}-models`} aria-describedby={`${id}-model-help`}
            value={config.model} onChange={(e) => change({ model: e.target.value.trim() })} />
          <datalist id={`${id}-models`}>{provider.models.map((m) => <option key={m} value={m} />)}</datalist>
          <div className="form-text" id={`${id}-model-help`}>{t('ai.settings.modelHelp')}</div>
        </div>
        <div className="col-md-6 mb-3 d-flex align-items-md-end">
          <div className="form-check">
            <input id={`${id}-remember`} type="checkbox" className="form-check-input" checked={config.remember}
              onChange={(e) => change({ remember: e.target.checked })} />
            <label htmlFor={`${id}-remember`} className="form-check-label">{t('ai.settings.remember')}</label>
          </div>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={saved}>{t('common.save')}</button>
        <button type="button" className="btn btn-outline-secondary" onClick={test} disabled={testing} aria-busy={testing}>
          {testing && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
          {t('ai.settings.test')}
        </button>
        {readAiConfig() && (
          <button type="button" className="btn btn-outline-danger" onClick={disconnect}>{t('ai.settings.disconnect')}</button>
        )}
      </div>
      <p className="small text-body-secondary mt-3 mb-0">{t('ai.settings.privacy')}</p>
    </form>
  );
}
