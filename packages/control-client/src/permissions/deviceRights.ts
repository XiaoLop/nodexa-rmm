import type { Device, DeviceGroup, UserInfo } from '../types';
import { FULL_RIGHTS, normalizeRights } from './bitmask';
import { MeshRight } from './meshRights';

const REMOVED_POSITIVE_RIGHTS =
  MeshRight.RemoteControl |
  MeshRight.AgentConsole |
  MeshRight.WakeDevice |
  MeshRight.Uninstall |
  MeshRight.RemoteCommand |
  MeshRight.ResetOff;

const ADDED_RESTRICTION_RIGHTS =
  MeshRight.RemoteViewOnly |
  MeshRight.NoTerminal |
  MeshRight.NoFiles |
  MeshRight.NoDesktop |
  MeshRight.NoRegistry |
  MeshRight.NoSoftware;

const FULL_RIGHTS_RESTRICTION_BITS =
  ADDED_RESTRICTION_RIGHTS |
  MeshRight.NoAmt |
  MeshRight.DesktopLimitedInput |
  MeshRight.LimitEvents;

export interface EffectiveDeviceRightsResult {
  status: 'resolved' | 'unknown';
  rights?: number;
  sources: {
    directMesh?: number;
    userGroupMesh: number;
    directNode?: number;
    userGroupNode: number;
    removeRights: number;
  };
  reason?: 'missing-user' | 'missing-group' | 'missing-links' | 'unsupported-admin-rule';
  diagnostics?: Array<'direct-mesh-mismatch' | 'direct-node-mismatch'>;
}

export function applyUserDeviceRestrictions(rights: number, removeRights: number): number {
  const normalizedRemoveRights = normalizeRights(removeRights);
  const positiveRightsToRemove = normalizedRemoveRights & REMOVED_POSITIVE_RIGHTS;
  const restrictionsToAdd = normalizedRemoveRights & ADDED_RESTRICTION_RIGHTS;
  const expandedRights =
    normalizeRights(rights) === FULL_RIGHTS
      ? (FULL_RIGHTS & ~FULL_RIGHTS_RESTRICTION_BITS) >>> 0
      : normalizeRights(rights);
  return ((expandedRights & ~positiveRightsToRemove) | restrictionsToAdd) >>> 0;
}

function mergeRights(...rights: Array<number | undefined>): number {
  return rights.reduce<number>((merged, value) =>
    value === undefined ? merged : (merged | normalizeRights(value)) >>> 0, 0);
}

function directGrant(
  userInfo: UserInfo,
  resourceId: string,
  resourceGrant: number | undefined,
): { rights?: number; mismatch: boolean } {
  const userGrant = userInfo.links[resourceId]?.rights;
  return {
    rights:
      userGrant === undefined && resourceGrant === undefined
        ? undefined
        : mergeRights(userGrant, resourceGrant),
    mismatch:
      userGrant !== undefined &&
      resourceGrant !== undefined &&
      normalizeRights(userGrant) !== normalizeRights(resourceGrant),
  };
}

function userGroupGrant(userInfo: UserInfo, grants: Device['grants']): number {
  return Object.values(userInfo.links).reduce((rights, link) => {
    if (link.type !== 'user-group') return rights;
    return mergeRights(rights, grants?.[link.id]?.rights);
  }, 0);
}

export function resolveEffectiveDeviceRightsResult(
  device: Device,
  group: DeviceGroup | undefined,
  userInfo: UserInfo | undefined,
): EffectiveDeviceRightsResult {
  const emptySources = {
    userGroupMesh: 0,
    userGroupNode: 0,
    removeRights: userInfo?.removeRights ?? 0,
  };
  if (!userInfo) return { status: 'unknown', sources: emptySources, reason: 'missing-user' };

  const matchingGroup = group && device.groupId === group.id ? group : undefined;
  const directMesh = matchingGroup
    ? directGrant(userInfo, matchingGroup.id, matchingGroup.grants?.[userInfo.id]?.rights)
    : { rights: undefined, mismatch: false };
  const directNode = directGrant(userInfo, device.id, device.grants?.[userInfo.id]?.rights);
  const sources = {
    directMesh: directMesh.rights,
    userGroupMesh: userGroupGrant(userInfo, matchingGroup?.grants),
    directNode: directNode.rights,
    userGroupNode: userGroupGrant(userInfo, device.grants),
    removeRights: userInfo.removeRights,
  };
  const hasLinks =
    directMesh.rights !== undefined ||
    directNode.rights !== undefined ||
    sources.userGroupMesh !== 0 ||
    sources.userGroupNode !== 0;
  if (!hasLinks) {
    return {
      status: 'unknown',
      sources,
      reason: matchingGroup ? 'missing-links' : 'missing-group',
    };
  }

  const rights = applyUserDeviceRestrictions(
    mergeRights(
      sources.directMesh,
      sources.userGroupMesh,
      sources.directNode,
      sources.userGroupNode,
    ),
    sources.removeRights,
  );
  const diagnostics: EffectiveDeviceRightsResult['diagnostics'] = [];
  if (directMesh.mismatch) diagnostics.push('direct-mesh-mismatch');
  if (directNode.mismatch) diagnostics.push('direct-node-mismatch');
  return {
    status: 'resolved',
    rights: rights === -1 ? FULL_RIGHTS : rights,
    sources,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}

export function resolveEffectiveDeviceRights(
  device: Device,
  group: DeviceGroup | undefined,
  userInfo: UserInfo | undefined,
): number | undefined {
  return resolveEffectiveDeviceRightsResult(device, group, userInfo).rights;
}