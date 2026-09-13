import { FULL_RIGHTS, hasAllRights, normalizeRights } from './bitmask';

export const SiteRight = {
  ServerBackup: 0x00000001,
  ManageUsers: 0x00000002,
  ServerRestore: 0x00000004,
  FileAccess: 0x00000008,
  ServerUpdate: 0x00000010,
  Locked: 0x00000020,
  NoNewGroups: 0x00000040,
  NoMeshCommand: 0x00000080,
  ManageUserGroups: 0x00000100,
  Recordings: 0x00000200,
  LockSettings: 0x00000400,
  AllEvents: 0x00000800,
  NoNewDevices: 0x00001000,
  Administrator: FULL_RIGHTS,
} as const;

export function hasSiteRight(rights: number, required: number): boolean {
  return hasAllRights(rights, required);
}

export function isSiteAdministrator(rights: number): boolean {
  return normalizeRights(rights) === SiteRight.Administrator;
}

export function isSiteAccountLocked(rights: number): boolean {
  return !isSiteAdministrator(rights) && hasSiteRight(rights, SiteRight.Locked);
}

export function setSiteAccountLocked(rights: number, locked: boolean): number {
  const normalized = normalizeRights(rights);
  return locked
    ? (normalized | SiteRight.Locked) >>> 0
    : (normalized & ~SiteRight.Locked) >>> 0;
}