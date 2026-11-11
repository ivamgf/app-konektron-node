import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiButton, AiContextProvider } from '../components/AiAssist.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { newConfig, saveAiConfig } from '../lib/ai.js';
import { domToBlocks, fileSlug, toCsv, toPdfDefinition } from '../lib/exportReport.js';

describe('IA com chave: gera dentro do sistema', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('um clique no botão já gera o texto, sem oferecer o assistente na web', async () => {
    saveAiConfig({ ...newConfig('openai'), key: 'sk-teste' });
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/ai-usage')) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Objetivo gerado pela IA.' } }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const onApply = vi.fn();
    render(
      <MemoryRouter>
        <I18nProvider>
          <AiContextProvider value={{ projectId: null, describe: () => 'Projeto X' }}>
            <AiButton label="Objetivo" value="" onApply={onApply} />
          </AiContextProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assistente de IA para o campo Objetivo' }));
    await waitFor(() => expect(screen.getByLabelText('Resultado')).toHaveValue('Objetivo gerado pela IA.'));
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('api.openai.com'));
    expect(JSON.parse(call[1].body).messages[1].content).toMatch(/Projeto X/);
    expect(screen.queryByRole('button', { name: /Copiar pedido e abrir/ })).toBeNull();
    expect(screen.queryByLabelText('Assistente')).toBeNull();
    expect(screen.getByRole('button', { name: /Gerar novamente/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este texto' }));
    expect(onApply).toHaveBeenCalledWith('Objetivo gerado pela IA.');
  });
});

describe('exportação de relatórios', () => {
  const html = `
    <article>
      <div data-export="skip"><h2>Cabeçalho da tela</h2><button>Imprimir</button></div>
      <h2>1. Identificação</h2>
      <p class="small" data-export="skip">Orientação do modelo</p>
      <div class="mb-3"><label class="form-label">Organização <span>*</span></label><input value="Prefeitura" /></div>
      <div class="mb-3"><div class="kt-field-head"><label class="form-label">Objetivo</label><button class="kt-ai-button">IA</button></div>
        <textarea>Linha 1\nLinha 2</textarea><div class="form-text">ajuda</div></div>
      <div class="mb-3"><label class="form-label">Início</label><input type="date" value="2026-11-20" /></div>
      <div class="card kt-stat" data-export-label="Sistemas" data-export-value="3"><div>3</div><div>Sistemas</div></div>
      <h3>Fontes</h3>
      <table>
        <thead><tr><th class="kt-sheet-n">Nº</th><th>ID</th><th>Tipo</th><th><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody><tr><td class="kt-sheet-n">1</td><td><input value="F01" /></td>
          <td><select><option value="">—</option><option value="api" selected>API; REST</option></select></td><td><button>x</button></td></tr></tbody>
      </table>
      <ul><li><div class="form-check"><input type="checkbox" checked /><label>Papéis definidos</label></div></li></ul>
      <ol><li>Inicial</li><li>Repetível</li></ol>
      <svg><text>radar</text></svg>
    </article>`;
  const root = () => {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelector('select').value = 'api';
    return div.firstElementChild;
  };

  it('lê títulos, campos (com valores dos controles), tabelas, checklists e listas; pula botões e ajudas', () => {
    const blocks = domToBlocks(root(), { formatDate: (v) => v.split('-').reverse().join('/') });
    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: '1. Identificação' },
      { type: 'field', label: 'Organização', value: 'Prefeitura' },
      { type: 'field', label: 'Objetivo', value: 'Linha 1\nLinha 2' },
      { type: 'field', label: 'Início', value: '20/11/2026' },
      { type: 'field', label: 'Sistemas', value: '3' },
      { type: 'heading', level: 3, text: 'Fontes' },
      { type: 'table', caption: '', head: ['ID', 'Tipo'], rows: [['F01', 'API; REST']] },
      { type: 'check', checked: true, text: 'Papéis definidos' },
      { type: 'list', ordered: true, items: ['Inicial', 'Repetível'] },
    ]);
  });

  it('CSV com BOM, separador do idioma e aspas quando preciso', () => {
    const csv = toCsv(domToBlocks(root()), { separator: ';', fieldHeader: ['Campo', 'Valor'] });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toContain('Campo;Valor');
    expect(lines).toContain('Organização;Prefeitura');
    expect(csv).toContain('"Linha 1\nLinha 2"');
    expect(lines).toContain('ID;Tipo');
    expect(lines).toContain('F01;"API; REST"');
    expect(lines).toContain('Papéis definidos;X');
  });

  it('PDF: título, tabelas com cabeçalho repetido e paisagem para tabelas largas', () => {
    const def = toPdfDefinition(domToBlocks(root()), { title: 'Relatório', subtitle: 'Projeto' });
    expect(def.content[0]).toMatchObject({ text: 'Relatório', style: 'title' });
    const table = def.content.find((c) => c.table);
    expect(table.table.headerRows).toBe(1);
    expect(table.table.body[1]).toEqual(['F01', 'API; REST']);
    expect(def.pageOrientation).toBe('portrait');
    const wide = toPdfDefinition([{ type: 'table', head: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], rows: [['1']] }]);
    expect(wide.pageOrientation).toBe('landscape');
    expect(wide.content[0].table.body[1]).toHaveLength(7);
  });

  it('nome do arquivo sem acentos nem espaços', () => {
    expect(fileSlug('Relatório de Diagnóstico · Saúde 2026')).toBe('relatorio-de-diagnostico-saude-2026');
  });
});

describe('PDF sem caracteres que a fonte não tem', () => {
  it('troca setas e losangos, preservando a estrutura', async () => {
    const { pdfSafe } = await import('../lib/exportReport.js');
    expect(pdfSafe({ content: [{ text: 'ERP → DW' }, { table: { body: [['◆ Aprovação', 1]] } }] })).toEqual({
      content: [{ text: 'ERP -> DW' }, { table: { body: [['• Aprovação', 1]] } }],
    });
  });
});
