import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client.js';
import { useToast } from '../components/Toasts.jsx';
import { Modal } from '../components/ui.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { GOOGLE_CLIENT_ID } from '../lib/config.js';
import { useAuth } from './AuthProvider.jsx';

// Login com Google (UC002 A1) pelo Google Identity Services: o botão oficial devolve um ID token
// (credential) que a API confere em POST /auth/google. Sem GOOGLE_CLIENT_ID, nada aparece.
const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise;

function loadGsi() {
  if (globalThis.google?.accounts?.id) return Promise.resolve(globalThis.google);
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve(globalThis.google);
    script.onerror = () => {
      gsiPromise = undefined; // permite tentar de novo
      reject(new Error('gsi'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

// E-mail do ID token, só para exibir no aceite dos termos (quem confere a assinatura é a API)
function emailFromCredential(credential) {
  try {
    const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).email ?? '';
  } catch {
    return '';
  }
}

// context: 'signin' | 'signup'. acceptTerms: a caixa de termos do cadastro já marcada.
export default function GoogleSignIn({ context = 'signin', acceptTerms = false }) {
  const { t, locale } = useI18n();
  const { loginWithGoogle } = useAuth();
  const toast = useToast();
  const buttonRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(null); // credencial aguardando o aceite dos termos
  const [termsChecked, setTermsChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const signIn = async (credential, terms) => {
    setBusy(true);
    try {
      const { created } = await loginWithGoogle({
        credential,
        ...(terms && { acceptTerms: true }),
      });
      setPending(null);
      if (created) toast.success(t('auth.googleCreated'));
    } catch (error) {
      // Conta nova: a API pede o aceite dos Termos de Uso antes de criá-la
      if (error instanceof ApiError && error.status === 422 && error.details?.acceptTerms) {
        setTermsChecked(false);
        setPending(credential);
        return;
      }
      setPending(null);
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  };

  // O Google registra o callback uma vez; ele lê sempre a versão atual de signIn e dos termos
  const onCredential = useRef(null);
  useEffect(() => {
    onCredential.current = (credential) => signIn(credential, acceptTerms);
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGsi()
      .then((google) => {
        const node = buttonRef.current;
        if (cancelled || !node) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => onCredential.current(credential),
          ux_mode: 'popup',
          context,
        });
        google.accounts.id.renderButton(node, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          // no cadastro, "Continuar com o Google" (a tradução de signup_with soa estranha em português)
          text: context === 'signup' ? 'continue_with' : 'signin_with',
          logo_alignment: 'left',
          width: Math.min(400, node.offsetWidth || 400),
          locale,
        });
      })
      .catch(() => !cancelled && setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, [context, locale]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div
        className="d-flex align-items-center gap-2 text-body-secondary small mb-3"
        aria-hidden="true"
      >
        <hr className="flex-grow-1 my-0" />
        {t('auth.or')}
        <hr className="flex-grow-1 my-0" />
      </div>
      <div
        ref={buttonRef}
        className="d-flex justify-content-center"
        style={{ minHeight: 44 }}
        aria-busy={busy}
      />
      {unavailable && (
        <p className="small text-danger text-center mt-2 mb-0">{t('auth.googleUnavailable')}</p>
      )}

      {pending && (
        <Modal
          title={t('auth.googleTermsTitle')}
          onClose={() => setPending(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setPending(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!termsChecked || busy}
                onClick={() => signIn(pending, true)}
              >
                {busy ? t('common.loading') : t('auth.googleCreate')}
              </button>
            </>
          }
        >
          <p>{t('auth.googleTermsText', { email: emailFromCredential(pending) || '—' })}</p>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="google-accept-terms"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="google-accept-terms">
              {t('auth.acceptTerms', { terms: '' })}
              <Link to="/terms" target="_blank" rel="noopener">
                {t('auth.termsLink')}
              </Link>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
