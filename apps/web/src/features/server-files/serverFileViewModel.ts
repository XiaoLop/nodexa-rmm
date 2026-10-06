import type { ServerFileEntry, ServerFileSpace } from '@meshcentral/control-client';

const textExtensions = new Set([
  'bat',
  'conf',
  'css',
  'csv',
  'html',
  'ini',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'ps1',
  'sh',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

export function findServerFileEntries(
  space: ServerFileSpace | undefined,
  path: readonly string[],
): ServerFileEntry[] | undefined {
  if (!space || path[0] !== space.id) return undefined;
  let entries = space.entries;
  for (const segment of path.slice(1)) {
    const directory = entries.find(
      (entry) => entry.kind === 'directory' && entry.name === segment,
    );
    if (!directory) return undefined;
    entries = directory.children ?? [];
  }
  return entries;
}

export function nearestExistingPath(space: ServerFileSpace, path: readonly string[]): string[] {
  const candidate = path[0] === space.id ? [...path] : [space.id];
  while (candidate.length > 1 && !findServerFileEntries(space, candidate)) candidate.pop();
  return candidate;
}

export function sortServerFileEntries(entries: readonly ServerFileEntry[]): ServerFileEntry[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function isEditableServerFile(entry: ServerFileEntry): boolean {
  if (entry.kind !== 'file') return false;
  const extension = entry.name.split('.').pop()?.toLowerCase();
  return Boolean(extension && textExtensions.has(extension));
}

export function containsLikelyBinaryData(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  let nulCount = 0;
  for (const byte of data) if (byte === 0) nulCount += 1;
  return nulCount / data.length > 0.01;
}

export function formatServerFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
  if (bytes < 1024 ** 3)
    return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

export function serverFileCommandAvailability(selected: readonly ServerFileEntry[]) {
  const single = selected.length === 1 ? selected[0] : undefined;
  const hasOnlyFiles = selected.length > 0 && selected.every((entry) => entry.kind === 'file');
  return {
    download: single?.kind === 'file',
    edit: Boolean(single && isEditableServerFile(single)),
    rename: Boolean(single),
    copy: hasOnlyFiles,
    move: hasOnlyFiles,
    remove: selected.length > 0,
  };
}

export function hasServerFileNameConflict(
  space: ServerFileSpace | undefined,
  path: readonly string[],
  names: readonly string[],
): boolean {
  const entries = findServerFileEntries(space, path);
  if (!entries) return true;
  const normalized = new Set(names.map((name) => name.toLocaleLowerCase()));
  return entries.some((entry) => normalized.has(entry.name.toLocaleLowerCase()));
}