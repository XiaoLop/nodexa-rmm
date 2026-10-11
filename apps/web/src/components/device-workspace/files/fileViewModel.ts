import type { FileEntry } from '@meshcentral/relay';

const typeOrder: Record<FileEntry['kind'], number> = {
  drive: 0,
  directory: 1,
  file: 2,
  unknown: 3,
};

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortFileEntries(entries: readonly FileEntry[]): FileEntry[] {
  return [...entries].sort(
    (left, right) =>
      typeOrder[left.kind] - typeOrder[right.kind] || nameCollator.compare(left.name, right.name),
  );
}

export function formatFileSize(value?: number): string {
  if (value === undefined) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

export function isZipEntry(entry: FileEntry | undefined): boolean {
  return entry?.kind === 'file' && entry.name.toLowerCase().endsWith('.zip');
}

export interface FileCommandAvailability {
  download: boolean;
  rename: boolean;
  copy: boolean;
  move: boolean;
  remove: boolean;
  zip: boolean;
  unzip: boolean;
}

export function fileCommandAvailability(entries: readonly FileEntry[]): FileCommandAvailability {
  const single = entries.length === 1 ? entries[0] : undefined;
  const allFiles = entries.length > 0 && entries.every((entry) => entry.kind === 'file');
  const hasDrive = entries.some((entry) => entry.kind === 'drive');
  return {
    download: single?.kind === 'file',
    rename: Boolean(single && single.kind !== 'drive'),
    copy: allFiles,
    move: allFiles,
    remove: entries.length > 0 && !hasDrive,
    zip: entries.length > 0 && !hasDrive,
    unzip: isZipEntry(single),
  };
}

export function retainExistingSelection(
  selectedPaths: readonly string[],
  entries: readonly FileEntry[],
): string[] {
  const existing = new Set(entries.map((entry) => entry.path));
  return selectedPaths.filter((path) => existing.has(path));
}
