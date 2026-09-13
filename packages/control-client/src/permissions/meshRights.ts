import { FULL_RIGHTS, composeRights, hasAllRights, normalizeRights } from './bitmask';

export const MeshRight = {
  EditMesh: 0x00000001,
  ManageUsers: 0x00000002,
  ManageComputers: 0x00000004,
  RemoteControl: 0x00000008,
  AgentConsole: 0x00000010,
  ServerFiles: 0x00000020,
  WakeDevice: 0x00000040,
  SetNotes: 0x00000080,
  RemoteViewOnly: 0x00000100,
  NoTerminal: 0x00000200,
  NoFiles: 0x00000400,
  NoAmt: 0x00000800,
  DesktopLimitedInput: 0x00001000,
  LimitEvents: 0x00002000,
  ChatNotify: 0x00004000,
  Uninstall: 0x00008000,
  NoDesktop: 0x00010000,
  RemoteCommand: 0x00020000,
  ResetOff: 0x00040000,
  GuestSharing: 0x00080000,
  DeviceDetails: 0x00100000,
  Relay: 0x00200000,
  NoRegistry: 0x00400000,
  NoSoftware: 0x00800000,
  Administrator: FULL_RIGHTS,
} as const;

export function normalizeMeshRights(rights: number): number {
  return normalizeRights(rights);
}

export function hasMeshRight(rights: number, required: number): boolean {
  return hasAllRights(rights, required);
}

export function composeMeshRights(flags: readonly number[]): number {
  return composeRights(flags);
}