import { describe, expect, it } from 'vitest';

import { McpToolError } from '../errors';
import { decodeCursor, encodeCursor, paginate } from './pagination';

interface Item {
  id: string;
}

const items: Item[] = [
  { id: 'c' },
  { id: 'a' },
  { id: 'e' },
  { id: 'b' },
  { id: 'd' },
];

const id = (item: Item): string => item.id;

describe('paginate', () => {
  it('sorts by id and returns the first page', () => {
    const page = paginate(items, { limit: 2, id });
    expect(page.items.map(id)).toEqual(['a', 'b']);
    expect(page.total).toBe(5);
    expect(page.nextCursor).toBeDefined();
  });

  it('resumes after the cursor', () => {
    const first = paginate(items, { limit: 2, id });
    const second = paginate(items, { limit: 2, cursor: first.nextCursor, id });
    expect(second.items.map(id)).toEqual(['c', 'd']);
    expect(second.nextCursor).toBeDefined();
  });

  it('omits the cursor on the last page', () => {
    const first = paginate(items, { limit: 2, id });
    const second = paginate(items, { limit: 2, cursor: first.nextCursor, id });
    const third = paginate(items, { limit: 2, cursor: second.nextCursor, id });
    expect(third.items.map(id)).toEqual(['e']);
    expect(third.nextCursor).toBeUndefined();
  });

  it('returns an empty page when the cursor is past the end', () => {
    const page = paginate(items, { limit: 2, cursor: encodeCursor('z'), id });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(McpToolError);
    expect(() => paginate(items, { limit: 2, cursor: 'not-a-cursor', id })).toThrow(McpToolError);
  });

  it('round-trips the cursor payload', () => {
    expect(decodeCursor(encodeCursor('node//a'))).toBe('node//a');
  });
});
