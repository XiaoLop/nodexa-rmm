import {
  getDeviceGroupUiCapabilities,
  resolveEffectiveDeviceGroupRights,
  type Device,
  type DeviceGroup,
  type ServerInfo,
  type UserInfo,
} from '@meshcentral/control-client';

export interface DeviceGroupMoveClassification {
  allowed: Device[];
  denied: Device[];
  unknown: Device[];
  sameTarget: Device[];
}

type GroupPermission = 'allowed' | 'denied' | 'unknown';

function manageComputersPermission(
  group: DeviceGroup | undefined,
  userInfo: UserInfo | undefined,
  serverInfo: ServerInfo | undefined,
): GroupPermission {
  if (!group) return 'unknown';
  const capability = getDeviceGroupUiCapabilities(
    resolveEffectiveDeviceGroupRights(group, userInfo, serverInfo),
    true,
  ).manageComputers;
  if (capability.reason === 'permission-unknown') return 'unknown';
  return capability.enabled ? 'allowed' : 'denied';
}

export function classifyDeviceGroupMoves({
  devices,
  groups,
  targetGroupId,
  userInfo,
  serverInfo,
}: {
  devices: Device[];
  groups: DeviceGroup[];
  targetGroupId: string;
  userInfo?: UserInfo;
  serverInfo?: ServerInfo;
}): DeviceGroupMoveClassification {
  const result: DeviceGroupMoveClassification = {
    allowed: [],
    denied: [],
    unknown: [],
    sameTarget: [],
  };
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const targetPermission = manageComputersPermission(
    groupsById.get(targetGroupId),
    userInfo,
    serverInfo,
  );

  for (const device of devices) {
    if (device.groupId === targetGroupId) {
      result.sameTarget.push(device);
      continue;
    }
    const sourcePermission = manageComputersPermission(
      device.groupId ? groupsById.get(device.groupId) : undefined,
      userInfo,
      serverInfo,
    );
    if (sourcePermission === 'unknown' || targetPermission === 'unknown') {
      result.unknown.push(device);
    } else if (sourcePermission === 'denied' || targetPermission === 'denied') {
      result.denied.push(device);
    } else {
      result.allowed.push(device);
    }
  }

  return result;
}

export function manageableTargetGroups(
  groups: DeviceGroup[],
  userInfo: UserInfo | undefined,
  serverInfo: ServerInfo | undefined,
): DeviceGroup[] {
  return groups.filter(
    (group) =>
      manageComputersPermission(group, userInfo, serverInfo) === 'allowed',
  );
}