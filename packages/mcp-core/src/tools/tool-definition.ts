import type { Device, DeviceGroup, MeshCentralClient } from '@meshcentral/control-client';
import type { z } from 'zod';

import type { AuditWriter } from '../audit/audit-log';
import type { McpConfig } from '../config/mcp-config';
import type { ConnectionInfo } from '../connection/connection-manager';
import type { SnapshotCache } from '../query/snapshot-cache';

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

export const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
};
