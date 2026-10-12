// Configuração dos recursos (espelha os schemas da API: systemAnalysis.* e crispdm.*)
import { enumOptions } from '../../components/forms.jsx';

export const ENUMS = {
  requirementType: ['functional', 'non_functional', 'domain', 'business_rule'],
  requirementStatus: ['proposed', 'approved', 'implemented', 'rejected'],
  priority: ['must', 'should', 'could', 'wont'],
  storyStatus: ['backlog', 'ready', 'in_progress', 'done'],
  storyPoints: [0, 1, 2, 3, 5, 8, 13, 21, 40, 100],
  diagramType: ['use_case', 'class', 'sequence', 'activity', 'state', 'component', 'deployment', 'er', 'bpmn', 'flowchart', 'other'],
  notation: ['mermaid', 'plantuml', 'drawio', 'bpmn_xml', 'image', 'other'],
  phaseStatus: ['not_started', 'in_progress', 'completed'],
  decision: ['deploy', 'iterate', 'new_project', 'stop'],
  objectiveType: ['business', 'data_mining'],
  dataType: ['numeric', 'categorical', 'text', 'datetime', 'boolean', 'other'],
  fieldRole: ['feature', 'target', 'id', 'ignore'],
  operation: ['select', 'clean', 'construct', 'integrate', 'format'],
  technique: ['classification', 'regression', 'clustering', 'association', 'time_series', 'anomaly_detection', 'nlp', 'computer_vision', 'other'],
  modelStatus: ['candidate', 'approved', 'rejected', 'deployed'],
  split: ['train', 'validation', 'test', 'cross_validation'],
  useCaseStatus: ['draft', 'reviewed', 'approved'],
  flowKind: ['main', 'alternative', 'exception'],
  relationType: ['include', 'extend'],
};

const opts = (t, name) => enumOptions(t, name, ENUMS[name]);
const label = (t, name) => (row, key) => (row[key] ? t(`enums.${name}.${row[key]}`) : '—');
const badge = (text, cls = 'text-bg-light border') => <span className={`badge ${cls}`}>{text}</span>;

// ---------- Análise de Sistemas ----------
export function requirementConfig(t) {
  const typeLabel = label(t, 'requirementType');
  const statusLabel = label(t, 'requirementStatus');
  return {
    singular: 'sa.requirement',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'sa.codeHelp', col: 'col-md-3' },
      { name: 'title', label: 'sa.title', required: true, maxLength: 200, col: 'col-md-9' },
      { name: 'type', label: 'project.type', type: 'select', required: true, options: opts(t, 'requirementType'), default: 'functional', col: 'col-md-4' },
      { name: 'subType', label: 'sa.subType', maxLength: 50, col: 'col-md-4' },
      { name: 'priority', label: 'sa.priority', type: 'select', options: opts(t, 'priority'), col: 'col-md-4' },
      { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'requirementStatus'), default: 'proposed', col: 'col-md-4' },
      { name: 'description', label: 'project.description', type: 'textarea', maxLength: 10000, rows: 4 },
      { name: 'technicalDescription', label: 'sa.technicalDescription', type: 'textarea', rows: 3 },
    ],
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'title', label: 'sa.title' },
      { key: 'type', label: 'project.type', render: (r) => typeLabel(r, 'type') },
      { key: 'priority', label: 'sa.priority', render: (r) => (r.priority ? badge(t(`enums.priority.${r.priority}`)) : '—') },
      { key: 'status', label: 'common.status', render: (r) => statusLabel(r, 'status') },
    ],
    filters: [
      { name: 'type', label: 'project.type', options: opts(t, 'requirementType') },
      { name: 'status', label: 'common.status', options: opts(t, 'requirementStatus') },
      { name: 'priority', label: 'sa.priority', options: opts(t, 'priority') },
    ],
  };
}

export function userStoryConfig(t, requirements = []) {
  const reqOptions = requirements.map((r) => ({ value: r.id, label: `${r.code} — ${r.title}` }));
  const reqCode = Object.fromEntries(requirements.map((r) => [r.id, r.code]));
  return {
    singular: 'project.tabs.userStories',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'sa.codeHelp', col: 'col-md-3' },
      { name: 'title', label: 'sa.title', required: true, maxLength: 200, col: 'col-md-9' },
      { name: 'asA', label: 'sa.asA', required: true, maxLength: 2000, col: 'col-md-4' },
      { name: 'iWant', label: 'sa.iWant', required: true, maxLength: 5000, col: 'col-md-8' },
      { name: 'soThat', label: 'sa.soThat', type: 'textarea', maxLength: 5000, rows: 2 },
      { name: 'acceptanceCriteria', label: 'sa.acceptanceCriteria', type: 'textarea', maxLength: 10000, rows: 3 },
      { name: 'requirementId', label: 'sa.requirement', type: 'select', options: reqOptions, col: 'col-md-6' },
      { name: 'storyPoints', label: 'sa.storyPoints', type: 'select', col: 'col-md-2',
        options: ENUMS.storyPoints.map((n) => ({ value: String(n), label: String(n) })) },
      { name: 'priority', label: 'sa.priority', type: 'select', options: opts(t, 'priority'), col: 'col-md-2' },
      { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'storyStatus'), default: 'backlog', col: 'col-md-2' },
    ],
    // storyPoints vem do select como texto
    transform: (p) => ({ ...p, storyPoints: p.storyPoints == null ? null : Number(p.storyPoints) }),
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'title', label: 'sa.title' },
      { key: 'requirementId', label: 'sa.requirement', render: (r) => reqCode[r.requirementId] ?? '—' },
      { key: 'storyPoints', label: 'sa.storyPoints', render: (r) => r.storyPoints ?? '—' },
      { key: 'status', label: 'common.status', render: (r) => t(`enums.storyStatus.${r.status}`) },
    ],
    filters: [
      { name: 'requirementId', label: 'sa.requirement', options: reqOptions },
      { name: 'status', label: 'common.status', options: opts(t, 'storyStatus') },
    ],
  };
}

export function diagramConfig(t) {
  return {
    singular: 'project.tabs.diagrams',
    fields: [
      { name: 'title', label: 'sa.title', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'type', label: 'project.type', type: 'select', required: true, options: opts(t, 'diagramType'), default: 'use_case', col: 'col-md-3' },
      { name: 'notation', label: 'sa.notation', type: 'select', options: opts(t, 'notation'), col: 'col-md-3' },
      { name: 'description', label: 'project.description', type: 'textarea', rows: 2 },
      { name: 'url', label: 'sa.url', type: 'url', maxLength: 1000 },
      { name: 'source', label: 'sa.source', type: 'code', rows: 10, help: 'sa.sourceHelp' },
    ],
    columns: [
      { key: 'title', label: 'sa.title' },
      { key: 'type', label: 'project.type', render: (r) => t(`enums.diagramType.${r.type}`) },
      { key: 'notation', label: 'sa.notation', render: (r) => (r.notation ? t(`enums.notation.${r.notation}`) : '—') },
      { key: 'url', label: 'sa.url', render: (r) => (r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{t('common.open')}</a> : '—') },
    ],
    filters: [{ name: 'type', label: 'project.type', options: opts(t, 'diagramType') }],
  };
}

/// ---------- Visão de Sistema ----------
export function stakeholderConfig() {
  return {
    singular: 'sv.stakeholder',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'sv.codeHelpP', col: 'col-md-3' },
      { name: 'name', label: 'sv.stakeholderName', required: true, maxLength: 200, col: 'col-md-5' },
      { name: 'role', label: 'sv.role', maxLength: 200, col: 'col-md-4' },
      { name: 'interest', label: 'sv.interest', type: 'textarea', maxLength: 5000, rows: 2 },
      { name: 'responsibility', label: 'sv.responsibility', type: 'textarea', maxLength: 5000, rows: 2 },
    ],
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'name', label: 'sv.stakeholderName' },
      { key: 'role', label: 'sv.role' },
      { key: 'interest', label: 'sv.interest', render: (r) => <span className="kt-prewrap small">{r.interest ?? '—'}</span> },
    ],
  };
}

export function glossaryConfig() {
  return {
    singular: 'sv.term',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'sv.codeHelpC', col: 'col-md-3' },
      { name: 'term', label: 'sv.term', required: true, maxLength: 200, col: 'col-md-9' },
      { name: 'definition', label: 'sv.definition', type: 'textarea', required: true, maxLength: 5000, rows: 3 },
      { name: 'synonyms', label: 'sv.synonyms', maxLength: 2000, col: 'col-md-6' },
      { name: 'relationships', label: 'sv.relationships', maxLength: 2000, col: 'col-md-6' },
    ],
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'term', label: 'sv.term' },
      { key: 'definition', label: 'sv.definition', render: (r) => <span className="kt-prewrap small">{r.definition}</span> },
      { key: 'synonyms', label: 'sv.synonyms' },
    ],
    nameOf: (r) => r.term,
  };
}

// Caso de uso no modelo de Guedes (UML 2, tab. 3.1) / aba "Casos de Uso" da planilha de análise
export function ucFormConfig(t, { requirements = [], useCases = [] } = {}) {
  const reqCode = Object.fromEntries(requirements.map((r) => [r.id, r.code]));
  return {
    singular: 'sv.useCase',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'sv.codeHelpUC', col: 'col-md-3' },
      { name: 'name', label: 'sv.useCaseName', required: true, maxLength: 200, help: 'sv.useCaseNameHelp', col: 'col-md-9' },
      { name: 'primaryActor', label: 'sv.primaryActor', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'generalUseCaseId', label: 'sv.generalUseCase', type: 'select', col: 'col-md-6',
        options: useCases.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` })) },
      { name: 'secondaryActors', label: 'sv.secondaryActors', type: 'textarea', rows: 2, maxLength: 2000, help: 'sv.onePerLine' },
      { name: 'summary', label: 'sv.summary', type: 'textarea', rows: 2, maxLength: 5000 },
      { name: 'preconditions', label: 'sv.preconditions', type: 'textarea', rows: 2, maxLength: 5000, help: 'sv.onePerLine', col: 'col-md-6' },
      { name: 'postconditions', label: 'sv.postconditions', type: 'textarea', rows: 2, maxLength: 5000, help: 'sv.onePerLine', col: 'col-md-6' },
      { name: 'restrictions', label: 'sv.restrictions', type: 'textarea', rows: 3, maxLength: 10000, help: 'sv.onePerLine' },
      { name: 'requirementIds', label: 'sv.requirements', type: 'multicheck', emptyText: 'sv.noRequirements',
        options: requirements.filter((r) => r.type !== 'non_functional').map((r) => ({ value: r.id, label: `${r.code} — ${r.title}` })) },
      { name: 'priority', label: 'sa.priority', type: 'select', options: opts(t, 'priority'), col: 'col-md-6' },
      { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'useCaseStatus'), default: 'draft', col: 'col-md-6' },
    ],
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'name', label: 'sv.useCaseName' },
      { key: 'primaryActor', label: 'sv.primaryActor' },
      { key: 'requirementIds', label: 'sv.requirements',
        render: (r) => (r.requirementIds ?? []).map((id) => reqCode[id]).filter(Boolean).join(', ') || '—' },
      { key: 'status', label: 'common.status',
        render: (r) => badge(t(`enums.useCaseStatus.${r.status}`), r.status === 'approved' ? 'text-bg-success' : undefined) },
    ],
    nameOf: (r) => `${r.code} — ${r.name}`,
  };
}

export function relationConfig(t, useCases = []) {
  const options = useCases.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` }));
  const name = Object.fromEntries(useCases.map((u) => [u.id, `${u.code} — ${u.name}`]));
  return {
    singular: 'sv.relation',
    fields: [
      { name: 'fromUseCaseId', label: 'sv.relationFrom', type: 'select', required: true, options, col: 'col-md-5' },
      { name: 'type', label: 'project.type', type: 'select', required: true, options: opts(t, 'relationType'), default: 'include', col: 'col-md-2' },
      { name: 'toUseCaseId', label: 'sv.relationTo', type: 'select', required: true, options, col: 'col-md-5' },
      { name: 'extensionPoint', label: 'sv.extensionPoint', maxLength: 200, col: 'col-md-6' },
      { name: 'condition', label: 'sv.condition', maxLength: 2000, col: 'col-md-6' },
    ],
    columns: [
      { key: 'fromUseCaseId', label: 'sv.relationFrom', render: (r) => name[r.fromUseCaseId] ?? '—' },
      { key: 'type', label: 'project.type', render: (r) => <code>«{r.type}»</code> },
      { key: 'toUseCaseId', label: 'sv.relationTo', render: (r) => name[r.toUseCaseId] ?? '—' },
      { key: 'condition', label: 'sv.condition', render: (r) => r.condition ?? '—' },
    ],
    nameOf: (r) => `${name[r.fromUseCaseId] ?? ''} «${r.type}»`,
  };
}

export function scenarioConfig(t, { stories = [], useCases = [] } = {}) {
  const storyName = Object.fromEntries(stories.map((s) => [s.id, s.code]));
  return {
    singular: 'sv.scenario',
    fields: [
      { name: 'title', label: 'sa.title', required: true, maxLength: 200, col: 'col-md-8' },
      { name: 'tags', label: 'sv.tags', maxLength: 200, help: 'sv.tagsHelp', col: 'col-md-4' },
      { name: 'userStoryId', label: 'sv.feature', type: 'select', col: 'col-md-6',
        options: stories.map((s) => ({ value: s.id, label: `${s.code} — ${s.title}` })) },
      { name: 'useCaseId', label: 'sv.useCase', type: 'select', col: 'col-md-6',
        options: useCases.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` })) },
      { name: 'given', label: 'sv.given', type: 'textarea', rows: 2, maxLength: 5000, help: 'sv.stepsHelp' },
      { name: 'when', label: 'sv.when', type: 'textarea', rows: 2, maxLength: 5000 },
      { name: 'then', label: 'sv.then', type: 'textarea', rows: 2, maxLength: 5000 },
      { name: 'examples', label: 'sv.examples', type: 'code', rows: 3, maxLength: 5000, help: 'sv.examplesHelp' },
    ],
    columns: [
      { key: 'title', label: 'sa.title' },
      { key: 'userStoryId', label: 'sv.feature', render: (r) => storyName[r.userStoryId] ?? '—' },
      { key: 'tags', label: 'sv.tags', render: (r) => (r.tags ? <code className="small">{r.tags}</code> : '—') },
    ],
    filters: [{ name: 'userStoryId', label: 'sv.feature', options: stories.map((s) => ({ value: s.id, label: s.code })) }],
  };
}

// ---------- CRISP-DM ----------
export function objectiveConfig(t) {
  return {
    singular: 'project.tabs.objectives',
    fields: [
      { name: 'type', label: 'dm.objectiveType', type: 'select', required: true, options: opts(t, 'objectiveType'), default: 'business', col: 'col-md-6' },
      { name: 'priority', label: 'dm.priority', type: 'integer', min: 1, max: 5, col: 'col-md-3' },
      { name: 'achieved', label: 'dm.achieved', type: 'select', col: 'col-md-3',
        options: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }] },
      { name: 'description', label: 'project.description', type: 'textarea', required: true, maxLength: 5000 },
      { name: 'successCriteria', label: 'dm.successCriteria', type: 'textarea', maxLength: 5000 },
    ],
    transform: (p) => ({ ...p, achieved: p.achieved == null ? null : p.achieved === 'true' }),
    columns: [
      { key: 'type', label: 'dm.objectiveType', render: (r) => t(`enums.objectiveType.${r.type}`) },
      { key: 'description', label: 'project.description', render: (r) => <span className="kt-prewrap">{r.description}</span> },
      { key: 'priority', label: 'dm.priority' },
      { key: 'achieved', label: 'dm.achieved', render: (r) => (r.achieved == null ? '—' : t(r.achieved ? 'common.yes' : 'common.no')) },
    ],
    nameOf: (r) => r.description.slice(0, 40),
  };
}

export function datasetConfig() {
  return {
    singular: 'dm.dataset',
    fields: [
      { name: 'name', label: 'dm.datasetName', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'source', label: 'dm.source', maxLength: 200, col: 'col-md-3' },
      { name: 'format', label: 'dm.format', maxLength: 50, col: 'col-md-3' },
      { name: 'location', label: 'dm.location', maxLength: 1000 },
      { name: 'rowCount', label: 'dm.rowCount', type: 'integer', min: 0, col: 'col-md-3' },
      { name: 'columnCount', label: 'dm.columnCount', type: 'integer', min: 0, col: 'col-md-3' },
      { name: 'sizeBytes', label: 'dm.sizeBytes', type: 'integer', min: 0, col: 'col-md-3' },
      { name: 'collectedAt', label: 'dm.collectedAt', type: 'date', col: 'col-md-3' },
      { name: 'description', label: 'project.description', type: 'textarea' },
      { name: 'qualityNotes', label: 'dm.qualityNotes', type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'dm.datasetName' },
      { key: 'source', label: 'dm.source' },
      { key: 'format', label: 'dm.format' },
      { key: 'rowCount', label: 'dm.rowCount', render: (r) => r.rowCount?.toLocaleString() ?? '—' },
    ],
  };
}

export function fieldConfig(t) {
  return {
    singular: 'dm.fieldName',
    fields: [
      { name: 'name', label: 'dm.fieldName', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'dataType', label: 'dm.dataType', type: 'select', required: true, options: opts(t, 'dataType'), default: 'numeric', col: 'col-md-3' },
      { name: 'role', label: 'dm.role', type: 'select', required: true, options: opts(t, 'fieldRole'), default: 'feature', col: 'col-md-3' },
      { name: 'missingPct', label: 'dm.missingPct', type: 'number', min: 0, max: 100, col: 'col-md-3' },
      { name: 'uniqueCount', label: 'dm.uniqueCount', type: 'integer', min: 0, col: 'col-md-3' },
      { name: 'description', label: 'project.description', type: 'textarea', maxLength: 5000 },
      { name: 'stats', label: 'dm.stats', type: 'json', rows: 4 },
    ],
    columns: [
      { key: 'name', label: 'dm.fieldName' },
      { key: 'dataType', label: 'dm.dataType', render: (r) => t(`enums.dataType.${r.dataType}`) },
      { key: 'role', label: 'dm.role', render: (r) => t(`enums.fieldRole.${r.role}`) },
      { key: 'missingPct', label: 'dm.missingPct', render: (r) => r.missingPct ?? '—' },
    ],
  };
}

export function preparationConfig(t, datasets = []) {
  const dsOptions = datasets.map((d) => ({ value: d.id, label: d.name }));
  const dsName = Object.fromEntries(datasets.map((d) => [d.id, d.name]));
  return {
    singular: 'project.tabs.preparation',
    fields: [
      { name: 'stepOrder', label: 'dm.stepOrder', type: 'integer', required: true, min: 1, col: 'col-md-2' },
      { name: 'operation', label: 'dm.operation', type: 'select', required: true, options: opts(t, 'operation'), default: 'clean', col: 'col-md-4' },
      { name: 'datasetId', label: 'dm.dataset', type: 'select', options: dsOptions, col: 'col-md-6' },
      { name: 'description', label: 'project.description', type: 'textarea', required: true, maxLength: 5000 },
      { name: 'rationale', label: 'dm.rationale', type: 'textarea', maxLength: 5000 },
      { name: 'codeRef', label: 'dm.codeRef', maxLength: 1000 },
    ],
    columns: [
      { key: 'stepOrder', label: 'dm.stepOrder' },
      { key: 'operation', label: 'dm.operation', render: (r) => t(`enums.operation.${r.operation}`) },
      { key: 'datasetId', label: 'dm.dataset', render: (r) => dsName[r.datasetId] ?? '—' },
      { key: 'description', label: 'project.description', render: (r) => <span className="kt-prewrap">{r.description}</span> },
    ],
    nameOf: (r) => `#${r.stepOrder}`,
  };
}

export function modelConfig(t, datasets = []) {
  const dsOptions = datasets.map((d) => ({ value: d.id, label: d.name }));
  return {
    singular: 'dm.modelName',
    fields: [
      { name: 'name', label: 'dm.modelName', required: true, maxLength: 200, col: 'col-md-6' },
      { name: 'technique', label: 'dm.technique', type: 'select', required: true, options: opts(t, 'technique'), default: 'classification', col: 'col-md-3' },
      { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'modelStatus'), default: 'candidate', col: 'col-md-3' },
      { name: 'algorithm', label: 'dm.algorithm', maxLength: 200, col: 'col-md-6' },
      { name: 'trainingDatasetId', label: 'dm.trainingDataset', type: 'select', options: dsOptions, col: 'col-md-6' },
      { name: 'hyperparameters', label: 'dm.hyperparameters', type: 'json', rows: 4 },
      { name: 'assumptions', label: 'dm.assumptions', type: 'textarea', maxLength: 5000 },
      { name: 'artifactUri', label: 'dm.artifactUri', maxLength: 1000 },
      { name: 'notes', label: 'sa.notes', type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'dm.modelName' },
      { key: 'technique', label: 'dm.technique', render: (r) => t(`enums.technique.${r.technique}`) },
      { key: 'algorithm', label: 'dm.algorithm' },
      { key: 'status', label: 'common.status', render: (r) => badge(t(`enums.modelStatus.${r.status}`),
        ['approved', 'deployed'].includes(r.status) ? 'text-bg-success' : 'text-bg-light border') },
    ],
  };
}

export function metricConfig(t) {
  return {
    singular: 'dm.metric',
    fields: [
      { name: 'metric', label: 'dm.metric', required: true, maxLength: 50, col: 'col-md-5' },
      { name: 'value', label: 'dm.value', type: 'number', required: true, col: 'col-md-3' },
      { name: 'split', label: 'dm.split', type: 'select', required: true, options: opts(t, 'split'), default: 'test', col: 'col-md-4' },
      { name: 'notes', label: 'sa.notes', type: 'textarea', maxLength: 2000 },
    ],
    columns: [
      { key: 'metric', label: 'dm.metric' },
      { key: 'value', label: 'dm.value' },
      { key: 'split', label: 'dm.split', render: (r) => t(`enums.split.${r.split}`) },
    ],
  };
}

// ---------- Endereços (perfil) ----------
export function addressConfig(t) {
  return {
    singular: 'profile.addresses',
    fields: [
      { name: 'street', label: 'profile.street', required: true, maxLength: 200, col: 'col-md-8' },
      { name: 'number', label: 'profile.number', maxLength: 20, col: 'col-md-4' },
      { name: 'complement', label: 'profile.complement', maxLength: 200, col: 'col-md-6' },
      { name: 'district', label: 'profile.district', maxLength: 200, col: 'col-md-6' },
      { name: 'city', label: 'profile.city', required: true, maxLength: 200, col: 'col-md-5' },
      { name: 'state', label: 'profile.state', required: true, maxLength: 50, col: 'col-md-3' },
      { name: 'postalCode', label: 'profile.postalCode', maxLength: 20, col: 'col-md-4' },
      { name: 'country', label: 'profile.country', maxLength: 2, default: 'BR', col: 'col-md-3' },
      { name: 'isPrimary', label: 'profile.isPrimary', type: 'checkbox', col: 'col-md-9 pt-md-4' },
    ],
    columns: [
      { key: 'street', label: 'profile.street', render: (r) => [r.street, r.number, r.complement].filter(Boolean).join(', ') },
      { key: 'city', label: 'profile.city', render: (r) => `${r.city} / ${r.state}` },
      { key: 'postalCode', label: 'profile.postalCode' },
      { key: 'isPrimary', label: 'profile.isPrimary', render: (r) => (r.isPrimary ? <i className="bi bi-check-lg text-success" aria-label={t('common.yes')} /> : '') },
    ],
    nameOf: (r) => r.street,
  };
}
