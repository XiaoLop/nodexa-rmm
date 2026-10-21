import { describe, expect, it } from 'vitest';
import type { UserLink } from '@meshcentral/control-client';
import { permissionLabel, resolveAccessRows, type Translator } from './accessRows';

const englishTranslator: Translator = (key, options) => {
  switch (key) {
    case 'permissions.summary.separator':
      return ', ';
    case 'permissions.summary.itemsAndMore':
      return `${String(options?.items)} and ${String(options?.count)} more`;
    case 'permissions.mesh.remoteDesktop.label':
      return 'Remote desktop';
    case 'permissions.mesh.agentConsole.label':
      return 'Agent console';
    case 'permissions.mesh.serverFiles.label':
      return 'Server files';
    default:
      return key;
  }
};

const links: UserLink[] = [
  { id: 'group-b', type: 'device-group', rights: 0x8 },
  { id: 'group-a', type: 'device-group', rights: 0x8 | 0x10 },
  { id: 'user-group-1', type: 'user-group', rights: 0x8 },
  { id: 'device-1', type: 'device', rights: 0x8 },
];

const deviceGroups = [
  { id: 'group-a', name: 'Group A' },
  { id: 'group-b', name: 'Group B' },
];

describe('access rows', () => {
  it('localizes the rights summary when a translator is provided', () => {
    expect(permissionLabel(0x8 | 0x10, englishTranslator)).toBe(
      'Remote desktop, Agent console',
    );

    const rows = resolveAccessRows(links, 'device-group', deviceGroups, englishTranslator);
    const rowA = rows.find((row) => row.id === 'group-a');
    expect(rowA?.permission).toBe('Remote desktop, Agent console');
  });

  it('falls back to the link id when the resource is missing', () => {
    const rows = resolveAccessRows(
      [{ id: 'missing-group', type: 'device-group', rights: 0x8 }],
      'device-group',
      deviceGroups,
      englishTranslator,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('missing-group');
    expect(rows[0]?.id).toBe('missing-group');
  });

  it('filters links by type', () => {
    expect(resolveAccessRows(links, 'device-group', deviceGroups, englishTranslator).map((row) => row.id)).toEqual([
      'group-b',
      'group-a',
    ]);
    expect(resolveAccessRows(links, 'user-group', [], englishTranslator).map((row) => row.id)).toEqual([
      'user-group-1',
    ]);
    expect(resolveAccessRows(links, 'device', [], englishTranslator).map((row) => row.id)).toEqual([
      'device-1',
    ]);
  });

  it('preserves the server link order', () => {
    const orderedLinks: UserLink[] = [
      { id: 'group-b', type: 'device-group', rights: 0x8 },
      { id: 'group-a', type: 'device-group', rights: 0x8 | 0x10 },
    ];
    expect(
      resolveAccessRows(orderedLinks, 'device-group', deviceGroups, englishTranslator).map(
        (row) => row.id,
      ),
    ).toEqual(['group-b', 'group-a']);
  });
});
