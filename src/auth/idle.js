// Sessão por inatividade: sem interação com o app por 7 minutos, a sessão é encerrada; aos 6 minutos o
// usuário é avisado. A hora da última interação fica no localStorage, então vale para todas as abas
// (mexer numa aba mantém as outras abertas) e sobrevive a fechar o navegador: quem volta depois do
// prazo não tem a sessão restaurada.

export const IDLE_LIMIT_MS = 7 * 60 * 1000;
export const IDLE_WARNING_MS = 6 * 60 * 1000;
export const ACTIVITY_KEY = 'kt.lastActivity';

let memory = 0; // cópia em memória, para quando o localStorage não estiver disponível

export function markActivity(now = Date.now()) {
  memory = now;
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    // sem armazenamento: vale a cópia em memória (só esta aba)
  }
}

// Hora da última interação (a mais recente entre esta aba e as outras); 0 se nunca registrada
export function lastActivity() {
  try {
    const stored = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return memory; // sem armazenamento
  }
}

export function clearActivity() {
  memory = 0;
  try {
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // nada a limpar
  }
}

// Tempo sem interação; null se nada foi registrado ainda
export function idleFor(now = Date.now()) {
  const last = lastActivity();
  return last ? Math.max(0, now - last) : null;
}

export const idleExpired = (now = Date.now()) => (idleFor(now) ?? 0) >= IDLE_LIMIT_MS;
