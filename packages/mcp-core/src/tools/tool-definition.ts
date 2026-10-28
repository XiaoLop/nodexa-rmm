import type { Device, DeviceGroup, MeshCentralClient } from '@meshcentral/control-client';
import type { z } from 'zod';

import type { AuditWriter } from '../audit/audit-log';
import type { McpConfig } from '../config/mcp-config';
import type { ConnectionInfo } from '../connection/connection-manager';
import type { SnapshotCache } from '../query/snapshot-cache';
import type { McpPluginClient, PluginDevice, PluginGroup } from '../plugin/plugin-client';

export type ToolScope = 'devices:read' | 'groups:read' | 'events:read' | 'server:read';

export interface ToolAnnotations {
  readonly readOnlyHint: true;
  readonly idempotentHint: true;
  readonly openWorldHint: false;
}

export interface ToolResult {
  readonly data: unknown;
  readonly truncated?: boolean;
  readonly note?: string;
}

export interface ToolContext {
  readonly client: MeshCentralClient;
  readonly plugin?: McpPluginClient;
  pluginDevices(): Promise<readonly PluginDevice[]>;
  pluginGroups(): Promise<readonly PluginGroup[]>;
  readonly config: McpConfig;
  readonly audit: AuditWriter;
  readonly connection: ConnectionInfo;
  readonly devices: SnapshotCache<readonly Device[]>;
  readonly groups: SnapshotCache<readonly DeviceGroup[]>;
  now(): number;
}

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodType;
  readonly annotations: ToolAnnotations;
  readonly scope: ToolScope;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export function pluginDeviceToDevice(device: PluginDevice): Device {
  return {
    id: device.id,
    name: device.name ?? device.id,
    online: device.connected ?? device.state === 'online',
    ...(device.groupId === null ? {} : { groupId: device.groupId }),
  };
}

export function pluginGroupToGroup(group: PluginGroup): DeviceGroup {
  return {
    id: group.id,
    name: group.name ?? group.id,
  };
}

export const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
};
