import { describe, expect, it } from 'vitest';
import {
  DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
  DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK,
} from '@meshcentral/control-client';
import {
  DEVICE_PERMISSIONS,
  DEVICE_RIGHT_FULL,
  DEVICE_USER_GROUP_PERMISSIONS,
  DEVICE_USER_PERMISSIONS,
  MESH_RIGHT_ADMIN,
  MESH_PERMISSION_PRESETS,
  canUseTerminal,
  composeMeshRights,
  hasMeshRight,
  normalizeMeshRights,
  summarizeMeshRights,
} from './meshPermissions';

describe('mesh permissions', () => {
  it('composes and checks unsigned permission masks', () => {
    const rights = composeMeshRights([0x8, 0x10, 0x20]);
    expect(rights).toBe(56);
    expect(hasMeshRight(rights, 0x10)).toBe(true);
    expect(hasMeshRight(rights, 0x4)).toBe(false);
    expect(normalizeMeshRights(-1)).toBe(MESH_RIGHT_ADMIN);
    expect(hasMeshRight(MESH_RIGHT_ADMIN, 0x800000)).toBe(true);
  });

  it('summarizes common and administrator permissions', () => {
    expect(summarizeMeshRights(MESH_RIGHT_ADMIN)).toBe('全部权限');
    expect(summarizeMeshRights(0)).toBe('仅设备组可见');
    expect(summarizeMeshRights(0x8 | 0x10)).toBe('远程桌面控制、Mesh Agent 控制台');
    expect(summarizeMeshRights(0x8 | 0x10 | 0x20)).toContain('等 3 项');

    const mockT = (key: string, options?: Record<string, unknown>) => {
      if (key === 'permissions.summary.allRights') return 'Full permissions';
      if (key === 'permissions.summary.groupOnly') return 'Group visibility only';
      if (key === 'permissions.summary.separator') return ', ';
      if (key === 'permissions.mesh.remoteDesktop.label') return 'Remote desktop';
      if (key === 'permissions.mesh.agentConsole.label') return 'Agent console';
      if (key === 'permissions.summary.itemsAndMore') {
        return `${options?.items} etc ${options?.count} items`;
      }
      return key;
    };

    expect(summarizeMeshRights(MESH_RIGHT_ADMIN, mockT)).toBe('Full permissions');
    expect(summarizeMeshRights(0, mockT)).toBe('Group visibility only');
    expect(summarizeMeshRights(0x8 | 0x10, mockT)).toBe('Remote desktop, Agent console');
  });

  it('evaluates terminal capability without treating administrator restriction bits as denial', () => {
    expect(canUseTerminal(MESH_RIGHT_ADMIN)).toBe(true);
    expect(canUseTerminal(0x8)).toBe(true);
    expect(canUseTerminal(0x8 | 0x200)).toBe(false);
    expect(canUseTerminal(0x10)).toBe(false);
  });

  it('uses the server-supported permission set for direct device grants', () => {
    expect(DEVICE_RIGHT_FULL).toBe(0x0000c0f8);
    expect(new Set(DEVICE_USER_PERMISSIONS.map(({ flag }) => flag))).toEqual(
      new Set([
        0x00000008,
        0x00000010,
        0x00000020,
        0x00000040,
        0x00000080,
        0x00004000,
        0x00008000,
      ]),
    );
    expect(DEVICE_USER_GROUP_PERMISSIONS).toEqual(DEVICE_USER_PERMISSIONS);
    expect(DEVICE_PERMISSIONS).toBe(DEVICE_USER_PERMISSIONS);
    expect(DEVICE_USER_ASSIGNABLE_RIGHTS_MASK).toBe(DEVICE_RIGHT_FULL);
    expect(DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK).toBe(DEVICE_RIGHT_FULL);
  });

  it('provides presets using standard MeshCentral permission bits', () => {
    expect(MESH_PERMISSION_PRESETS.find(({ key }) => key === 'files-only')?.rights).toBe(
      0x00000008 | 0x00000200 | 0x00010000,
    );
    expect(MESH_PERMISSION_PRESETS.find(({ key }) => key === 'desktop-only')?.rights).toBe(
      0x00000008 | 0x00000200 | 0x00000400,
    );
  });
});
