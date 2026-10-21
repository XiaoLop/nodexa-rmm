import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { deviceLocationSearchValues } from '../device-location/formatDeviceLocation';
import { deviceDescription, deviceTags } from '../../utils/device';

export type { PowerAction } from '@meshcentral/control-client';

export const UNGROUPED_GROUP_ID = '__ungrouped__';

export interface DeviceFilterValues {
  query: string;
  groupId: string;
  online: string;
  platform: string;
}

export interface DeviceInviteServerInfo {
  name: string;
  port: number;
  https: boolean;
  magenturl: string;
}

export function rawString(device: Device, key: string): string | undefined {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function rawNumber(device: Device, key: string): number | undefined {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function deviceCreationTime(device: Device): number {
  return rawNumber(device, 'creation') ?? rawNumber(device, 'firstconnect') ?? 0;
}

export function nameCategory(name: string): number {
  const firstChar = name.trim().charAt(0);
  if (/^\d$/.test(firstChar)) return 0;
  if (/^[a-z]$/.test(firstChar)) return 1;
  if (/^[A-Z]$/.test(firstChar)) return 3;
  return 2;
}

export function matchesDeviceFilters(
  device: Device,
  filters: DeviceFilterValues,
  groupById: ReadonlyMap<string, DeviceGroup>,
): boolean {
  const normalized = filters.query.trim().toLowerCase();
  const matchesQuery =
    !normalized ||
    [
      device.name,
      device.id,
      device.platform,
      device.groupName,
      rawString(device, 'ip'),
      rawString(device, 'host'),
      deviceDescription(device),
      ...deviceTags(device),
      ...deviceLocationSearchValues(device.location),
    ].some((value) => value?.toLowerCase().includes(normalized));
  const matchesGroup =
    !filters.groupId ||
    (filters.groupId === UNGROUPED_GROUP_ID
      ? !device.groupId || !groupById.has(device.groupId)
      : device.groupId === filters.groupId);
  const matchesOnline = filters.online === 'all' || device.online === (filters.online === 'online');
  const matchesPlatform = filters.platform === 'all' || device.platform === filters.platform;
  return matchesQuery && matchesGroup && matchesOnline && matchesPlatform;
}

export function buildDeviceInviteServerInfo(meshAgentsUrl: string): DeviceInviteServerInfo {
  const url = new URL(meshAgentsUrl);
  return {
    name: url.hostname,
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    https: url.protocol === 'https:',
    magenturl: meshAgentsUrl,
  };
}
