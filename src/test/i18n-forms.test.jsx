import { describe, expect, it } from 'vitest';
import { toFormValues, toPayload } from '../components/forms.jsx';
import { TASK_LABELS } from '../content/crispdm.js';
import { TERMS } from '../content/terms.js';
import en from '../i18n/en.js';
import es from '../i18n/es.js';
import { DEFAULT_LOCALE, LANGUAGES, LOCALES, translate } from '../i18n/I18nProvider.jsx';
import ptBR from '../i18n/pt-BR.js';

// Todas as chaves de um objeto de mensagens, em notação a.b.c
const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n', () => {
  it('pt-BR, en e es têm as mesmas chaves', () => {
    expect(keys(en).sort()).toEqual(keys(ptBR).sort());
    expect(keys(es).sort()).toEqual(keys(ptBR).sort());
  });

  it('português é o padrão; o seletor oferece os três idiomas', () => {
    expect(DEFAULT_LOCALE).toBe('pt-BR');
    expect(LANGUAGES.map((l) => l.code)).toEqual(Object.keys(LOCALES));
    expect(LANGUAGES[0].code).toBe('pt-BR');
  });

  it('interpola variáveis e cai para o português ou para a chave', () => {
    expect(translate('pt-BR', 'dashboard.hello', { name: 'Ana' })).toBe('Olá, Ana!');
    expect(translate('es', 'dashboard.hello', { name: 'Ana' })).toBe('¡Hola, Ana!');
    expect(translate('xx', 'nav.home')).toBe('Início');
    expect(translate('en', 'chave.inexistente')).toBe('chave.inexistente');
  });

  it('conteúdos (termos e tarefas do CRISP-DM) existem nos três idiomas', () => {
    for (const code of Object.keys(LOCALES)) {
      expect(TERMS[code]).toHaveLength(TERMS['pt-BR'].length);
      expect(Object.keys(TASK_LABELS[code]).sort()).toEqual(Object.keys(TASK_LABELS.en).sort());
    }
  });
});

describe('formulários → API', () => {
  const t = (k) => k;
  const fields = [
    { name: 'code', required: true },
    { name: 'subType' },
    { name: 'rowCount', type: 'integer' },
    { name: 'stats', type: 'json' },
    { name: 'isPrimary', type: 'checkbox' },
  ];

  it('converte tipos e envia null para opcionais vazios', () => {
    const payload = toPayload(fields, { code: 'RF1', subType: '', rowCount: '42', stats: '{"a":1}', isPrimary: true }, t);
    expect(payload).toEqual({ code: 'RF1', subType: null, rowCount: 42, stats: { a: 1 }, isPrimary: true });
  });

  it('omite obrigatórios vazios (a API devolve o erro do campo)', () => {
    expect(toPayload(fields, { code: '', subType: 'x', rowCount: '', stats: '', isPrimary: false }, t)).not.toHaveProperty('code');
  });

  it('acusa JSON inválido no campo certo', () => {
    expect(() => toPayload(fields, { code: 'a', stats: '{oops', isPrimary: false }, t)).toThrow(
      expect.objectContaining({ field: 'stats' }),
    );
  });

  it('carrega registros da API como texto para os inputs', () => {
    expect(toFormValues(fields, { code: 'RF1', subType: null, rowCount: 7, stats: { a: 1 }, isPrimary: true })).toEqual({
      code: 'RF1', subType: '', rowCount: '7', stats: '{\n  "a": 1\n}', isPrimary: true,
    });
  });
});
