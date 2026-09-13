import { isFullRights, normalizeRights } from './bitmask';
import { MeshRight, hasMeshRight } from './meshRights';

export type DesktopAccess = 'denied' | 'view-only' | 'limited-input' | 'control';

export function getDesktopAccess(rights: number): DesktopAccess {
  const normalized = normalizeRights(rights);
  if (isFullRights(normalized)) return 'control';
  if (!hasMeshRight(normalized, MeshRight.RemoteControl)) return 'denied';
  if (hasMeshRight(normalized, MeshRight.NoDesktop)) return 'denied';
  if (hasMeshRight(normalized, MeshRight.RemoteViewOnly)) return 'view-only';
  if (hasMeshRight(normalized, MeshRight.DesktopLimitedInput)) return 'limited-input';
  return 'control';
}

export function canUseTerminal(rights: number): boolean {
  const normalized = normalizeRights(rights);
  return (
    isFullRights(normalized) ||
    (hasMeshRight(normalized, MeshRight.RemoteControl) &&
      !hasMeshRight(normalized, MeshRight.NoTerminal))
  );
}

export function canUseDeviceFiles(rights: number): boolean {
  const normalized = normalizeRights(rights);
  return (
    isFullRights(normalized) ||
    (hasMeshRight(normalized, MeshRight.RemoteControl) &&
      !hasMeshRight(normalized, MeshRight.NoFiles))
  );
}

export function canUseAgentConsole(rights: number): boolean {
  return hasMeshRight(rights, MeshRight.AgentConsole);
}

export function canUseServerFiles(rights: number): boolean {
  return hasMeshRight(rights, MeshRight.ServerFiles);
}