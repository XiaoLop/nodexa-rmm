import { describe, expect, it } from 'vitest';
import {
  DEVICE_PERMISSIONS,
  DEVICE_RIGHT_FULL,
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
  });

  it('evaluates terminal capability without treating administrator restriction bits as denial', () => {
    expect(canUseTerminal(MESH_RIGHT_ADMIN)).toBe(true);
    expect(canUseTerminal(0x8)).toBe(true);
    expect(canUseTerminal(0x8 | 0x200)).toBe(false);
    expect(canUseTerminal(0x10)).toBe(false);
  });

  it('uses the server-supported permission set for direct device grants', () => {
    expect(DEVICE_RIGHT_FULL & 0x00000200).toBe(0);
    expect(DEVICE_PERMISSIONS.map(({ flag }) => flag)).toContain(0x00010000);
    expect(DEVICE_PERMISSIONS.map(({ flag }) => flag)).toContain(0x00020000);
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
