import { describe, expect, it } from 'vitest';
import { moveLocally } from '../pages/projects/Kanban.jsx';

const board = {
  columns: [
    { id: 'todo', cards: [{ id: 'a', columnId: 'todo' }, { id: 'b', columnId: 'todo' }, { id: 'c', columnId: 'todo' }] },
    { id: 'done', cards: [{ id: 'd', columnId: 'done' }] },
  ],
};
const ids = (b) => b.columns.map((c) => c.cards.map((card) => card.id));

describe('Kanban: movimento local', () => {
  it('reordena dentro da mesma coluna', () => {
    expect(ids(moveLocally(board, 'a', 'todo', 2))).toEqual([['b', 'c', 'a'], ['d']]);
  });

  it('muda de coluna e atualiza columnId', () => {
    const next = moveLocally(board, 'b', 'done', 0);
    expect(ids(next)).toEqual([['a', 'c'], ['b', 'd']]);
    expect(next.columns[1].cards[0].columnId).toBe('done');
  });

  it('posição além do fim vai para o fim; cartão inexistente não muda nada', () => {
    expect(ids(moveLocally(board, 'a', 'done', 99))).toEqual([['b', 'c'], ['d', 'a']]);
    expect(moveLocally(board, 'x', 'done', 0)).toBe(board);
  });
});
