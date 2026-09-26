import { describe, expect, it } from 'vitest';
import {
  DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
  DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK,
  hasOnlyAssignableRights,
  isAssignableDeviceUserGroupRight,
  isAssignableDeviceUserRight,
} from './assignableRights';
import { MeshRight } from './meshRights';

describe('single-device assignable rights', () => {
  it('matches the verified adddeviceuser rights contract', () => {
    expect(DEVICE_USER_ASSIGNABLE_RIGHTS_MASK).toBe(0x0000c0f8);
    expect(DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK).toBe(0x0000c0f8);
  });

  it('accepts each supported user and user-group right', () => {
    const supported = [
      MeshRight.RemoteControl,
      MeshRight.AgentConsole,
      MeshRight.ServerFiles,
      MeshRight.WakeDevice,
      MeshRight.SetNotes,
      MeshRight.ChatNotify,
      MeshRight.Uninstall,
    ];

    for (const right of supported) {
      expect(isAssignableDeviceUserRight(right)).toBe(true);
      expect(isAssignableDeviceUserGroupRight(right)).toBe(true);
    }
  });

  it('rejects unsupported, empty, and invalid rights', () => {
    expect(isAssignableDeviceUserRight(MeshRight.ManageComputers)).toBe(false);
    expect(isAssignableDeviceUserRight(MeshRight.RemoteViewOnly)).toBe(false);
    expect(
      isAssignableDeviceUserRight(MeshRight.RemoteControl | MeshRight.AgentConsole),
    ).toBe(false);
    expect(isAssignableDeviceUserRight(0)).toBe(false);
    expect(isAssignableDeviceUserRight(-1)).toBe(false);
    expect(isAssignableDeviceUserRight(0x100000000)).toBe(false);
  });

  it('validates complete assignable masks including removal value zero', () => {
    expect(hasOnlyAssignableRights(0, DEVICE_USER_ASSIGNABLE_RIGHTS_MASK)).toBe(true);
    expect(
      hasOnlyAssignableRights(
        DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
        DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
      ),
    ).toBe(true);
    expect(
      hasOnlyAssignableRights(
        DEVICE_USER_ASSIGNABLE_RIGHTS_MASK | MeshRight.RemoteCommand,
        DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
      ),
    ).toBe(false);
    expect(hasOnlyAssignableRights(0xffffffff, DEVICE_USER_ASSIGNABLE_RIGHTS_MASK)).toBe(false);
  });
});