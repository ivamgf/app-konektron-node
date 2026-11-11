import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Accessibility from '../components/Accessibility.jsx';
import { AiButton, AiContextProvider } from '../components/AiAssist.jsx';
import { Modal } from '../components/ui.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { applyPrefs, DEFAULTS, nextFontSize, nextZoom, readPrefs, savePrefs, STORAGE_KEY } from '../lib/a11y.js';
import { AI_STORAGE_KEY, cleanAnswer, fieldPrompt, isConfigured, newConfig, readAiConfig, saveAiConfig } from '../lib/ai.js';

const root = document.documentElement;
const resetRoot = () => {
  for (const a of [...root.attributes]) if (a.name.startsWith('data-kt-')) root.removeAttribute(a.name);
  root.removeAttribute('style');
};

describe('preferências de acessibilidade', () => {
  beforeEach(() => {
    localStorage.clear();
    resetRoot();
  });

  it('lê com segurança, grava só o que difere do padrão e aplica no <html>', () => {
    localStorage.setItem(STORAGE_KEY, '{"contrast":true,"fontSize":999,"zoom":150,"x":1}');
    const p = readPrefs();
    expect(p).toMatchObject({ contrast: true, fontSize: 100, zoom: 150, grayscale: false });
    applyPrefs(p);
    expect(root.hasAttribute('data-kt-contrast')).toBe(true);
    expect(root.style.getPropertyValue('--kt-zoom')).toBe('1.5');
    savePrefs({ ...DEFAULTS });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    localStorage.setItem(STORAGE_KEY, 'não é json');
    expect(readPrefs()).toEqual(DEFAULTS);
  });

  it('escalas de texto e zoom param nas pontas', () => {
    expect(nextFontSize(100, 1)).toBe(112.5);
    expect(nextFontSize(200, 1)).toBe(200);
    expect(nextFontSize(90, -1)).toBe(90);
    expect(nextZoom(100, -1)).toBe(100);
    expect(nextZoom(175, 1)).toBe(200);
  });

  it('painel: abre com Alt+Shift+A, liga o alto contraste, aumenta o texto e fecha com Esc', () => {
    render(<I18nProvider><Accessibility /></I18nProvider>);
    const button = screen.getByRole('button', { name: /^Acessibilidade/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyA', bubbles: true }));
    });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('switch', { name: /Alto contraste/ }));
    expect(root.hasAttribute('data-kt-contrast')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar o texto' }));
    expect(root.style.fontSize).toBe('112.5%');
    expect(screen.getByRole('status')).toHaveTextContent('Tamanho do texto');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({ contrast: true, fontSize: 112.5 });
  });
});

describe('IA com a conta do usuário', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('configuração fica na sessão por padrão e no navegador só se o usuário pedir', () => {
    expect(readAiConfig()).toBeNull();
    saveAiConfig({ ...newConfig('openai'), key: 'sk-x' });
    expect(sessionStorage.getItem(AI_STORAGE_KEY)).toContain('sk-x');
    expect(localStorage.getItem(AI_STORAGE_KEY)).toBeNull();
    saveAiConfig({ ...newConfig('anthropic'), key: 'sk-ant', remember: true });
    expect(sessionStorage.getItem(AI_STORAGE_KEY)).toBeNull();
    expect(readAiConfig().provider).toBe('anthropic');
    expect(isConfigured(newConfig('ollama'))).toBe(true);
    expect(isConfigured(newConfig('gemini'))).toBe(false);
  });

  it('pedido do campo separa instruções, contexto e texto do usuário', () => {
    const p = fieldPrompt({ field: 'Objetivo', help: 'Resultado esperado', context: 'Projeto: ERP', current: 'texto', action: 'improve', extra: 'curto', locale: 'es', maxLength: 500 });
    expect(p.system).toMatch(/espanhol/);
    expect(p.message).toMatch(/Campo do formulário: "Objetivo"/);
    expect(p.message).toMatch(/<contexto>\nProjeto: ERP\n<\/contexto>/);
    expect(p.message).toMatch(/<texto_atual>\ntexto\n<\/texto_atual>/);
    expect(p.message).toMatch(/no máximo 500 caracteres/);
    expect(cleanAnswer('```text\nOlá\n```')).toBe('Olá');
  });

  it('botão de IA só aparece dentro de um projeto e o resultado colado é aplicado ao campo', () => {
    const onApply = vi.fn();
    const ui = (ctx) => (
      <MemoryRouter>
        <I18nProvider>
          <AiContextProvider value={ctx}>
            <AiButton label="Descrição" value="" onApply={onApply} />
          </AiContextProvider>
        </I18nProvider>
      </MemoryRouter>
    );
    const { rerender } = render(ui(null));
    expect(screen.queryByRole('button', { name: /Assistente de IA/ })).toBeNull();
    rerender(ui({ projectId: null, describe: () => 'Projeto X' }));
    fireEvent.click(screen.getByRole('button', { name: 'Assistente de IA para o campo Descrição' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Projeto X/)).toBeInTheDocument(); // contexto no pedido mostrado
    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'Texto gerado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar este texto' }));
    expect(onApply).toHaveBeenCalledWith('Texto gerado');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('modal (padrão de diálogo WAI-ARIA)', () => {
  it('fica no <body>, e o Esc fecha só o modal de cima', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const { container } = render(
      <I18nProvider>
        <form>
          <Modal title="Fora" onClose={closeOuter}><input aria-label="a" /></Modal>
          <Modal title="Dentro" onClose={closeInner}><input aria-label="b" /></Modal>
        </form>
      </I18nProvider>,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelectorAll(':scope > [role="dialog"][aria-modal="true"]')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
