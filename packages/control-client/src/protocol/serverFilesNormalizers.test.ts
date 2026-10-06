import { describe, expect, it } from 'vitest';
import { MeshCentralProtocolError } from '../errors';
import { normalizeServerFileTree } from './serverFilesNormalizers';

describe('normalizeServerFileTree', () => {
  it('normalizes user and mesh spaces with nested entries and usage', () => {
    const result = normalizeServerFileTree({
      action: 'files',
      filetree: {
        n: 'Root',
        f: {
          'user//admin': {
            t: 1,
            n: 'My Files',
            maxbytes: 1000,
            f: {
              documents: {
                t: 2,
                f: {
                  'notes.txt': { t: 3, s: 120, d: 1710500000000 },
                },
              },
              'readme.md': { t: 3, s: 30 },
            },
          },
          'mesh//group': { t: 4, n: 'Production', f: {} },
        },
      },
    });

    expect(result.spaces).toHaveLength(2);
    expect(result.spaces[0]).toMatchObject({
      id: 'user//admin',
      name: 'My Files',
      kind: 'user',
      path: ['user//admin'],
      maxBytes: 1000,
      usedBytes: 150,
    });
    expect(result.spaces[0]?.entries[0]).toMatchObject({
      name: 'documents',
      kind: 'directory',
      path: ['user//admin', 'documents'],
    });
    expect(result.spaces[0]?.entries[0]?.children?.[0]).toMatchObject({
      name: 'notes.txt',
      kind: 'file',
      path: ['user//admin', 'documents', 'notes.txt'],
      size: 120,
      modifiedAt: new Date(1710500000000),
    });
    expect(result.spaces[1]).toMatchObject({
      id: 'mesh//group',
      name: 'Production',
      kind: 'mesh',
      usedBytes: 0,
      entries: [],
    });
  });

  it('ignores invalid child nodes while retaining the containing space', () => {
    const result = normalizeServerFileTree({
      action: 'files',
      filetree: {
        f: {
          'user//admin': {
            t: 1,
            f: {
              invalid: { t: 99 },
              valid: { t: 3, s: 5 },
            },
          },
        },
      },
    });

    expect(result.spaces[0]?.entries).toHaveLength(1);
    expect(result.spaces[0]?.entries[0]?.name).toBe('valid');
  });

  it('rejects invalid root structures', () => {
    expect(() => normalizeServerFileTree({ action: 'files' })).toThrow(MeshCentralProtocolError);
    expect(() =>
      normalizeServerFileTree({ action: 'files', filetree: { n: 'Root' } }),
    ).toThrow(MeshCentralProtocolError);
  });
});