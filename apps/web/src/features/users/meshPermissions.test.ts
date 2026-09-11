import { describe, expect, it } from 'vitest';
import {
  MESH_RIGHT_ADMIN,
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
    expect(summarizeMeshRights(0x8 | 0x10)).toBe('远程桌面控制、终端控制台');
    expect(summarizeMeshRights(0x8 | 0x10 | 0x20)).toContain('等 3 项');
  });
});
