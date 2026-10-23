import { Buffer } from 'node:buffer';

import { McpToolError } from '../errors';

const CURSOR_VERSION = 1;

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly nextCursor?: string;
}

export interface PageOptions<T> {
  readonly limit: number;
  readonly cursor?: string;
  readonly id: (item: T) => string;
}

export function encodeCursor(after: string): string {
  return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, after }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { v?: unknown; after?: unknown };
    if (parsed.v !== CURSOR_VERSION || typeof parsed.after !== 'string' || parsed.after.length === 0) {
      throw new Error('invalid cursor payload');
    }
    return parsed.after;
  } catch {
    throw new McpToolError('INVALID_ARGUMENT', 'The pagination cursor is invalid.', {
      hint: 'Retry the call without a cursor to start from the first page.',
    });
  }
}

export function paginate<T>(items: readonly T[], options: PageOptions<T>): Page<T> {
  const sorted = [...items].sort((left, right) => compareIds(options.id(left), options.id(right)));
  const after = options.cursor === undefined ? undefined : decodeCursor(options.cursor);

  let from = 0;
  if (after !== undefined) {
    const index = sorted.findIndex((item) => compareIds(options.id(item), after) > 0);
    from = index === -1 ? sorted.length : index;
  }

  const slice = sorted.slice(from, from + options.limit);
  const hasMore = from + slice.length < sorted.length;
  const last = slice[slice.length - 1];

  return {
    items: slice,
    total: sorted.length,
    ...(hasMore && last ? { nextCursor: encodeCursor(options.id(last)) } : {}),
  };
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
