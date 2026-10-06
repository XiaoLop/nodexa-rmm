import { describe, expect, it } from 'vitest';
import type { ServerFileSpace } from '@meshcentral/control-client';
import {
  containsLikelyBinaryData,
  findServerFileEntries,
  hasServerFileNameConflict,
  isEditableServerFile,
  nearestExistingPath,
  serverFileCommandAvailability,
  sortServerFileEntries,
} from './serverFileViewModel';

const space: ServerFileSpace = {
  id: 'user//admin',
  name: 'My Files',
  kind: 'user',
  path: ['user//admin'],
  usedBytes: 10,
  entries: [
    { name: 'z.txt', kind: 'file', path: ['user//admin', 'z.txt'], size: 10 },
    {
      name: 'docs',
      kind: 'directory',
      path: ['user//admin', 'docs'],
      children: [{ name: 'a.json', kind: 'file', path: ['user//admin', 'docs', 'a.json'] }],
    },
  ],
};

describe('serverFileViewModel', () => {
  it('finds directories and falls back to the nearest existing path', () => {
    expect(findServerFileEntries(space, ['user//admin', 'docs'])?.[0]?.name).toBe('a.json');
    expect(nearestExistingPath(space, ['user//admin', 'docs', 'missing'])).toEqual([
      'user//admin',
      'docs',
    ]);
  });

  it('sorts directories before files', () => {
    expect(sortServerFileEntries(space.entries).map((entry) => entry.name)).toEqual([
      'docs',
      'z.txt',
    ]);
  });

  it('detects editable files, binary content, and command availability', () => {
    const textFile = space.entries[0]!;
    const directory = space.entries[1]!;
    expect(isEditableServerFile(textFile)).toBe(true);
    expect(containsLikelyBinaryData(Uint8Array.from([65, 66, 67]))).toBe(false);
    expect(containsLikelyBinaryData(Uint8Array.from([0, 0, 65]))).toBe(true);
    expect(serverFileCommandAvailability([textFile])).toMatchObject({
      download: true,
      edit: true,
      rename: true,
      copy: true,
      move: true,
    });
    expect(serverFileCommandAvailability([directory])).toMatchObject({
      copy: false,
      move: false,
    });
    expect(serverFileCommandAvailability([textFile, directory])).toMatchObject({
      copy: false,
      move: false,
    });
  });

  it('detects destination name conflicts case-insensitively', () => {
    expect(hasServerFileNameConflict(space, ['user//admin'], ['Z.TXT'])).toBe(true);
    expect(hasServerFileNameConflict(space, ['user//admin', 'docs'], ['new.txt'])).toBe(false);
  });
});