import type { DeviceGroup, ServerInfo, UserInfo } from '../types';
import { FULL_RIGHTS, normalizeRights } from './bitmask';

export interface EffectiveDeviceGroupRightsResult {
  status: 'resolved' | 'unknown';
  rights?: number;
  sources: {
    directGroup?: number;
    userGroupGroup: number;
    removeRights: number;
    manageAllDeviceGroups: boolean;
  };
  reason?: 'missing-user' | 'missing-links';
  diagnostics?: Array<'direct-group-mismatch'>;
}

function mergeRights(...rights: Array<number | undefined>): number {
  return rights.reduce<number>(
    (merged, value) =>
      value === undefined ? merged : (merged | normalizeRights(value)) >>> 0,
    0,
  );
}

function userGroupGrant(userInfo: UserInfo, group: DeviceGroup): number {
  return Object.values(userInfo.links).reduce((rights, link) => {
    if (link.type !== 'user-group') return rights;
    return mergeRights(rights, group.grants?.[link.id]?.rights);
  }, 0);
}

export function resolveEffectiveDeviceGroupRightsResult(
  group: DeviceGroup,
  userInfo: UserInfo | undefined,
  serverInfo?: ServerInfo,
): EffectiveDeviceGroupRightsResult {
  const manageAllDeviceGroups = serverInfo?.manageAllDeviceGroups === true;
  const emptySources = {
    userGroupGroup: 0,
    removeRights: userInfo?.removeRights ?? 0,
    manageAllDeviceGroups,
  };
  if (!userInfo) {
    return { status: 'unknown', sources: emptySources, reason: 'missing-user' };
  }
  if (manageAllDeviceGroups) {
    return { status: 'resolved', rights: FULL_RIGHTS, sources: emptySources };
  }

  const userLinkRights = userInfo.links[group.id]?.rights;
  const groupGrantRights = group.grants?.[userInfo.id]?.rights;
  const directGroup =
    userLinkRights === undefined && groupGrantRights === undefined
      ? undefined
      : mergeRights(userLinkRights, groupGrantRights);
  const userGroupGroup = userGroupGrant(userInfo, group);
  const sources = {
    directGroup,
    userGroupGroup,
    removeRights: userInfo.removeRights,
    manageAllDeviceGroups: false,
  };
  if (directGroup === undefined && userGroupGroup === 0) {
    return { status: 'unknown', sources, reason: 'missing-links' };
  }

  const diagnostics: EffectiveDeviceGroupRightsResult['diagnostics'] = [];
  if (
    userLinkRights !== undefined &&
    groupGrantRights !== undefined &&
    normalizeRights(userLinkRights) !== normalizeRights(groupGrantRights)
  ) {
    diagnostics.push('direct-group-mismatch');
  }
  return {
    status: 'resolved',
    rights: mergeRights(directGroup, userGroupGroup),
    sources,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}

export function resolveEffectiveDeviceGroupRights(
  group: DeviceGroup,
  userInfo: UserInfo | undefined,
  serverInfo?: ServerInfo,
): number | undefined {
  return resolveEffectiveDeviceGroupRightsResult(group, userInfo, serverInfo).rights;
}