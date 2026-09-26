import { normalizeRights } from './bitmask';
import { MeshRight } from './meshRights';

export const DEVICE_USER_ASSIGNABLE_RIGHTS_MASK =
  MeshRight.RemoteControl |
  MeshRight.AgentConsole |
  MeshRight.ServerFiles |
  MeshRight.WakeDevice |
  MeshRight.SetNotes |
  MeshRight.ChatNotify |
  MeshRight.Uninstall;

export const DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK =
  DEVICE_USER_ASSIGNABLE_RIGHTS_MASK;

function isAssignableRight(flag: number, mask: number): boolean {
  if (!Number.isInteger(flag) || flag < 0 || flag > 0xffffffff) return false;
  const normalized = normalizeRights(flag);
  return (
    normalized !== 0 &&
    (normalized & (normalized - 1)) === 0 &&
    (normalized & ~mask) === 0
  );
}

export function isAssignableDeviceUserRight(flag: number): boolean {
  return isAssignableRight(flag, DEVICE_USER_ASSIGNABLE_RIGHTS_MASK);
}

export function isAssignableDeviceUserGroupRight(flag: number): boolean {
  return isAssignableRight(flag, DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK);
}

export function hasOnlyAssignableRights(rights: number, mask: number): boolean {
  if (!Number.isInteger(rights) || rights < 0 || rights > 0xffffffff) return false;
  return (normalizeRights(rights) & ~mask) === 0;
}