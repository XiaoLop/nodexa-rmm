import { describe, expect, it } from 'vitest';
import { MeshRight } from './meshRights';
import {
  UserGroupFlag,
  UserGroupMemberRight,
  composeUserGroupFlags,
  composeUserGroupTargetRights,
  hasUserGroupFlag,
  hasUserGroupMemberRight,
  hasUserGroupTargetRight,
  normalizeUserGroupConsent,
  normalizeUserGroupMemberRights,
  normalizeUserGroupTargetRights,
} from './userGroupRights';

describe('user group rights', () => {
  it('recognizes active user group membership links', () => {
    expect(UserGroupMemberRight.Member).toBe(1);
    expect(hasUserGroupMemberRight(1, UserGroupMemberRight.Member)).toBe(true);
    expect(hasUserGroupMemberRight(0, UserGroupMemberRight.Member)).toBe(false);
    expect(normalizeUserGroupMemberRights(undefined)).toBe(0);
  });

  it('composes and checks user group flags', () => {
    const flags = composeUserGroupFlags([UserGroupFlag.SessionRecording]);

    expect(flags).toBe(2);
    expect(hasUserGroupFlag(flags, UserGroupFlag.SessionRecording)).toBe(true);
  });

  it('uses mesh rights for device group and device grants', () => {
    const rights = composeUserGroupTargetRights([
      MeshRight.RemoteControl,
      MeshRight.RemoteViewOnly,
      MeshRight.NoTerminal,
    ]);

    expect(rights).toBe(0x00000308);
    expect(hasUserGroupTargetRight(rights, MeshRight.RemoteControl)).toBe(true);
    expect(hasUserGroupTargetRight(rights, MeshRight.NoFiles)).toBe(false);
    expect(normalizeUserGroupTargetRights(-1)).toBe(MeshRight.Administrator);
  });

  it('normalizes consent as an unsigned protocol bitmask', () => {
    expect(normalizeUserGroupConsent(undefined)).toBe(0);
    expect(normalizeUserGroupConsent(-1)).toBe(0xffffffff);
  });
});