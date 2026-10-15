// Configuração dos recursos (espelha os schemas da API: systemAnalysis.*, crispdm.*, ontologies.*, bpm.*)
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
  ontologyFormat: ['rdf_xml', 'owl_xml', 'turtle', 'n_triples', 'n3', 'json_ld', 'rdfa', 'owl_functional', 'manchester', 'obo', 'xml', 'other'],
  vocabulary: ['rdf', 'rdfs', 'owl', 'schema', 'rdfa', 'skos', 'dublin_core', 'foaf', 'prov', 'dcat', 'shacl', 'geo', 'vcard', 'org', 'sioc', 'other'],
  principle: ['fair', 'care', 'five_star', 'trust', 'other'],
  ontologyStatus: ['draft', 'in_review', 'published', 'deprecated'],
  processLevel: ['macroprocess', 'process', 'subprocess', 'activity'],
  processStatus: ['identified', 'mapped', 'analyzed', 'improved'],
  diagramState: ['as_is', 'to_be'],
  diagramNotation: ['bpmn', 'image', 'pdf', 'other'],
  agentKind: ['human', 'information_system', 'other'],
  itemRole: ['core', 'support'],
  communicationType: ['request', 'require', 'order', 'propose', 'offer', 'agree', 'reject', 'ask', 'reply', 'report', 'inform'],
  fpCountType: ['development', 'enhancement', 'application'],
  fpType: ['ilf', 'eif', 'ei', 'eo', 'eq'],
  fpAction: ['add', 'change', 'delete'],
  complexity: ['low', 'average', 'high'],
  scrumRole: ['product_owner', 'scrum_master', 'developer', 'stakeholder'],
  itemType: ['story', 'bug', 'technical', 'spike'],
  itemStatus: ['new', 'ready', 'in_progress', 'done'],
  sprintStatus: ['planned', 'active', 'completed', 'cancelled'],
  taskStatus: ['todo', 'in_progress', 'done'],
  eventType: ['planning', 'daily', 'review', 'retrospective', 'refinement'],
};

// Extensões aceitas no upload (iguais às da API)
export const ONTOLOGY_FILES = '.owl,.rdf,.owx,.xml,.ttl,.nt,.nq,.n3,.trig,.jsonld,.json,.obo,.ofn,.omn,.html';
export const BPM_FILES = '.bpmn,.xml,.svg,.png,.jpg,.jpeg,.webp,.pdf';

export const opts = (t, name) => enumOptions(t, name, ENUMS[name]);
const label = (t, name) => (row, key) => (row[key] ? t(`enums.${name}.${row[key]}`) : '—');
export const badge = (text, cls = 'text-bg-light border') => <span className={`badge ${cls}`}>{text}</span>;

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

// ---------- Ontologias ----------
const fileMark = (t, row) =>
  row.fileName ? <i className="bi bi-file-earmark-check text-success" title={row.fileName} aria-label={row.fileName} /> : '—';

export function ontologyFields(t) {
  const count = (name, help) => ({ name, label: `on.${name}`, type: 'integer', min: 0, help, col: 'col-6 col-md-3' });
  return [
    { name: 'title', label: 'on.title', required: true, maxLength: 200, col: 'col-md-8' },
    { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'ontologyStatus'), default: 'draft', col: 'col-md-4' },
    { name: 'description', label: 'project.description', type: 'textarea', maxLength: 10000, rows: 3 },
    { name: 'format', label: 'on.format', type: 'select', options: opts(t, 'ontologyFormat'), col: 'col-md-4' },
    { name: 'version', label: 'on.version', maxLength: 50, col: 'col-md-2' },
    { name: 'iri', label: 'on.iri', type: 'url', maxLength: 1000, col: 'col-md-6' },
    { name: 'domain', label: 'on.domain', maxLength: 200, col: 'col-md-6' },
    { name: 'languages', label: 'on.languages', maxLength: 100, help: 'on.languagesHelp', col: 'col-md-3' },
    { name: 'license', label: 'on.license', maxLength: 200, col: 'col-md-3' },
    { name: 'keywords', label: 'on.keywords', maxLength: 500 },
    { name: 'creators', label: 'on.creators', type: 'textarea', rows: 2, maxLength: 2000, help: 'on.creatorsHelp' },
    count('classCount'),
    count('relationshipCount', 'on.relationshipHelp'),
    count('propertyCount', 'on.propertyHelp'),
    count('objectCount', 'on.objectHelp'),
    { name: 'vocabularies', label: 'on.vocabularies', type: 'multicheck', options: opts(t, 'vocabulary'), col: 'col-md-6' },
    { name: 'principles', label: 'on.principles', type: 'multicheck', options: opts(t, 'principle'), col: 'col-md-6' },
    { name: 'otherVocabularies', label: 'on.otherVocabularies', maxLength: 500, col: 'col-md-6' },
    { name: 'principlesNotes', label: 'on.principlesNotes', type: 'textarea', rows: 2, maxLength: 5000, col: 'col-md-6' },
    { name: 'publicationUrl', label: 'on.publicationUrl', type: 'url', maxLength: 1000, col: 'col-md-6' },
    { name: 'repositoryUrl', label: 'on.repositoryUrl', type: 'url', maxLength: 1000, col: 'col-md-6' },
    { name: 'competencyQuestions', label: 'on.competencyQuestions', type: 'textarea', rows: 4, maxLength: 20000, help: 'on.competencyHelp' },
    { name: 'notes', label: 'sa.notes', type: 'textarea', rows: 2, maxLength: 10000 },
  ];
}

export function ontologyConfig(t) {
  const quick = ['title', 'status', 'description', 'format', 'version', 'iri', 'publicationUrl'];
  const num = (key) => (r) => (r[key] == null ? '—' : r[key].toLocaleString());
  return {
    singular: 'on.ontology',
    // o cadastro rápido; o restante (métricas, vocabulários, arquivo) fica na página da ontologia
    fields: ontologyFields(t).filter((f) => quick.includes(f.name)),
    columns: [
      { key: 'title', label: 'on.title' },
      { key: 'format', label: 'on.format', render: (r) => (r.format ? t(`enums.ontologyFormat.${r.format}`) : '—') },
      { key: 'classCount', label: 'on.classCount', render: num('classCount') },
      { key: 'relationshipCount', label: 'on.relationshipCount', render: num('relationshipCount') },
      { key: 'propertyCount', label: 'on.propertyCount', render: num('propertyCount') },
      { key: 'objectCount', label: 'on.objectCount', render: num('objectCount') },
      { key: 'status', label: 'common.status',
        render: (r) => badge(t(`enums.ontologyStatus.${r.status}`), r.status === 'published' ? 'text-bg-success' : undefined) },
      { key: 'fileName', label: 'on.file', render: (r) => fileMark(t, r) },
    ],
    filters: [
      { name: 'format', label: 'on.format', options: opts(t, 'ontologyFormat') },
      { name: 'status', label: 'common.status', options: opts(t, 'ontologyStatus') },
    ],
    nameOf: (r) => r.title,
  };
}

// ---------- BPM ----------
export function processConfig(t, processes = []) {
  const options = processes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const code = Object.fromEntries(processes.map((p) => [p.id, p.code]));
  return {
    singular: 'bpm.process',
    fields: [
      { name: 'code', label: 'sa.code', required: true, maxLength: 20, help: 'bpm.codeHelp', col: 'col-md-3' },
      { name: 'name', label: 'bpm.name', required: true, maxLength: 200, col: 'col-md-9' },
      { name: 'level', label: 'bpm.level', type: 'select', required: true, options: opts(t, 'processLevel'), default: 'process', col: 'col-md-4' },
      { name: 'parentId', label: 'bpm.parent', type: 'select', options, col: 'col-md-4' },
      { name: 'status', label: 'common.status', type: 'select', required: true, options: opts(t, 'processStatus'), default: 'identified', col: 'col-md-4' },
      { name: 'owner', label: 'bpm.owner', maxLength: 200, col: 'col-md-6' },
      { name: 'trigger', label: 'bpm.trigger', maxLength: 2000, col: 'col-md-6' },
      { name: 'objective', label: 'bpm.objective', type: 'textarea', rows: 2, maxLength: 5000 },
      { name: 'description', label: 'project.description', type: 'textarea', rows: 3, maxLength: 10000 },
    ],
    columns: [
      { key: 'code', label: 'sa.code' },
      { key: 'name', label: 'bpm.name' },
      { key: 'level', label: 'bpm.level', render: (r) => t(`enums.processLevel.${r.level}`) },
      { key: 'parentId', label: 'bpm.parent', render: (r) => code[r.parentId] ?? '—' },
      { key: 'owner', label: 'bpm.owner' },
      { key: 'status', label: 'common.status', render: (r) => t(`enums.processStatus.${r.status}`) },
    ],
    filters: [
      { name: 'level', label: 'bpm.level', options: opts(t, 'processLevel') },
      { name: 'status', label: 'common.status', options: opts(t, 'processStatus') },
    ],
    nameOf: (r) => `${r.code} — ${r.name}`,
  };
}

// SIPOC e diagnóstico (página do processo)
export const SIPOC_FIELDS = ['suppliers', 'inputs', 'steps', 'outputs', 'customers'];
export const processDetailFields = () => [
  ...SIPOC_FIELDS.map((name) => ({ name, label: `bpm.${name}`, type: 'textarea', rows: 5, maxLength: 10000, col: 'col-md' })),
  ...['indicators', 'problems', 'improvements'].map((name) => ({
    name, label: `bpm.${name}`, type: 'textarea', rows: 4, maxLength: 10000, help: 'bpm.sipocHelp', col: 'col-md-4',
  })),
];

export function bpmDiagramConfig(t, processes = []) {
  const options = processes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const code = Object.fromEntries(processes.map((p) => [p.id, p.code]));
  return {
    singular: 'bpm.diagram',
    fields: [
      { name: 'title', label: 'sa.title', required: true, maxLength: 200, col: 'col-md-8' },
      { name: 'state', label: 'bpm.state', type: 'select', required: true, options: opts(t, 'diagramState'), default: 'as_is', col: 'col-md-4' },
      { name: 'processId', label: 'bpm.process', type: 'select', options, col: 'col-md-6' },
      { name: 'notation', label: 'bpm.notation', type: 'select', options: opts(t, 'diagramNotation'), col: 'col-md-3' },
      { name: 'version', label: 'bpm.version', maxLength: 20, col: 'col-md-3' },
      { name: 'tool', label: 'bpm.tool', maxLength: 100, help: 'bpm.toolHelp', col: 'col-md-6' },
      { name: 'url', label: 'bpm.url', type: 'url', maxLength: 1000, col: 'col-md-6' },
      { name: 'description', label: 'project.description', type: 'textarea', rows: 2, maxLength: 10000 },
    ],
    columns: [
      { key: 'title', label: 'sa.title' },
      { key: 'processId', label: 'bpm.process', render: (r) => code[r.processId] ?? '—' },
      { key: 'state', label: 'bpm.state', render: (r) => badge(t(`enums.diagramState.${r.state}`), r.state === 'to_be' ? 'text-bg-primary' : undefined) },
      { key: 'notation', label: 'bpm.notation', render: (r) => (r.notation ? t(`enums.diagramNotation.${r.notation}`) : '—') },
      { key: 'fileName', label: 'on.file', render: (r) => fileMark(t, r) },
    ],
    filters: [
      { name: 'processId', label: 'bpm.process', options: processes.map((p) => ({ value: p.id, label: p.code })) },
      { name: 'state', label: 'bpm.state', options: opts(t, 'diagramState') },
    ],
    nameOf: (r) => r.title,
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
