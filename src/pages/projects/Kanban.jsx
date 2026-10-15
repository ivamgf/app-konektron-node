// Kanban: quadro de tarefas de qualquer projeto (colunas e cartões ordenados)
import { useState } from 'react';
import { Link } from 'react-router';
import { kanbanApi } from '../../api/endpoints.js';
import { enumOptions, FieldGrid, toFormValues, toPayload } from '../../components/forms.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { EmptyState, Loading, Modal } from '../../components/ui.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { formatDate, useAsync, useSubmit } from '../../lib/hooks.js';
import { useProject } from './ProjectLayout.jsx';

export const CARD_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
// situação das tasks do Scrum que cada coluna representa (cartões publicados pela sprint)
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const sprintPath = (projectId, card) => `/projects/${projectId}/scrum/sprints/${card.sprintId}`;
const PRIORITY_CLASS = { low: 'text-bg-light border', medium: 'text-bg-info', high: 'text-bg-warning', urgent: 'text-bg-danger' };

const today = () => new Date().toISOString().slice(0, 10);

// Aplica um movimento no quadro local (resposta imediata; a API devolve o quadro oficial)
export function moveLocally(board, cardId, columnId, position) {
  let moving;
  const columns = board.columns.map((c) => {
    const cards = c.cards.filter((card) => {
      if (card.id !== cardId) return true;
      moving = card;
      return false;
    });
    return { ...c, cards };
  });
  if (!moving) return board;
  return {
    columns: columns.map((c) => {
      if (c.id !== columnId) return c;
      const cards = [...c.cards];
      cards.splice(Math.min(position, cards.length), 0, { ...moving, columnId });
      return { ...c, cards };
    }),
  };
}

function ColumnModal({ projectId, column, onClose, onSaved }) {
  const { t } = useI18n();
  const fields = [
    { name: 'name', label: 'kb.columnName', required: true, maxLength: 60, col: 'col-md-8' },
    { name: 'wipLimit', label: 'kb.wipLimit', type: 'integer', min: 1, max: 999, help: 'kb.wipHelp', col: 'col-md-4' },
    { name: 'taskStatus', label: 'kb.taskStatus', type: 'select', help: 'kb.taskStatusHelp',
      options: enumOptions(t, 'taskStatus', TASK_STATUSES) },
  ];
  const [values, setValues] = useState(() => toFormValues(fields, column ?? {}));
  const { submit, busy, errors } = useSubmit(
    (body) => (column ? kanbanApi.updateColumn(projectId, column.id, body) : kanbanApi.createColumn(projectId, body)),
    { onSuccess: onSaved },
  );
  return (
    <Modal
      title={t(column ? 'kb.editColumn' : 'kb.newColumn')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-kb-column" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="kt-kb-column" noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(fields, values, t)); }}>
        <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      </form>
    </Modal>
  );
}

function CardModal({ projectId, columns, card, columnId, onClose, onSaved, onDelete }) {
  const { t } = useI18n();
  const fields = [
    { name: 'title', label: 'sa.title', required: true, maxLength: 200 },
    { name: 'description', label: 'project.description', type: 'textarea', maxLength: 10000, rows: 4 },
    { name: 'columnId', label: 'kb.column', type: 'select', required: true, col: 'col-md-6',
      options: columns.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'priority', label: 'sa.priority', type: 'select', options: enumOptions(t, 'cardPriority', CARD_PRIORITIES), col: 'col-md-6' },
    { name: 'dueDate', label: 'kb.dueDate', type: 'date', col: 'col-md-6' },
    { name: 'assignee', label: 'kb.assignee', maxLength: 120, col: 'col-md-6' },
  ];
  const [values, setValues] = useState(() => toFormValues(fields, card ?? { columnId }));

  // A API não muda a coluna pelo PATCH: trocar de coluna vira um /move para o fim da nova
  const { submit, busy, errors } = useSubmit(async ({ columnId: target, ...body }) => {
    if (!card) return kanbanApi.createCard(projectId, { ...body, columnId: target });
    await kanbanApi.updateCard(projectId, card.id, body);
    if (target && target !== card.columnId) await kanbanApi.moveCard(projectId, card.id, target, Number.MAX_SAFE_INTEGER);
  }, { onSuccess: onSaved });

  return (
    <Modal
      title={t(card ? 'kb.editCard' : 'kb.newCard')}
      onClose={onClose}
      size="modal-lg"
      footer={
        <>
          {card && (
            <button type="button" className="btn btn-outline-danger me-auto" onClick={() => onDelete(card)}>
              <i className="bi bi-trash me-1" aria-hidden="true" />{t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="kt-kb-card" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      {card?.scrumTaskId && (
        <p className="kt-kb-linked">
          <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
          {t('kb.linkedTask', { number: card.sprintNumber })}{' '}
          <Link to={sprintPath(projectId, card)}>{t('kb.openSprint')}</Link>
        </p>
      )}
      <form id="kt-kb-card" noValidate onSubmit={(e) => { e.preventDefault(); submit(toPayload(fields, values, t)); }}>
        <FieldGrid fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
      </form>
    </Modal>
  );
}

function Card({ projectId, card, prev, next, onOpen, onMove, onDragStart, onDragEnd, onDragOver, dragging }) {
  const { t, locale } = useI18n();
  const overdue = card.dueDate && card.dueDate < today();
  return (
    <li
      className={`kt-kb-card ${card.priority ? `is-${card.priority}` : ''} ${dragging ? 'is-dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.id);
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <button type="button" className="kt-kb-card-title" onClick={() => onOpen(card)}>
        {card.title}
      </button>
      {(card.priority || card.dueDate || card.assignee || card.scrumTaskId) && (
        <div className="kt-kb-meta">
          {card.scrumTaskId && (
            <Link to={sprintPath(projectId, card)} className="kt-kb-sprint" title={t('kb.openSprint')}>
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              S{card.sprintNumber}{card.itemCode && ` · ${card.itemCode}`}
            </Link>
          )}
          {card.priority && (
            <span className={`badge ${PRIORITY_CLASS[card.priority]}`}>{t(`enums.cardPriority.${card.priority}`)}</span>
          )}
          {card.dueDate && (
            <span className={overdue ? 'text-danger fw-semibold' : ''} title={overdue ? t('kb.overdue') : t('kb.dueDate')}>
              <i className={`bi ${overdue ? 'bi-exclamation-circle' : 'bi-calendar-event'} me-1`} aria-hidden="true" />
              {formatDate(card.dueDate, locale)}
              {overdue && <span className="visually-hidden"> ({t('kb.overdue')})</span>}
            </span>
          )}
          {card.assignee && (
            <span><i className="bi bi-person me-1" aria-hidden="true" />{card.assignee}</span>
          )}
        </div>
      )}
      <div className="kt-kb-arrows">
        <button type="button" className="btn btn-sm btn-link" disabled={!prev} onClick={() => onMove(card, prev)}
          aria-label={`${t('kb.moveLeft')}: ${card.title}`} title={t('kb.moveLeft')}>
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-sm btn-link" disabled={!next} onClick={() => onMove(card, next)}
          aria-label={`${t('kb.moveRight')}: ${card.title}`} title={t('kb.moveRight')}>
          <i className="bi bi-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default function Kanban() {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useProject();
  const board = useAsync(() => kanbanApi.board(project.id), [project.id]);
  const [editingColumn, setEditingColumn] = useState(null); // null | 'new' | coluna
  const [editingCard, setEditingCard] = useState(null); // null | { card } | { columnId }
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null); // { columnId, index }
  const [creatingDefaults, setCreatingDefaults] = useState(false);

  if (board.loading && !board.data) return <Loading small />;
  if (!board.data) return null;
  const { columns } = board.data;

  const afterSave = () => {
    toast.success(t('common.saved'));
    setEditingColumn(null);
    setEditingCard(null);
    board.reload();
  };

  const run = async (action, optimistic) => {
    if (optimistic) board.setData(optimistic);
    try {
      const result = await action();
      if (result?.columns) board.setData(result);
      else board.reload();
    } catch (err) {
      toast.fromError(err);
      board.reload();
    }
  };

  const moveCard = (cardId, columnId, position) =>
    run(() => kanbanApi.moveCard(project.id, cardId, columnId, position), moveLocally(board.data, cardId, columnId, position));

  const moveColumn = (column, position) => run(() => kanbanApi.moveColumn(project.id, column.id, position));

  const removeColumn = (column) => {
    if (!window.confirm(t('kb.deleteColumn', { name: column.name, count: column.cards.length }))) return;
    run(async () => {
      await kanbanApi.removeColumn(project.id, column.id);
      toast.success(t('common.deleted'));
    });
  };

  const removeCard = (card) => {
    if (!window.confirm(t('common.confirmDelete', { name: card.title }))) return;
    setEditingCard(null);
    run(async () => {
      await kanbanApi.removeCard(project.id, card.id);
      toast.success(t('common.deleted'));
    });
  };

  const createDefaults = async () => {
    setCreatingDefaults(true);
    try {
      // já marcadas com a situação das tasks do Scrum que representam
      for (const [key, taskStatus] of [['todo', 'todo'], ['doing', 'in_progress'], ['done', 'done']]) {
        await kanbanApi.createColumn(project.id, { name: t(`kb.defaults.${key}`), taskStatus });
      }
    } catch (err) {
      toast.fromError(err);
    } finally {
      setCreatingDefaults(false);
      board.reload();
    }
  };

  // Posição de soltura: metade de cima do cartão = antes dele; de baixo = depois
  const overCard = (columnId, index) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { top, height } = e.currentTarget.getBoundingClientRect();
    const at = e.clientY < top + height / 2 ? index : index + 1;
    if (drop?.columnId !== columnId || drop.index !== at) setDrop({ columnId, index: at });
  };

  const onDrop = (column) => (e) => {
    e.preventDefault();
    const cardId = dragId ?? e.dataTransfer.getData('text/plain');
    const target = drop?.columnId === column.id ? drop.index : column.cards.length;
    setDragId(null);
    setDrop(null);
    if (!cardId) return;
    // o índice conta o próprio cartão; a API o remove antes de inserir
    const from = column.cards.findIndex((c) => c.id === cardId);
    const position = from !== -1 && from < target ? target - 1 : target;
    if (from === position) return;
    moveCard(cardId, column.id, position);
  };

  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  const modals = (
    <>
      {editingColumn && (
        <ColumnModal
          projectId={project.id}
          column={editingColumn === 'new' ? null : editingColumn}
          onClose={() => setEditingColumn(null)}
          onSaved={afterSave}
        />
      )}
      {editingCard && (
        <CardModal
          projectId={project.id}
          columns={columns}
          card={editingCard.card}
          columnId={editingCard.columnId}
          onClose={() => setEditingCard(null)}
          onSaved={afterSave}
          onDelete={removeCard}
        />
      )}
    </>
  );

  if (!columns.length) {
    return (
      <>
        <EmptyState>{t('kb.emptyBoard')}</EmptyState>
        <div className="d-flex flex-wrap justify-content-center gap-2 pb-3">
          <button type="button" className="btn btn-primary" onClick={createDefaults} disabled={creatingDefaults}>
            <i className="bi bi-magic me-1" aria-hidden="true" />
            {creatingDefaults ? t('common.saving') : t('kb.createDefaults')}
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={() => setEditingColumn('new')}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('kb.newColumn')}
          </button>
        </div>
        {modals}
      </>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p className="small text-body-secondary mb-0">
          <i className="bi bi-arrows-move me-1" aria-hidden="true" />{t('kb.dragHint')}
        </p>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditingColumn('new')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('kb.newColumn')}
        </button>
      </div>

      <div className="kt-kanban">
        {columns.map((column, ci) => {
          const overWip = column.wipLimit != null && column.cards.length > column.wipLimit;
          const titleId = `kt-kb-col-${column.id}`;
          const showDrop = (index) => dragId && drop?.columnId === column.id && drop.index === index;
          return (
            <section
              key={column.id}
              className={`kt-kb-col ${overWip ? 'is-over' : ''} ${drop?.columnId === column.id ? 'is-target' : ''}`}
              aria-labelledby={titleId}
            >
              <header className="kt-kb-col-header">
                <h3 id={titleId} className="h4 mb-0 text-truncate" title={column.name}>{column.name}</h3>
                <span className={`badge ${overWip ? 'text-bg-danger' : 'text-bg-light border'}`}
                  title={overWip ? t('kb.overWip') : t('kb.cards', { count: column.cards.length })}>
                  {column.cards.length}{column.wipLimit != null && ` / ${column.wipLimit}`}
                  {overWip && <span className="visually-hidden"> — {t('kb.overWip')}</span>}
                </span>
                <div className="kt-kb-col-actions ms-auto" role="group" aria-label={`${t('kb.columnActions')}: ${column.name}`}>
                  <button type="button" className="btn btn-sm btn-link" disabled={ci === 0}
                    onClick={() => moveColumn(column, ci - 1)} aria-label={t('kb.columnLeft')} title={t('kb.columnLeft')}>
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-sm btn-link" disabled={ci === columns.length - 1}
                    onClick={() => moveColumn(column, ci + 1)} aria-label={t('kb.columnRight')} title={t('kb.columnRight')}>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-sm btn-link" onClick={() => setEditingColumn(column)}
                    aria-label={t('kb.editColumn')} title={t('kb.editColumn')}>
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeColumn(column)}
                    aria-label={t('common.delete')} title={t('common.delete')}>
                    <i className="bi bi-trash" aria-hidden="true" />
                  </button>
                </div>
              </header>
              {column.taskStatus && (
                <p className="kt-kb-col-status">
                  <span className={`kt-kb-status is-${column.taskStatus}`}>
                    <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                    {t('kb.taskStatus')}: {t(`enums.taskStatus.${column.taskStatus}`)}
                  </span>
                </p>
              )}

              <ol
                className="kt-kb-list"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (drop?.columnId !== column.id) setDrop({ columnId: column.id, index: column.cards.length });
                }}
                onDrop={onDrop(column)}
              >
                {column.cards.map((card, i) => (
                  <FragmentWithDrop key={card.id} show={showDrop(i)}>
                    <Card
                      projectId={project.id}
                      card={card}
                      prev={columns[ci - 1]}
                      next={columns[ci + 1]}
                      dragging={dragId === card.id}
                      onOpen={(c) => setEditingCard({ card: c })}
                      onMove={(c, target) => moveCard(c.id, target.id, target.cards.length)}
                      onDragStart={setDragId}
                      onDragEnd={endDrag}
                      onDragOver={overCard(column.id, i)}
                    />
                  </FragmentWithDrop>
                ))}
                {showDrop(column.cards.length) && <li className="kt-kb-drop" aria-hidden="true" />}
              </ol>

              <button type="button" className="btn btn-sm kt-kb-add" onClick={() => setEditingCard({ columnId: column.id })}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true" />{t('kb.addCard')}
              </button>
            </section>
          );
        })}
      </div>
      {modals}
    </>
  );
}

// Marcador de onde o cartão arrastado vai entrar
function FragmentWithDrop({ show, children }) {
  return (
    <>
      {show && <li className="kt-kb-drop" aria-hidden="true" />}
      {children}
    </>
  );
}
