import { describe, expect, it } from 'vitest';
import { FULL_RIGHTS } from './bitmask';
import { canUseDeviceFiles, canUseTerminal, getDesktopAccess } from './capabilities';
import { MeshRight, composeMeshRights } from './meshRights';

describe('mesh capabilities', () => {
  it('evaluates desktop access with restriction precedence', () => {
    expect(getDesktopAccess(FULL_RIGHTS)).toBe('control');
    expect(getDesktopAccess(0)).toBe('denied');
    expect(getDesktopAccess(MeshRight.RemoteControl)).toBe('control');
    expect(getDesktopAccess(MeshRight.RemoteControl | MeshRight.RemoteViewOnly)).toBe('view-only');
    expect(getDesktopAccess(MeshRight.RemoteControl | MeshRight.DesktopLimitedInput)).toBe(
      'limited-input',
    );
    expect(getDesktopAccess(MeshRight.RemoteControl | MeshRight.NoDesktop)).toBe('denied');
  });

  it('uses remote control as the terminal and device-file capability prerequisite', () => {
    const remoteControl = composeMeshRights([MeshRight.RemoteControl]);

    expect(canUseTerminal(remoteControl)).toBe(true);
    expect(canUseTerminal(remoteControl | MeshRight.NoTerminal)).toBe(false);
    expect(canUseTerminal(MeshRight.AgentConsole)).toBe(false);
    expect(canUseDeviceFiles(remoteControl)).toBe(true);
    expect(canUseDeviceFiles(remoteControl | MeshRight.NoFiles)).toBe(false);
    expect(canUseDeviceFiles(MeshRight.ServerFiles)).toBe(false);
  });
});