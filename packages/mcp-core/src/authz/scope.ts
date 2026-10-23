import type { Device } from '@meshcentral/control-client';

import type { McpScope } from '../config/mcp-config';
import { McpToolError } from '../errors';

export function hasScope(scope: McpScope | undefined): scope is McpScope {
  return scope !== undefined && (scope.devices.length > 0 || scope.deviceGroups.length > 0);
}

export function isDeviceAllowed(device: Device, scope: McpScope | undefined): boolean {
  if (!hasScope(scope)) return true;

  if (scope.devices.includes(device.id)) return true;

  if (scope.deviceGroups.length > 0) {
    if (device.groupId !== undefined && scope.deviceGroups.includes(device.groupId)) return true;
    if (device.groupName !== undefined && scope.deviceGroups.includes(device.groupName)) return true;
  }

  return false;
}

export function filterDevices(devices: readonly Device[], scope: McpScope | undefined): Device[] {
  if (!hasScope(scope)) return [...devices];
  return devices.filter((device) => isDeviceAllowed(device, scope));
}

export function assertDeviceAllowed(device: Device, scope: McpScope | undefined): void {
  if (isDeviceAllowed(device, scope)) return;
  throw new McpToolError(
    'FORBIDDEN',
    `Device ${device.id} is outside the configured MCP scope.`,
    { hint: 'Adjust MESHCENTRAL_MCP_SCOPE_DEVICES or MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS.' },
  );
}

export function assertGroupAllowed(
  group: { readonly id: string; readonly name: string },
  scope: McpScope | undefined,
): void {
  if (!hasScope(scope) || scope.deviceGroups.length === 0) return;
  if (scope.deviceGroups.includes(group.id) || scope.deviceGroups.includes(group.name)) return;
  throw new McpToolError(
    'FORBIDDEN',
    `Device group ${group.id} is outside the configured MCP scope.`,
    { hint: 'Adjust MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS.' },
  );
}
