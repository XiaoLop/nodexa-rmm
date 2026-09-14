import { composeRights, hasAllRights, normalizeRights } from './bitmask';
import { composeMeshRights, hasMeshRight, normalizeMeshRights } from './meshRights';

export const UserGroupMemberRight = {
  Member: 0x00000001,
} as const;

export const UserGroupFlag = {
  SessionRecording: 0x00000002,
} as const;

export function normalizeUserGroupMemberRights(rights: number | undefined): number {
  return normalizeRights(rights);
}

export function hasUserGroupMemberRight(rights: number, required: number): boolean {
  return hasAllRights(rights, required);
}

export function composeUserGroupFlags(flags: readonly number[]): number {
  return composeRights(flags);
}

export function hasUserGroupFlag(flags: number, required: number): boolean {
  return hasAllRights(flags, required);
}

export function normalizeUserGroupConsent(consent: number | undefined): number {
  return normalizeRights(consent);
}

export function normalizeUserGroupTargetRights(rights: number): number {
  return normalizeMeshRights(rights);
}

export function hasUserGroupTargetRight(rights: number, required: number): boolean {
  return hasMeshRight(rights, required);
}

export function composeUserGroupTargetRights(rights: readonly number[]): number {
  return composeMeshRights(rights);
}