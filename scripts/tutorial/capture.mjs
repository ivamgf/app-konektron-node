// Captura as telas do tutorial. Requer a API e o app rodando localmente (BASE) com uma conta de
// demonstração e o projeto de exemplo; uso: node scripts/tutorial/capture.mjs <pasta-de-saída>
// Variáveis: TUTORIAL_BASE, TUTORIAL_EMAIL, TUTORIAL_PASSWORD, TUTORIAL_PROJECT, CHROME_PATH.
import puppeteer from 'puppeteer-core';
const OUT = process.argv[2];
const BASE = process.env.TUTORIAL_BASE ?? 'http://localhost:5173';
const SW = process.env.TUTORIAL_PROJECT;
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 760, deviceScaleFactor: 1.5 });
await p.evaluateOnNewDocument(() => { localStorage.setItem('kt.locale', 'pt-BR'); localStorage.setItem('kt.theme', 'light'); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (path) => { await p.goto(BASE + path, { waitUntil: 'networkidle0' }); await wait(500); };
const shot = async (name, opts = {}) => { await p.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('ok', name); };
const clickText = async (sel, text) => {
  const ok = await p.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text));
    if (el) el.click();
    return Boolean(el);
  }, sel, text);
  if (!ok) throw new Error(`não achei ${sel} "${text}"`);
  await wait(700);
};
const dialog = async (name) => {
  const el = await p.waitForSelector('[role="dialog"] .modal-content, .modal.show .modal-content', { timeout: 5000 });
  await wait(400);
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log('ok', name);
};

await go('/signup'); await shot('cadastro');
await go('/signin');
await p.type('input[type=email]', process.env.TUTORIAL_EMAIL);
await p.type('input[type=password]', process.env.TUTORIAL_PASSWORD);
await shot('entrar');
await clickText('form button[type=submit]', 'Entrar');
await p.waitForNetworkIdle(); await wait(800);

await go('/projects'); await shot('projetos');
await clickText('button', 'Novo projeto'); await dialog('novo-projeto');
await p.keyboard.press('Escape'); await wait(400);

await go(`/projects/${SW}`); await shot('visao-geral');
await go(`/projects/${SW}/analysis`); await shot('analise');
await clickText('button', 'Usar modelo'); await dialog('usar-modelo');
await p.keyboard.press('Escape'); await wait(400);
await go(`/projects/${SW}/requirements`); await shot('requisitos');
await go(`/projects/${SW}/diagrams`); await shot('diagramas');
await go(`/projects/${SW}/kanban`); await shot('kanban');
await go(`/projects/${SW}/report`); await shot('relatorio');
await go(`/projects/${SW}`);
await p.click('[aria-label="Compartilhar projeto"]'); await wait(700); await dialog('compartilhar');
await p.keyboard.press('Escape'); await wait(400);
await go(`/projects/${SW}/analysis`);
const ai = await p.$('button[title="Gerar ou melhorar com IA"]');
if (ai) { await ai.click(); await wait(700); await dialog('ia'); await p.keyboard.press('Escape'); await wait(400); }
await go('/profile?tab=ai'); await shot('perfil-ia');
await go('/profile?tab=subscription'); await shot('perfil-assinatura');
await go('/plans'); await shot('planos');
await go('/'); await p.click('button[aria-label="Abrir menu"], button[aria-controls]').catch(() => {}); await wait(700); await shot('menu');
await b.close();
