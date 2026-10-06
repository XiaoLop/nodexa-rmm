import { MeshCentralProtocolError } from '../errors';
import type {
  ServerFileEntry,
  ServerFileSpace,
  ServerFileTree,
} from '../serverFiles.types';
import { isRecord } from './normalizers';

function finiteNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeEntry(
  name: string,
  value: unknown,
  parentPath: readonly string[],
): ServerFileEntry | undefined {
  if (!isRecord(value) || (value.t !== 2 && value.t !== 3)) return undefined;
  const path = [...parentPath, name];
  if (value.t === 2) {
    return {
      name,
      kind: 'directory',
      path,
      children: normalizeEntries(value.f, path),
    };
  }
  const entry: ServerFileEntry = { name, kind: 'file', path };
  const size = finiteNonNegativeNumber(value.s);
  const modifiedAt = finiteNonNegativeNumber(value.d);
  if (size !== undefined) entry.size = size;
  if (modifiedAt !== undefined) entry.modifiedAt = new Date(modifiedAt);
  return entry;
}

function normalizeEntries(value: unknown, parentPath: readonly string[]): ServerFileEntry[] {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([name, entry]) => normalizeEntry(name, entry, parentPath))
    .filter((entry): entry is ServerFileEntry => entry !== undefined);
}

function usedBytes(entries: readonly ServerFileEntry[]): number {
  return entries.reduce(
    (total, entry) =>
      total + (entry.kind === 'file' ? (entry.size ?? 0) : usedBytes(entry.children ?? [])),
    0,
  );
}

function normalizeSpace(id: string, value: unknown): ServerFileSpace | undefined {
  if (!isRecord(value) || (value.t !== 1 && value.t !== 4)) return undefined;
  const entries = normalizeEntries(value.f, [id]);
  const space: ServerFileSpace = {
    id,
    name: typeof value.n === 'string' && value.n ? value.n : id,
    kind: value.t === 1 ? 'user' : 'mesh',
    path: [id],
    usedBytes: usedBytes(entries),
    entries,
  };
  const maxBytes = finiteNonNegativeNumber(value.maxbytes);
  if (maxBytes !== undefined) space.maxBytes = maxBytes;
  return space;
}

export function normalizeServerFileTree(value: unknown): ServerFileTree {
  if (!isRecord(value) || value.action !== 'files' || !isRecord(value.filetree)) {
    throw new MeshCentralProtocolError('Server files response has an invalid root structure.');
  }
  const spacesRecord = value.filetree.f;
  if (!isRecord(spacesRecord)) {
    throw new MeshCentralProtocolError('Server files response does not contain file spaces.');
  }
  return {
    spaces: Object.entries(spacesRecord)
      .map(([id, space]) => normalizeSpace(id, space))
      .filter((space): space is ServerFileSpace => space !== undefined),
    receivedAt: new Date(),
  };
}