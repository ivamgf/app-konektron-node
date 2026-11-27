// Encerra a sessão após 7 minutos sem interação (clique, tecla, toque, roda ou movimento do mouse em
// qualquer aba do app). Aos 6 minutos mostra um aviso com a contagem regressiva; qualquer interação antes
// dos 7 minutos zera o contador e fecha o aviso. Montado pelo Layout só com o usuário logado.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ACTIVITY_KEY, IDLE_LIMIT_MS, IDLE_WARNING_MS, idleFor, lastActivity, markActivity } from '../auth/idle.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from './Toasts.jsx';
import { Modal } from './ui.jsx';
import { leaveWithoutAsking } from './unsaved.jsx';

// sem "scroll": o próprio layout pode rolar a página; a rolagem do usuário vem de roda, tecla, toque ou ponteiro
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
const CHECK_EVERY_MS = 1000;
const MINUTES = IDLE_LIMIT_MS / 60000;

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function IdleLogout() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const toast = useToast();
  const [remaining, setRemaining] = useState(null); // ms até encerrar, enquanto o aviso está aberto
  const ending = useRef(false);

  const end = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    setRemaining(null);
    leaveWithoutAsking(); // o login substitui a página mesmo com alterações não salvas
    await logout({ idle: true });
    toast.error(t('auth.idle.signedOut', { minutes: MINUTES }));
  }, [logout, toast, t]);

  const check = useCallback(() => {
    if (ending.current) return;
    const idle = idleFor() ?? 0;
    if (idle >= IDLE_LIMIT_MS) end();
    else setRemaining(idle >= IDLE_WARNING_MS ? IDLE_LIMIT_MS - idle : null);
  }, [end]);

  useEffect(() => {
    if (!lastActivity()) markActivity();
    let lastMark = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastMark < CHECK_EVERY_MS || ending.current) return; // mouse e rolagem disparam muito
      lastMark = now;
      markActivity(now);
      check();
    };
    const onStorage = (e) => e.key === ACTIVITY_KEY && check(); // interação noutra aba
    const options = { capture: true, passive: true };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, options));
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity, options));
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, [check]);

  if (remaining == null) return null;
  const stay = () => {
    markActivity();
    setRemaining(null);
  };
  return (
    <Modal
      title={t('auth.idle.title')}
      onClose={stay}
      footer={<button type="button" className="btn btn-primary" onClick={stay}>{t('auth.idle.stay')}</button>}
    >
      <p className="mb-2">
        <i className="bi bi-hourglass-split me-2 text-warning" aria-hidden="true" />
        {t('auth.idle.text', { minutes: MINUTES, time: clock(remaining) })}
      </p>
      <p className="small text-body-secondary mb-0">{t('auth.idle.unsaved')}</p>
    </Modal>
  );
}
