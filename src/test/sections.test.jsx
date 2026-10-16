import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, session } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ToastProvider } from '../components/Toasts.jsx';
import { CK_TEXT } from '../content/commonkads.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { canAccessSection, IMPLEMENTED, SECTION_KEYS } from '../pages/public/PublicPages.jsx';
import { routes } from '../router.jsx';

// Planilhas como a API devolve (modules/commonkads/commonkads.constants.js)
const REGISTRY = { 'om-3': 'tasks', 'om-4': 'knowledge', 'tm-1': 'tasks', 'tm-2': 'knowledge', 'am-1': 'agents', mas: 'agents', 'cm-1': 'transactions', 'cm-2': 'transactions' };
const MODEL = (key) => ({ om: 'organization', ota: 'organization', tm: 'task', am: 'agent', mas: 'agent', km: 'knowledge', cm: 'communication', dm: 'design' })[key.split('-')[0]];
const SHEET_KEYS = ['om-1', 'om-2', 'om-3', 'om-4', 'om-5', 'tm-1', 'tm-2', 'am-1', 'mas', 'ota-1', 'km-1', 'cm-1', 'cm-2', 'dm-1', 'dm-2', 'dm-3', 'dm-4'];

const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('conteúdo do CommonKADS', () => {
  it('as 17 planilhas e os mesmos itens nos três idiomas', () => {
    expect(Object.keys(CK_TEXT['pt-BR'].worksheets)).toEqual(SHEET_KEYS);
    for (const code of ['en', 'es']) expect(keys(CK_TEXT[code]).sort()).toEqual(keys(CK_TEXT['pt-BR']).sort());
  });

  it('cada item tem rótulo e orientação', () => {
    for (const lang of Object.values(CK_TEXT)) {
      for (const [key, sheet] of Object.entries(lang.worksheets)) {
        expect(sheet.title, key).toBeTruthy();
        if (REGISTRY[key]) expect(sheet.text, key).toBeTruthy();
        for (const [label, guide] of Object.values(sheet.fields ?? {})) expect(label && guide).toBeTruthy();
      }
      for (const group of ['task', 'knowledge', 'agent', 'mas', 'transaction']) {
        for (const [name, pair] of Object.entries(lang[group])) expect(pair, `${group}.${name}`).toHaveLength(2);
      }
    }
  });
});

describe('planos e seções', () => {
  it('Visão de Sistema saiu do catálogo; Ontologias, BPM e CommonKADS estão disponíveis', () => {
    expect(SECTION_KEYS).not.toContain('system-view');
    for (const s of ['ontologies', 'bpm', 'commonkads']) expect(IMPLEMENTED).toContain(s);
  });

  it('todos os planos, inclusive o Free, acessam todas as seções, como na API', () => {
    for (const plan of ['free', 'standard', 'master']) {
      for (const s of SECTION_KEYS) expect(canAccessSection({ role: 'client', plan }, s)).toBe(true);
    }
    expect(canAccessSection(null, 'kanban')).toBe(false);
  });
});

const json = (status, body) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
  });

describe('cliente: upload e download de arquivos', () => {
  beforeEach(() => session.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('envia o arquivo bruto com o nome codificado e recebe Blob no download', async () => {
    const fetchMock = vi.fn((url, init) => (init.method === 'PUT' ? json(200, { id: 'o1' }) : json(200, 'conteúdo')));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['<rdf/>'], 'Agenda Ç.owl');
    await api.upload('/projects/p/ontologies/o1/file', file);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(file);
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
    expect(init.headers['X-File-Name']).toBe('Agenda%20%C3%87.owl');
    const blob = await api.blob('/projects/p/ontologies/o1/file');
    expect(blob).toBeInstanceOf(Blob);
  });
});

// ---------- Páginas renderizadas pelo roteador real, com a API simulada ----------
const P = 'p1';
const ids = { task: 't1', knowledge: 'k1', agent: 'a1', agent2: 'a2', tr: 'tr1', onto: 'o1', proc: 'pr1', diag: 'd1', sprint: 'sp1' };
const stamp = { createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T10:00:00Z' };
const worksheets = SHEET_KEYS.map((key, i) => ({
  key, model: MODEL(key), order: i + 1, fields: Object.keys(CK_TEXT.en.worksheets[key].fields ?? {}), resource: REGISTRY[key],
  status: key === 'om-1' ? 'in_progress' : 'not_started', content: key === 'om-1' ? { solutions: 'Sistema especialista' } : {},
  notes: null, updatedAt: null,
}));
const task = { id: ids.task, projectId: P, code: 'T1', name: 'Diagnosticar falha', agentIds: [ids.agent], knowledgeIds: [ids.knowledge], location: 'Suporte', knowledgeIntensive: true, significance: 5, goalValue: 'Reduzir paradas', ...stamp };
const knowledge = { id: ids.knowledge, projectId: P, name: 'Regras de diagnóstico', domain: 'Manutenção', rightForm: false, rightFormNotes: 'Só na cabeça', characterization: { nature: { heuristic: { applies: true, bottleneck: true } } }, ...stamp };
const agents = [
  { id: ids.agent, projectId: P, name: 'Técnico', kind: 'human', knowledgeIds: [ids.knowledge], communicatesWithIds: [ids.agent2], aiTechnique: null, ...stamp },
  { id: ids.agent2, projectId: P, name: 'Sistema de chamados', kind: 'information_system', knowledgeIds: [], communicatesWithIds: [], aiTechnique: 'Regras', ...stamp },
];
const transaction = {
  id: ids.tr, projectId: P, code: 'TR1', name: 'Informar diagnóstico', fromTaskId: ids.task, toTaskId: null, senderAgentId: ids.agent, receiverAgentId: ids.agent2,
  informationItems: [{ name: 'Diagnóstico', role: 'core', form: 'texto', medium: 'janela' }], messages: [{ type: 'report', content: 'Pronto' }], ...stamp,
};
const ref = (id, label) => ({ id, label });
const ontology = {
  id: ids.onto, projectId: P, title: 'Ontologia de Agenda', status: 'published', format: 'rdf_xml', version: '1.0', iri: 'https://ex.com/agenda',
  classCount: 9, relationshipCount: 1, propertyCount: 1, objectCount: 1, vocabularies: ['owl', 'skos'], principles: ['fair'],
  publicationUrl: 'https://ex.com/agenda.owl', fileName: 'agenda.owl', fileMime: 'application/rdf+xml', fileSize: 2048, fileSha256: 'x', fileUploadedAt: '2026-10-14T10:00:00Z',
  analysis: {
    format: 'rdf_xml', iri: 'https://ex.com/agenda', version: '1.0', vocabularies: ['owl', 'skos'],
    counts: { classes: 2, objectProperties: 1, datatypeProperties: 1, annotationProperties: 0, individuals: 1, subClassOf: 1 },
    suggested: { classCount: 2, relationshipCount: 1, propertyCount: 1, objectCount: 1 },
  },
  ...stamp,
};
const processes = [
  { id: 'mp1', projectId: P, code: 'MP1', name: 'Atendimento', level: 'macroprocess', status: 'mapped', parentId: null, ...stamp },
  { id: ids.proc, projectId: P, code: 'P1', name: 'Agendar', level: 'process', status: 'identified', parentId: 'mp1', suppliers: 'Cliente', steps: 'Receber\nConfirmar', ...stamp },
];
const diagram = {
  id: ids.diag, projectId: P, processId: ids.proc, title: 'Agendar AS IS', state: 'as_is', notation: 'bpmn', fileName: 'agendar.bpmn', fileMime: 'application/xml', fileSize: 900,
  fileSha256: 'y', fileUploadedAt: '2026-10-14T10:00:00Z',
  metrics: {
    isBpmn: true, counts: { tasks: 2, startEvents: 1, endEvents: 1, gateways: 0, sequenceFlows: 3, lanes: 2 }, byType: { tasks: { userTask: 2 } },
    processes: ['Agendar'], participants: [], lanes: ['Recepção', 'Sistema'], taskNames: ['Escolher horário', 'Confirmar'], hasLayout: true,
  },
  ...stamp,
};

const sprint = { id: 'sp1', projectId: P, number: 1, name: null, goal: 'MVP', status: 'active', startDate: null, endDate: null, increment: null, ...stamp };
const sprintDetail = {
  ...sprint,
  items: [{ id: 'it1', projectId: P, sprintId: 'sp1', code: 'PB-1', title: 'Login', type: 'story', storyPoints: 3, status: 'done', position: 0, doneAt: '2026-10-15T13:00:00Z', ...stamp }],
  tasks: [
    { id: 'tk1', projectId: P, sprintId: 'sp1', itemId: 'it1', title: 'Tela de login', status: 'done', position: 0, doneAt: '2026-10-15T12:00:00Z', kanbanCardId: null, ...stamp },
  ],
  events: [],
  burndown: null,
  delivered: {
    items: [{ id: 'it1', code: 'PB-1', title: 'Login', storyPoints: 3, doneAt: '2026-10-15T13:00:00Z' }],
    tasks: [{ id: 'tk1', title: 'Tela de login', itemId: 'it1', doneAt: '2026-10-15T12:00:00Z' }],
    points: 3,
  },
};

const ROUTES = {
  '/auth/refresh': { accessToken: 'acc', refreshToken: 'ref2' },
  '/auth/me': { id: 'u1', email: 'ana@ex.com', role: 'client', plan: 'master', emailVerified: true },
  [`/projects/${P}`]: { id: P, name: 'Projeto X', type: 'data_analysis', version: '1.0', description: null, ...stamp },
  [`/projects/${P}/commonkads`]: {
    progress: 6, worksheets: worksheets.map((w) => ({ ...w, filled: Object.keys(w.content).length })),
    counts: { tasks: 1, knowledgeIntensiveTasks: 1, knowledge: 1, bottlenecks: 1, agents: 2, humanAgents: 1, systemAgents: 1, transactions: 1 },
    gaps: { tasksWithoutAgent: [], knowledgeNotUsed: [], agentsWithoutTask: ['Sistema de chamados'], transactionsWithoutAgents: [] },
  },
  [`/projects/${P}/commonkads/worksheets`]: worksheets,
  [`/projects/${P}/commonkads/tasks`]: [task],
  [`/projects/${P}/commonkads/tasks/${ids.task}`]: task,
  [`/projects/${P}/commonkads/knowledge`]: [knowledge],
  [`/projects/${P}/commonkads/knowledge/${ids.knowledge}`]: knowledge,
  [`/projects/${P}/commonkads/agents`]: agents,
  [`/projects/${P}/commonkads/agents/${ids.agent}`]: agents[0],
  [`/projects/${P}/commonkads/transactions`]: [transaction],
  [`/projects/${P}/commonkads/transactions/${ids.tr}`]: transaction,
  [`/projects/${P}/commonkads/report`]: {
    generatedAt: '2026-10-14T10:00:00Z', project: { id: P, name: 'Projeto X', version: '1.0' }, worksheets,
    tasks: [{ ...task, agents: [ref(ids.agent, 'Técnico')], knowledge: [ref(ids.knowledge, 'Regras de diagnóstico')] }],
    knowledge: [{ ...knowledge, possessedBy: [ref(ids.agent, 'Técnico')], usedIn: [ref(ids.task, 'T1 — Diagnosticar falha')] }],
    agents: agents.map((a) => ({ ...a, engagedIn: [], knowledge: [], communicatesWith: [] })),
    transactions: [{ ...transaction, fromTask: ref(ids.task, 'T1 — Diagnosticar falha'), toTask: null, sender: ref(ids.agent, 'Técnico'), receiver: ref(ids.agent2, 'Sistema de chamados') }],
  },
  [`/projects/${P}/ontologies/summary`]: {
    total: 1, withFile: 1, published: 1, totals: { classCount: 9, relationshipCount: 1, propertyCount: 1, objectCount: 1 },
    byFormat: { rdf_xml: 1 }, byStatus: { published: 1 }, vocabularies: { owl: 1, skos: 1 }, principles: { fair: 1 },
  },
  [`/projects/${P}/ontologies`]: [ontology],
  [`/projects/${P}/ontologies/${ids.onto}`]: ontology,
  [`/projects/${P}/bpm`]: {
    processes: processes.map((p) => ({ ...p, sipocComplete: p.id === ids.proc, diagrams: p.id === ids.proc ? 1 : 0 })),
    counts: { processes: 2, byLevel: {}, byStatus: {}, diagrams: 1, diagramsByState: { as_is: 1 }, diagramsWithFile: 1 },
  },
  [`/projects/${P}/bpm/processes`]: processes,
  [`/projects/${P}/bpm/processes/${ids.proc}`]: processes[1],
  [`/projects/${P}/bpm/diagrams`]: [diagram],
  [`/projects/${P}/bpm/diagrams/${ids.diag}`]: diagram,
  // Scrum ↔ Kanban
  [`/projects/${P}/scrum/members`]: [],
  [`/projects/${P}/scrum/sprints`]: [sprint],
  [`/projects/${P}/scrum/items`]: sprintDetail.items,
  [`/projects/${P}/scrum/sprints/${ids.sprint}/detail`]: sprintDetail,
  [`/projects/${P}/scrum/sprints/${ids.sprint}/publish-kanban`]: {
    published: 1, createdTasks: 0, sprint: { ...sprintDetail, tasks: sprintDetail.tasks.map((tk) => ({ ...tk, kanbanCardId: 'card-1' })) },
  },
  [`/projects/${P}/kanban`]: {
    columns: [
      { id: 'col-1', projectId: P, name: 'A fazer', position: 0, wipLimit: null, taskStatus: 'todo', cards: [] },
      {
        id: 'col-3', projectId: P, name: 'Concluído', position: 1, wipLimit: null, taskStatus: 'done',
        cards: [{ id: 'card-1', projectId: P, columnId: 'col-3', title: 'Tela de login', position: 0, scrumTaskId: 'tk1', taskStatus: 'done', sprintId: ids.sprint, sprintNumber: 1, itemCode: 'PB-1', ...stamp }],
      },
    ],
  },
};

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>,
  );
  return router;
}

describe('páginas das seções novas', () => {
  const unknown = [];
  const writes = [];
  beforeAll(() => {
    window.scrollTo = () => {}; // o jsdom não implementa
  });
  beforeEach(() => {
    unknown.length = 0;
    writes.length = 0;
    localStorage.clear();
    localStorage.setItem('kt.locale', 'pt-BR');
    session.clear();
    session.set({ accessToken: null, refreshToken: 'ref1' });
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      const path = new URL(url, 'http://x').pathname.replace(/^\/api\/v1/, '');
      if (init?.method && init.method !== 'GET' && path !== '/auth/refresh') {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
        writes.push({ method: init.method, path, body });
        return json(200, { ...(ROUTES[path] ?? {}), ...body });
      }
      if (path in ROUTES) return json(200, ROUTES[path]);
      unknown.push(path);
      return json(404, { error: 'não encontrado' });
    }));
  });
  afterEach(() => {
    cleanup(); // sem globals no Vitest, a desmontagem não é automática
    vi.unstubAllGlobals();
  });

  const cases = [
    ['CommonKADS · visão geral', `/projects/${P}/commonkads`, 'Lacunas entre os modelos'],
    ['CommonKADS · organização', `/projects/${P}/commonkads/organization`, 'Planilha OM-1: Problemas e oportunidades'],
    ['CommonKADS · tarefas (OM-3)', `/projects/${P}/commonkads/tasks`, 'Diagnosticar falha'],
    ['CommonKADS · tarefa (TM-1)', `/projects/${P}/commonkads/tasks/${ids.task}`, 'Planilha TM-1: Análise de tarefa'],
    ['CommonKADS · conhecimento (OM-4)', `/projects/${P}/commonkads/knowledge`, 'Regras de diagnóstico'],
    ['CommonKADS · item (TM-2)', `/projects/${P}/commonkads/knowledge/${ids.knowledge}`, 'Natureza do conhecimento'],
    ['CommonKADS · agentes (AM-1)', `/projects/${P}/commonkads/agents`, 'Sistema de chamados'],
    ['CommonKADS · agente (AM-1/MAS)', `/projects/${P}/commonkads/agents/${ids.agent}`, 'Planilha MAS: Agente (MAS-CommonKADS)'],
    ['CommonKADS · impactos', `/projects/${P}/commonkads/impact`, 'Planilha OTA-1'],
    ['CommonKADS · modelo de conhecimento', `/projects/${P}/commonkads/knowledge-model`, 'Planilha KM-1'],
    ['CommonKADS · comunicação (CM-1)', `/projects/${P}/commonkads/communication`, 'Informar diagnóstico'],
    ['CommonKADS · transação (CM-2)', `/projects/${P}/commonkads/communication/${ids.tr}`, 'Planilha CM-2: Especificação da troca de informações'],
    ['CommonKADS · projeto', `/projects/${P}/commonkads/design`, 'Planilha DM-4: Projeto da aplicação'],
    ['CommonKADS · documento', `/projects/${P}/commonkads/document`, 'Documento CommonKADS'],
    ['Ontologias · catálogo', `/projects/${P}/ontologies`, 'Ontologia de Agenda'],
    ['Ontologias · ontologia', `/projects/${P}/ontologies/${ids.onto}`, 'Leitura do arquivo'],
    ['BPM · arquitetura', `/projects/${P}/bpm`, 'MP1 — Atendimento'],
    ['BPM · processos', `/projects/${P}/bpm/processes`, 'Agendar'],
    ['BPM · processo', `/projects/${P}/bpm/processes/${ids.proc}`, 'SIPOC · Diagnóstico'],
    ['BPM · diagramas', `/projects/${P}/bpm/diagrams`, 'Agendar AS IS'],
    ['BPM · diagrama', `/projects/${P}/bpm/diagrams/${ids.diag}`, 'Leitura do BPMN'],
  ];

  it.each(cases)('%s', async (_name, path, text) => {
    renderAt(path);
    await waitFor(() => expect(screen.getAllByText((_, el) => el?.textContent === text || el?.textContent?.startsWith(text)).length).toBeGreaterThan(0), { timeout: 4000 });
    expect(screen.queryByText(/Unexpected Application Error/i)).toBeNull();
    expect(unknown).toEqual([]);
  });

  it('sprint: publica as tasks no Kanban e mostra o incremento entregue', async () => {
    renderAt(`/projects/${P}/scrum/sprints/${ids.sprint}`);
    const publish = await screen.findByRole('button', { name: /Publicar no Kanban/ });
    expect(screen.getByText('3 ponto(s) entregue(s)')).toBeTruthy();
    expect(screen.getAllByText('Tela de login').length).toBeGreaterThan(1); // no quadro e no incremento
    fireEvent.click(publish);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      path: `/projects/${P}/scrum/sprints/${ids.sprint}/publish-kanban`,
      body: { columnNames: { todo: 'A fazer', in_progress: 'Em andamento', done: 'Concluído' } },
    });
    // tudo publicado: o botão sai e a task fica marcada como "No Kanban"
    await waitFor(() => expect(screen.queryByRole('button', { name: /Publicar no Kanban/ })).toBeNull());
    expect(screen.getByText(/Todas as tasks estão no Kanban/)).toBeTruthy();
    expect(screen.getAllByText('No Kanban').length).toBe(1);
    expect(unknown).toEqual([]);
  });

  it('Kanban: cartão de task do Scrum mostra a sprint e o item, e a coluna a situação', async () => {
    renderAt(`/projects/${P}/kanban`);
    const chip = await screen.findByRole('link', { name: /S1 · PB-1/ });
    expect(chip.getAttribute('href')).toBe(`/projects/${P}/scrum/sprints/${ids.sprint}`);
    expect(screen.getByText(/Situação das tasks do Scrum: Feito/, { selector: '.kt-kb-status' })).toBeTruthy();
    expect(unknown).toEqual([]);
  });

  it('menu lateral: usuário, grupos, tema e idioma; Esc fecha e devolve o foco', async () => {
    renderAt(`/projects/${P}/bpm`);
    const toggle = await screen.findByRole('button', { name: 'Abrir menu' });
    toggle.focus();
    fireEvent.click(toggle);
    const menu = await screen.findByRole('dialog', { name: 'KoneKtron' });
    expect(menu.getAttribute('aria-hidden')).toBe('false');
    expect(within(menu).getByText('ana@ex.com')).toBeTruthy();
    expect(within(menu).getByText('Plano Master')).toBeTruthy();
    for (const group of ['Navegar', 'Sua conta', 'Ajuda e informações']) expect(within(menu).getByRole('heading', { name: group })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: /Documentação da API/ }).getAttribute('target')).toBe('_blank');
    fireEvent.click(within(menu).getByRole('button', { name: 'Tema escuro' }));
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(within(menu).getByRole('button', { name: 'Tema escuro' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(menu).getByRole('button', { name: 'EN' }));
    await waitFor(() => expect(within(menu).getByRole('heading', { name: 'Your account' })).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('true'));
    expect(document.activeElement).toBe(toggle);
    document.documentElement.setAttribute('data-bs-theme', 'light');
  });

  it('planilha de texto: salva só o item alterado (merge na API)', async () => {
    renderAt(`/projects/${P}/commonkads/organization`);
    const field = await screen.findByLabelText('Contexto organizacional');
    fireEvent.change(field, { target: { value: 'Missão: atender bem' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar planilha' })[0]);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PATCH', path: `/projects/${P}/commonkads/worksheets/om-1`, body: { content: { organizationalContext: 'Missão: atender bem' } },
    });
  });

  it('TM-2: caracterização guarda só os itens marcados', async () => {
    renderAt(`/projects/${P}/commonkads/knowledge/${ids.knowledge}`);
    fireEvent.click(await screen.findByLabelText('Formal, rigoroso: Se aplica'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar planilha' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const { body } = writes[0];
    expect(body.characterization).toEqual({
      nature: { heuristic: { applies: true, bottleneck: true }, formal: { applies: true, bottleneck: false } },
      form: {},
      availability: {},
    });
    expect(body.rightForm).toBe(false);
    expect(body.rightFormNotes).toBe('Só na cabeça');
  });

  it('CM-2: mensagens novas entram e linhas vazias são descartadas', async () => {
    renderAt(`/projects/${P}/commonkads/communication/${ids.tr}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar mensagem' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' })); // fica vazio
    fireEvent.change(screen.getByLabelText('Conteúdo 2'), { target: { value: 'Pode fechar o chamado?' } });
    fireEvent.change(screen.getByLabelText('Tipo de comunicação 2'), { target: { value: 'ask' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar planilha' })[1]); // CM-2
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body.messages).toEqual([
      { type: 'report', content: 'Pronto' },
      { type: 'ask', content: 'Pode fechar o chamado?', reference: '' },
    ]);
    expect(writes[0].body.informationItems).toHaveLength(1);
  });

  it('ontologia: o upload mostra a leitura do arquivo sem recarregar', async () => {
    const detail = `/projects/${P}/ontologies/${ids.onto}`;
    const saved = ROUTES[detail];
    ROUTES[detail] = { ...saved, analysis: null, fileName: null, fileSize: null, fileSha256: null, fileUploadedAt: null };
    ROUTES[`${detail}/file`] = saved; // a API devolve o registro com `analysis`
    try {
      renderAt(detail);
      expect(await screen.findByText('Nenhum arquivo enviado.')).toBeInTheDocument();
      expect(screen.queryByText('Leitura do arquivo')).toBeNull();
      fireEvent.change(screen.getByLabelText(/Arraste o arquivo/), { target: { files: [new File(['<rdf/>'], 'agenda.owl')] } });
      expect(await screen.findByText('Leitura do arquivo')).toBeInTheDocument();
      expect(writes[0]).toMatchObject({ method: 'PUT', path: `${detail}/file` });
    } finally {
      ROUTES[detail] = saved;
      delete ROUTES[`${detail}/file`];
    }
  });

  it('Voltar leva ao nível acima e a aba do navegador mostra onde se está', async () => {
    const router = renderAt(`/projects/${P}/commonkads/tasks/${ids.task}`);
    const back = await screen.findByRole('link', { name: 'Voltar para Tarefas' });
    expect(back).toHaveAttribute('href', `/projects/${P}/commonkads/tasks`);
    await waitFor(() => expect(document.title).toBe('T1 — Diagnosticar falha · Tarefas · KoneKtron'));
    fireEvent.click(back);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${P}/commonkads/tasks`));
    expect(await screen.findByRole('link', { name: 'Voltar para CommonKADS' })).toHaveAttribute('href', `/projects/${P}/commonkads`);
  });

  it('alterações não salvas: avisa antes de sair e só sai se a pessoa confirmar', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      const router = renderAt(`/projects/${P}/commonkads/organization`);
      fireEvent.change(await screen.findByLabelText('Soluções'), { target: { value: 'Outra solução' } });
      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'Voltar para CommonKADS' }));
      await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
      expect(router.state.location.pathname).toBe(`/projects/${P}/commonkads/organization`);
      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByRole('link', { name: 'Voltar para CommonKADS' }));
      await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${P}/commonkads`));
    } finally {
      confirm.mockRestore();
    }
  });

  it('Ctrl+S salva o formulário em foco', async () => {
    renderAt(`/projects/${P}/commonkads/organization`);
    const field = await screen.findByLabelText('Contexto organizacional');
    fireEvent.change(field, { target: { value: 'Missão' } });
    fireEvent.keyDown(field, { key: 's', ctrlKey: true });
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toEqual({ content: { organizationalContext: 'Missão' } });
  });

  it('o plano Free também abre a seção, sem bloqueio', async () => {
    ROUTES['/auth/me'] = { ...ROUTES['/auth/me'], plan: 'free' };
    try {
      renderAt(`/projects/${P}/commonkads/organization`);
      expect(await screen.findByLabelText('Contexto organizacional')).toBeInTheDocument();
    } finally {
      ROUTES['/auth/me'] = { ...ROUTES['/auth/me'], plan: 'master' };
    }
  });
});
