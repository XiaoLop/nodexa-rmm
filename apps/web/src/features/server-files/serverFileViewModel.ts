import { MAX_SERVER_FILE_BYTES, type ServerFileEntry, type ServerFileSpace } from '@meshcentral/control-client';

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'ico',
  'bmp',
]);

export const SUPPORTED_TEXT_EXTENSIONS = new Set([
  'bat',
  'conf',
  'css',
  'csv',
  'env',
  'gitignore',
  'html',
  'ini',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'ps1',
  'py',
  'sh',
  'sql',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

export const MAX_PREVIEW_LIMIT_BYTES = MAX_SERVER_FILE_BYTES; // 200 KiB
export const MAX_EDIT_LIMIT_BYTES = MAX_SERVER_FILE_BYTES; // 200 KiB

export type ServerFileCategory = 'image' | 'text' | 'unsupported';

export function getServerFileCategory(entry: ServerFileEntry): ServerFileCategory {
  if (entry.kind !== 'file') return 'unsupported';
  const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';
  if (SUPPORTED_IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (SUPPORTED_TEXT_EXTENSIONS.has(extension)) return 'text';
  return 'unsupported';
}

export interface ServerFileEligibility {
  allowed: boolean;
  category: ServerFileCategory;
  reason?: 'unsupported_type' | 'size_exceeded';
}

export function canPreviewServerFile(entry: ServerFileEntry): ServerFileEligibility {
  const category = getServerFileCategory(entry);
  if (category === 'unsupported') {
    return { allowed: false, category, reason: 'unsupported_type' };
  }
  if ((entry.size ?? 0) >= MAX_PREVIEW_LIMIT_BYTES) {
    return { allowed: false, category, reason: 'size_exceeded' };
  }
  return { allowed: true, category };
}

export function canEditServerFile(entry: ServerFileEntry): ServerFileEligibility {
  const category = getServerFileCategory(entry);
  if (category !== 'text') {
    return { allowed: false, category, reason: 'unsupported_type' };
  }
  if ((entry.size ?? 0) >= MAX_EDIT_LIMIT_BYTES) {
    return { allowed: false, category, reason: 'size_exceeded' };
  }
  return { allowed: true, category };
}

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
  return Boolean(extension && SUPPORTED_TEXT_EXTENSIONS.has(extension));
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