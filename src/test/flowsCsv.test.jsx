import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { DD_TEXT } from '../content/dataDiagnosis.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { parseCsv, toCsv } from '../lib/csv.js';
import { csvToFlows, FLOW_FIELDS, FLOWS_MAX, flowsTemplateCsv } from '../lib/flowsCsv.js';
import { SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

describe('CSV dos fluxos de dados (diagnóstico › seção 5)', () => {
  it('cabeçalhos e valores das listas em qualquer idioma; linhas completas; colunas desconhecidas ignoradas', () => {
    const csv = [
      'ID;Origin;Destino;Dados trafegados;Método de integração;Frecuencia;Formato;Responsável;Monitored?;Extra',
      'FL01;F01;DW;Vendas;ETL / ELT;Diária;SQL;Ana;Sim;x',
      'FL02;F02;DW;;Upload manual;;;;no;',
      'FL03;F03;BI;;sftp;;;;¿?;',
      ';;;;;;;;;',
    ].join('\n');
    const r = csvToFlows(csv);
    expect(r.ignored).toEqual(['Extra']);
    expect(r.columns).toEqual(FLOW_FIELDS);
    expect(r.lines).toEqual([2, 3, 4]);
    expect(r.flows[0]).toEqual({
      code: 'FL01', origin: 'F01', destination: 'DW', data: 'Vendas', method: 'etl', frequency: 'Diária', format: 'SQL', owner: 'Ana', monitored: 'yes',
    });
    expect(r.flows[1]).toMatchObject({ code: 'FL02', method: 'manual', monitored: 'no', data: '' });
    expect(r.flows[2]).toMatchObject({ method: 'file_transfer', monitored: '' });
    expect(r.warnings).toEqual([{ line: 4, field: 'monitored', kind: 'invalidOption', value: '¿?' }]);
  });

  it('textos acima do limite da API são cortados com aviso', () => {
    const r = csvToFlows(`code,origin\n${'X'.repeat(25)},F01`);
    expect(r.flows[0].code).toHaveLength(20);
    expect(r.warnings).toEqual([{ line: 2, field: 'code', kind: 'truncated', max: 20 }]);
  });

  it('o modelo baixado, em cada idioma, é lido de volta sem perdas', () => {
    for (const locale of Object.keys(DD_TEXT)) {
      const csv = flowsTemplateCsv(locale);
      expect(parseCsv(csv)[0], locale).toEqual(FLOW_FIELDS.map((f) => DD_TEXT[locale].report.fields[f]));
      const r = csvToFlows(csv);
      expect(r.ignored, locale).toEqual([]);
      expect(r.warnings, locale).toEqual([]);
      const examples = DD_TEXT[locale].templates.report.examples.flows;
      expect(r.flows, locale).toEqual(examples.map((row) => Object.fromEntries(FLOW_FIELDS.map((f) => [f, row[f] ?? '']))));
    }
  });
});

// ---------- Tela: relatório de diagnóstico ----------
const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const P = 'p1';
const DOC = `/projects/${P}/data-diagnosis/reports/r1`;
const existingFlow = { code: 'FL00', origin: 'A', destination: 'B', data: '', method: 'api', frequency: '', format: '', owner: '', monitored: 'yes' };

describe('importar fluxos de um CSV no relatório de diagnóstico', () => {
  let saved;
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  beforeEach(() => {
    saved = [];
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    const doc = { id: 'r1', title: 'Diagnóstico', version: '1.0', content: { flows: [existingFlow] }, updatedAt: '2026-11-01T00:00:00Z' };
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (path === '/auth/refresh') return json(200, { accessToken: 'acc', refreshToken: 'ref2' });
      if (path === '/auth/me') return json(200, { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'master', emailVerified: true });
      if (path === `/projects/${P}`) {
        return json(200, { id: P, name: 'Churn', type: 'data_analysis', version: '1.0', access: 'owner', sections: SECTION_KEYS, createdAt: 'x', updatedAt: 'x' });
      }
      if (path === DOC && init?.method === 'PATCH') {
        const body = JSON.parse(init.body);
        saved.push(body);
        return json(200, { ...doc, ...body });
      }
      if (path === DOC) return json(200, doc);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const openImport = async (csv) => {
    const router = createMemoryRouter(routes, { initialEntries: [DOC] });
    render(
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>,
    );
    const section = (await screen.findByRole('heading', { name: '5. Mapeamento dos fluxos de dados' })).closest('section');
    expect(within(section).getByRole('button', { name: /Baixar modelo CSV/ })).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: /Importar CSV/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar fluxos de dados de um arquivo CSV' });
    const file = new File([csv], 'fluxos.csv', { type: 'text/csv' });
    fireEvent.change(within(dialog).getByLabelText('Arquivo CSV'), { target: { files: [file] } });
    return dialog;
  };
  const CSV = 'ID;Origem;Destino;Método de integração;Monitorado?\nFL01;ERP;DW;ETL / ELT;Sim\nFL02;Planilha;DW;Upload manual;Não\n';

  it('acrescenta as linhas à tabela e grava ao salvar', async () => {
    const dialog = await openImport(CSV);
    await within(dialog).findByText('2 fluxo(s) em fluxos.csv.');
    expect(within(dialog).getByText('Upload manual')).toBeTruthy(); // prévia com os rótulos
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importar 2 fluxo(s)' }));
    expect(await screen.findByText(/2 fluxo\(s\) importado\(s\) para a tabela/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0]);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].content.flows.map((f) => [f.code, f.method, f.monitored])).toEqual([
      ['FL00', 'api', 'yes'], ['FL01', 'etl', 'yes'], ['FL02', 'manual', 'no'],
    ]);
  });

  it('substitui as linhas existentes quando escolhido', async () => {
    const dialog = await openImport(CSV);
    await within(dialog).findByText('2 fluxo(s) em fluxos.csv.');
    fireEvent.click(within(dialog).getByLabelText('Substituir pelos do arquivo'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importar 2 fluxo(s)' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0]);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].content.flows.map((f) => f.code)).toEqual(['FL01', 'FL02']);
  });

  it('arquivo sem colunas reconhecidas ou acima do limite não pode ser importado', async () => {
    const dialog = await openImport('foo;bar\n1;2\n');
    expect(await within(dialog).findByText(/Nenhuma coluna reconhecida/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Importar 0 fluxo/ }).disabled).toBe(true);

    const big = toCsv([['ID'], ...Array.from({ length: FLOWS_MAX }, (_, i) => [`F${i}`])]);
    fireEvent.change(within(dialog).getByLabelText('Arquivo CSV'), { target: { files: [new File([big], 'big.csv')] } });
    expect(await within(dialog).findByText(`A seção aceita no máximo ${FLOWS_MAX} fluxos; com este arquivo ficariam ${FLOWS_MAX + 1}.`)).toBeTruthy();
  });
});
