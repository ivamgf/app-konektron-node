// IA com a conta do próprio usuário (sem custo para o KoneKtron), como no Konektron Research.
//
// Caminho 1 – assistente na web: monta o pedido, copia e abre o ChatGPT, Claude, Gemini ou Copilot numa aba
//   nova; o usuário cola a resposta de volta. Funciona com qualquer conta, inclusive gratuita.
// Caminho 2 – chave de API do usuário: o navegador chama o provedor direto. A chave fica só neste
//   navegador (na sessão, ou guardada se o usuário pedir) e nunca passa pela API do KoneKtron.

export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI (GPT)',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google (Gemini)',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['openrouter/auto', 'anthropic/claude-opus-5-5', 'openai/gpt-4.1', 'google/gemini-2.5-pro'],
    keyUrl: 'https://openrouter.ai/keys',
  },
  ollama: {
    name: 'Ollama',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
    noKey: true,
  },
};
export const PROVIDER_KEYS = Object.keys(PROVIDERS);

export const AI_STORAGE_KEY = 'kt.ai';
export const AI_EVENT = 'kt-ai-config';

const storages = () => {
  const out = [];
  try {
    out.push(sessionStorage);
  } catch {
    /* sem sessionStorage */
  }
  try {
    out.push(localStorage);
  } catch {
    /* sem localStorage */
  }
  return out;
};

export function newConfig(provider = 'anthropic') {
  return {
    provider,
    key: '',
    model: PROVIDERS[provider].models[0],
    remember: false,
    url: provider === 'ollama' ? 'http://localhost:11434' : undefined,
  };
}

export function readAiConfig() {
  for (const s of storages()) {
    try {
      const raw = s.getItem(AI_STORAGE_KEY);
      if (!raw) continue;
      const c = JSON.parse(raw);
      if (c?.provider && PROVIDERS[c.provider]) return c;
    } catch {
      /* valor inválido: ignora */
    }
  }
  return null;
}

export function saveAiConfig(c) {
  for (const s of storages()) {
    try {
      s.removeItem(AI_STORAGE_KEY);
    } catch {
      /* ignora */
    }
  }
  if (c) {
    try {
      (c.remember ? localStorage : sessionStorage).setItem(AI_STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* navegador sem armazenamento: vale até recarregar */
    }
  }
  window.dispatchEvent(new Event(AI_EVENT));
}

export const isConfigured = (c) =>
  Boolean(c && PROVIDERS[c.provider] && (PROVIDERS[c.provider].noKey || c.key?.trim()) && c.model?.trim());

// ---------------------------------------------------------------- chamada direta (caminho 2)

// Erro com uma chave de tradução (ai.errors.*) e um detalhe opcional do provedor
export class AiError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

function httpError(status, detail) {
  if (status === 401 || status === 403) return new AiError('key');
  if (status === 429) return new AiError('quota');
  if (status === 404) return new AiError('model', detail);
  return new AiError('http', `${status} ${detail}`.trim());
}

async function postJson(url, body, headers) {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch {
    throw new AiError('network');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw httpError(r.status, j?.error?.message ?? j?.message ?? '');
  return j;
}

// Formato de chat da OpenAI, também usado pelo OpenRouter e pelo Ollama
async function chatCompatible(url, c, p, headers) {
  const j = await postJson(
    url,
    { model: c.model, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.message }] },
    headers,
  );
  const text = j?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new AiError('empty');
  return text;
}

// Modelos Claude com fallback no servidor quando o modelo recusa por política
const WITH_FALLBACK = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

async function claude(c, p) {
  // SDK oficial, carregado só quando usado; a chave é do usuário e fica no navegador dele
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: c.key, dangerouslyAllowBrowser: true });
  try {
    const r = await client.beta.messages.create({
      model: c.model,
      max_tokens: 16000,
      system: p.system,
      messages: [{ role: 'user', content: p.message }],
      // texto de formulário: esforço médio basta (é o padrão do Opus 5.5, explícito para os demais)
      ...(c.model.startsWith('claude-haiku-4') ? {} : { output_config: { effort: 'medium' } }),
      ...(WITH_FALLBACK.has(c.model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    });
    if (r.stop_reason === 'refusal') throw new AiError('refusal');
    const text = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!text.trim()) throw new AiError('empty');
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw httpError(401, '');
    if (e instanceof Anthropic.RateLimitError) throw httpError(429, '');
    if (e instanceof Anthropic.NotFoundError) throw httpError(404, e.message);
    if (e instanceof Anthropic.APIError) throw httpError(e.status ?? 0, e.message);
    throw new AiError('network');
  }
}

async function gemini(c, p) {
  const j = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`,
    { systemInstruction: { parts: [{ text: p.system }] }, contents: [{ role: 'user', parts: [{ text: p.message }] }] },
    { 'x-goog-api-key': c.key },
  );
  const text = (j?.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('');
  if (!text.trim()) throw new AiError('empty');
  return text;
}

// Gera texto com a conta de IA configurada pelo usuário. p = { system, message }
export async function generate(c, p) {
  switch (c.provider) {
    case 'anthropic':
      return claude(c, p);
    case 'gemini':
      return gemini(c, p);
    case 'openai':
      return chatCompatible('https://api.openai.com/v1/chat/completions', c, p, { Authorization: `Bearer ${c.key}` });
    case 'openrouter':
      return chatCompatible('https://openrouter.ai/api/v1/chat/completions', c, p, {
        Authorization: `Bearer ${c.key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'KoneKtron',
      });
    case 'ollama':
      return chatCompatible(`${(c.url || 'http://localhost:11434').replace(/\/+$/, '')}/v1/chat/completions`, c, p, {});
    default:
      throw new AiError('provider');
  }
}

// ---------------------------------------------------------------- OpenRouter: conectar sem copiar a chave (OAuth PKCE)

const VERIFIER_KEY = 'kt.openrouter.verifier';
const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function connectOpenRouter(back = `${window.location.origin}/profile`) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  window.location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(back)}&code_challenge=${challenge}&code_challenge_method=S256`;
}

// Na volta do OpenRouter (?code=...), troca o código pela chave do usuário
export async function finishOpenRouter(code) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new AiError('openrouterExpired');
  const j = await postJson('https://openrouter.ai/api/v1/auth/keys', { code, code_verifier: verifier, code_challenge_method: 'S256' }, {});
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!j?.key) throw new AiError('empty');
  return j.key;
}

// ---------------------------------------------------------------- caminho 1: assistentes na web

export const ASSISTANTS = [
  { id: 'chatgpt', name: 'ChatGPT', url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`, prefill: true },
  { id: 'claude', name: 'Claude', url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`, prefill: true },
  { id: 'copilot', name: 'Microsoft Copilot', url: (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}`, prefill: true },
  { id: 'gemini', name: 'Gemini', url: () => 'https://gemini.google.com/app', prefill: false },
  { id: 'copy', name: null, url: () => '', prefill: false },
];

// Pedido completo (instruções + contexto) para colar num assistente de chat
export const promptForAssistant = (p) => `${p.system}\n\n${p.message}`;

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Copia o pedido e abre o assistente; pedidos longos não cabem na URL e vão só pela área de transferência
export async function openAssistant(id, prompt) {
  const copied = await copyText(prompt);
  const a = ASSISTANTS.find((x) => x.id === id);
  if (a && id !== 'copy') {
    const url = a.prefill && prompt.length <= 6000 ? a.url(prompt) : a.url('');
    window.open(url.replace(/\?q=$/, ''), '_blank', 'noopener');
  }
  return copied;
}

// ---------------------------------------------------------------- pedidos

export const ACTIONS = ['generate', 'improve', 'summarize', 'translate'];

const LANGUAGE_NAMES = { 'pt-BR': 'português do Brasil', en: 'inglês', es: 'espanhol' };
const OTHER_LANGUAGE = { 'pt-BR': 'inglês', en: 'português do Brasil', es: 'português do Brasil' };

export function systemPrompt(locale) {
  return (
    'Você é um assistente de engenharia de software, análise de sistemas, gestão de projetos e análise de dados ' +
    'que ajuda a preencher os cadastros de um projeto. Escreva em ' +
    `${LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES['pt-BR']}, ` +
    'com linguagem técnica clara, objetiva e impessoal. Não invente números, nomes, sistemas, datas nem fatos sobre a ' +
    'organização; quando faltar informação, escreva de forma genérica ou indique entre colchetes o que o usuário ' +
    'precisa completar. Responda apenas com o texto do campo, sem título, sem comentários antes ou depois e sem Markdown.'
  );
}

const TASKS = {
  generate: () => 'Escreva o conteúdo do campo',
  improve: () => 'Revise e melhore o texto atual do campo (clareza, coesão, linguagem técnica), mantendo as ideias',
  summarize: () => 'Resuma o texto atual do campo, mantendo as ideias principais',
  translate: (locale) => `Traduza o texto atual do campo para o ${OTHER_LANGUAGE[locale] ?? 'inglês'}`,
};

// Pedido para um campo de texto. Os textos do usuário vão marcados, separados das instruções.
export function fieldPrompt({ field, help, context, current, action, extra, locale, maxLength }) {
  const parts = [
    `Campo do formulário: "${field}".\nTarefa: ${TASKS[action]?.(locale) ?? TASKS.generate()}.`,
    help ? `Orientação para este campo: ${help}` : '',
    maxLength ? `Limite: no máximo ${maxLength} caracteres.` : '',
    context?.trim() ? `Contexto do projeto:\n<contexto>\n${context.trim()}\n</contexto>` : '',
    current?.trim() ? `Texto atual do campo:\n<texto_atual>\n${current.trim()}\n</texto_atual>` : '',
    extra?.trim() ? `Pedido adicional do usuário: ${extra.trim()}` : '',
  ];
  return { system: systemPrompt(locale), message: parts.filter(Boolean).join('\n\n') };
}

// Limpa a resposta: cercas de código e espaços nas pontas
export const cleanAnswer = (text) =>
  String(text ?? '')
    .replace(/^```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
