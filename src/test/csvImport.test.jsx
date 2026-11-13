import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { DATASET_LABELS } from '../components/DatasetCsvImport.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { I18nProvider, translate } from '../i18n/I18nProvider.jsx';
import { csvToDatasets, DATASET_FIELDS, detectDelimiter, parseCsv, toCsv } from '../lib/csv.js';
import { SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

describe('leitor de CSV', () => {
  it('aspas, aspas duplicadas, quebra de linha em aspas, BOM e CRLF', () => {
    const text = '\uFEFFnome;descrição\r\n"a;b";"diz ""oi""\nsegunda linha"\r\n\r\nc;\r\n';
    expect(parseCsv(text)).toEqual([['nome', 'descrição'], ['a;b', 'diz "oi"\nsegunda linha'], ['c', '']]);
  });

  it('detecta ";", "," ou tabulação pelo cabeçalho', () => {
    expect(detectDelimiter('a;b;c\n1,2;3')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
  });

  it('toCsv e parseCsv vão e voltam', () => {
    const rows = [['nome', 'obs'], ['x;y', 'com "aspas"\ne quebra']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('cabeçalhos em qualquer idioma viram os campos; números e datas são normalizados', () => {
    const csv = [
      'Nome,Origem,Linhas,Columns,Tamaño (bytes),Coletado em,Descrição,Responsável',
      'clientes,CRM,"48.000",12,"1,024",31/01/2026,Ativos,Ana',
      'vendas,ERP,,,,2026-02-28,,Bia',
      ',,,,,,,',
    ].join('\n');
    const r = csvToDatasets(csv);
    expect(r.missingName).toBe(false);
    expect(r.ignored).toEqual(['Responsável']);
    expect(r.lines).toEqual([2, 3]);
    expect(r.datasets).toEqual([
      { name: 'clientes', source: 'CRM', rowCount: 48000, columnCount: 12, sizeBytes: 1024, collectedAt: '2026-01-31', description: 'Ativos' },
      { name: 'vendas', source: 'ERP', collectedAt: '2026-02-28' },
    ]);
    expect(csvToDatasets('origem;formato\nCRM;csv').missingName).toBe(true);
  });

  it('o modelo CSV baixado é lido de volta em qualquer idioma', () => {
    for (const locale of ['pt-BR', 'en', 'es']) {
      const header = DATASET_FIELDS.map((f) => translate(locale, DATASET_LABELS[f]));
      const r = csvToDatasets(toCsv([header, DATASET_FIELDS.map((f) => (f === 'rowCount' || f === 'columnCount' || f === 'sizeBytes' ? '1' : f === 'collectedAt' ? '2026-01-01' : 'x'))]));
      expect(r.ignored, locale).toEqual([]);
      expect(r.columns.sort(), locale).toEqual([...DATASET_FIELDS].sort());
    }
  });
});

// ---------- Tela: botão na aba Datasets do CRISP-DM ----------
const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const P = 'p1';
const DM = `/projects/${P}/crisp-dm`;

describe('importar datasets de um CSV no CRISP-DM', () => {
  let writes;
  let importReply;
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    writes = [];
    importReply = null;
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (path === '/auth/refresh') return json(200, { accessToken: 'acc', refreshToken: 'ref2' });
      if (path === '/auth/me') return json(200, { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'master', emailVerified: true });
      if (path === `/projects/${P}`) {
        return json(200, { id: P, name: 'Churn', type: 'data_analysis', version: '1.0', access: 'owner', sections: SECTION_KEYS, createdAt: 'x', updatedAt: 'x' });
      }
      if (path === `${DM}/datasets/import`) {
        writes.push(JSON.parse(init.body));
        return importReply ?? json(201, { created: 1, skipped: ['vendas'], datasets: [] });
      }
      if (path === `${DM}/datasets`) return json(200, []);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const openImport = async () => {
    const router = createMemoryRouter(routes, { initialEntries: [`/projects/${P}/datasets`] });
    render(
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Importar CSV/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar datasets de um arquivo CSV' });
    const file = new File(['Nome;Origem;Linhas\nclientes;CRM;48.000\nvendas;ERP;10\n'], 'lista.csv', { type: 'text/csv' });
    fireEvent.change(within(dialog).getByLabelText('Arquivo CSV'), { target: { files: [file] } });
    await within(dialog).findByText('2 dataset(s) em lista.csv.');
    return dialog;
  };

  it('mostra a prévia, envia as linhas e avisa dos nomes pulados', async () => {
    const dialog = await openImport();
    expect(within(dialog).getByText('clientes')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importar 2 dataset(s)' }));
    await waitFor(() => expect(writes).toEqual([{ datasets: [
      { name: 'clientes', source: 'CRM', rowCount: 48000 },
      { name: 'vendas', source: 'ERP', rowCount: 10 },
    ] }]));
    expect(await screen.findByText('1 dataset(s) importado(s).')).toBeTruthy();
    expect(screen.getByText('1 já existiam e foram pulados: vendas.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('erro numa linha: nada é importado e a linha do arquivo aparece', async () => {
    importReply = json(422, { error: 'Há linhas inválidas no arquivo', details: { rows: [{ row: 2, errors: { rowCount: ['Número inválido'] } }] } });
    const dialog = await openImport();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importar 2 dataset(s)' }));
    const alert = await within(dialog).findByText(/Nada foi importado/);
    expect(alert.closest('.alert').textContent).toContain('Linha 3 — Linhas: Número inválido');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
