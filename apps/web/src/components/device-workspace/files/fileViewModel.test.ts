import type { FileEntry } from '@meshcentral/relay';
import { describe, expect, it } from 'vitest';
import {
  fileCommandAvailability,
  formatFileSize,
  isZipEntry,
  retainExistingSelection,
  sortFileEntries,
} from './fileViewModel';

const entry = (name: string, kind: FileEntry['kind']): FileEntry => ({
  name,
  kind,
  path: `/${name}`,
  raw: {},
});

describe('fileViewModel', () => {
  it('sorts drives, directories, files, and names naturally', () => {
    expect(
      sortFileEntries([
        entry('file10', 'file'),
        entry('folder', 'directory'),
        entry('C:', 'drive'),
        entry('file2', 'file'),
      ]).map((item) => item.name),
    ).toEqual(['C:', 'folder', 'file2', 'file10']);
  });

  it('formats sizes and recognizes zip files case-insensitively', () => {
    expect(formatFileSize(1536)).toBe('1.50 KB');
    expect(isZipEntry(entry('archive.ZIP', 'file'))).toBe(true);
    expect(isZipEntry(entry('archive.zip', 'directory'))).toBe(false);
  });

  it('only enables copy and move when every selection is a file', () => {
    expect(fileCommandAvailability([entry('a.txt', 'file'), entry('b.txt', 'file')])).toMatchObject(
      {
        copy: true,
        move: true,
        download: false,
      },
    );
    expect(fileCommandAvailability([entry('folder', 'directory')])).toMatchObject({
      copy: false,
      move: false,
      remove: true,
      zip: true,
    });
  });

  it('disables rename, remove, zip, and file actions on drives', () => {
    expect(fileCommandAvailability([entry('C:', 'drive')])).toEqual({
      download: false,
      rename: false,
      copy: false,
      move: false,
      remove: false,
      zip: false,
      unzip: false,
    });
    expect(fileCommandAvailability([entry('C:', 'drive'), entry('D:', 'drive')])).toMatchObject({
      remove: false,
      zip: false,
      rename: false,
    });
    expect(fileCommandAvailability([entry('C:', 'drive'), entry('file.txt', 'file')])).toMatchObject({
      remove: false,
      zip: false,
      rename: false,
    });
  });

  it('removes stale paths from selection after refresh', () => {
    expect(retainExistingSelection(['/a', '/missing'], [entry('a', 'file')])).toEqual(['/a']);
  });
});
