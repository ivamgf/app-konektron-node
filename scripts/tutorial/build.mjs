// Gera public/docs/tutorial-konektron.pdf a partir de tutorial.html e das capturas de capture.mjs.
// Uso: node scripts/tutorial/build.mjs <pasta-com-as-capturas.png>
// Requer puppeteer-core (instalado à parte, não é dependência do app) e o Chrome (CHROME_PATH).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const imgDir = process.argv[2];
if (!imgDir) throw new Error('Informe a pasta com as capturas (saída de capture.mjs).');

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage();

// PNG → JPEG (qualidade 82) para o PDF ficar leve
async function toJpeg(name) {
  const png = await readFile(join(imgDir, `${name}.png`));
  await page.setContent(`<img id="i" src="data:image/png;base64,${png.toString('base64')}" style="display:block">`);
  const img = await page.waitForSelector('#i');
  const { width, height } = await page.evaluate(() => {
    const el = document.getElementById('i');
    return { width: el.naturalWidth, height: el.naturalHeight };
  });
  await page.setViewport({ width, height });
  const jpg = await img.screenshot({ type: 'jpeg', quality: 82 });
  return `data:image/jpeg;base64,${Buffer.from(jpg).toString('base64')}`;
}

let html = await readFile(join(here, 'tutorial.html'), 'utf8');
for (const name of new Set([...html.matchAll(/\{\{img:([\w-]+)\}\}/g)].map((m) => m[1]))) {
  html = html.replaceAll(`{{img:${name}}}`, await toJpeg(name));
}
const brand = await readFile(join(root, 'public', 'brand', 'konektron-mark.svg'));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
html = html
  .replaceAll('{{brand}}', `data:image/svg+xml;base64,${brand.toString('base64')}`)
  .replaceAll('{{version}}', version)
  .replaceAll('{{date}}', new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

await page.setViewport({ width: 1240, height: 1754 });
await page.setContent(html, { waitUntil: 'load' });
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#5b6b7a;padding:0 16mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif"><span>Tutorial do KoneKtron</span><span class="pageNumber"></span></div>',
  preferCSSPageSize: true,
});
await mkdir(join(root, 'public', 'docs'), { recursive: true });
const out = join(root, 'public', 'docs', 'tutorial-konektron.pdf');
await writeFile(out, pdf);
await browser.close();
console.log(`${out} (${Math.round(pdf.length / 1024)} KB)`);
