import type { Device, DeviceGroup, MeshCentralClient } from '@meshcentral/control-client';
import type { McpPluginClient } from './plugin/plugin-client';

import { createAuditWriter, type AuditWriter } from './audit/audit-log';
import type { McpConfig } from './config/mcp-config';
import {
  ConnectionManager,
  type ClientProvider,
  type ConnectionManagerOptions,
} from './connection/connection-manager';
import { toMcpToolError } from './connection/error-mapper';
import { McpToolError } from './errors';
import { fitToBudget } from './query/projection';
import { SnapshotCache } from './query/snapshot-cache';
import { SessionManager } from './session/session-manager';
import { READ_ONLY_TOOLS, type ToolContext, type ToolDefinition } from './tools';

const DEVICE_SNAPSHOT_TTL_MS = 30_000;
const GROUP_SNAPSHOT_TTL_MS = 60_000;

export interface CallToolResult {
  readonly data: unknown;
  readonly truncated: boolean;
  readonly note?: string;
  readonly durationMs: number;
}

export interface ToolRuntime {
  listTools(): readonly ToolDefinition[];
  callTool(name: string, input: unknown): Promise<CallToolResult>;
  readonly info: ClientProvider['info'];
  close(): Promise<void>;
}

export interface CreateToolRuntimeOptions {
  readonly config: McpConfig;
  readonly audit?: AuditWriter;
  readonly session?: SessionManager;
  readonly provider?: ClientProvider;
  readonly plugin?: McpPluginClient;
  readonly connection?: Partial<ConnectionManagerOptions>;
  readonly tools?: readonly ToolDefinition[];
  readonly now?: () => number;
}

export function createToolRuntime(options: CreateToolRuntimeOptions): ToolRuntime {
  const config = options.config;
  const ownsAudit = options.audit === undefined;
  const audit = options.audit ?? createAuditWriter({ file: config.auditFile });
  const session = options.session ?? new SessionManager({ config });

  const connection: ClientProvider =
    options.provider ??
    new ConnectionManager({
      config,
      session,
      audit,
      ...options.connection,
    });

  const tools = options.tools ?? READ_ONLY_TOOLS;
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const now = options.now ?? Date.now;

  const devices = new SnapshotCache<readonly Device[]>({ ttlMs: DEVICE_SNAPSHOT_TTL_MS, now });
  const groups = new SnapshotCache<readonly DeviceGroup[]>({ ttlMs: GROUP_SNAPSHOT_TTL_MS, now });

  const plugin = options.plugin;
  const createContext = (client: MeshCentralClient): ToolContext => ({
    client,
    ...(plugin === undefined ? {} : { plugin }),
    pluginDevices: () =>
      plugin?.devicesList() ?? Promise.reject(new Error('MCP plugin is not configured.')),
    pluginGroups: () =>
      plugin?.groupsList() ?? Promise.reject(new Error('MCP plugin is not configured.')),
    config,
    audit,
    connection: connection.info,
    devices,
    groups,
    now,
  });

  return {
    listTools() {
      return tools;
    },

    get info() {
      return connection.info;
    },

    async callTool(name: string, input: unknown): Promise<CallToolResult> {
      const tool = toolsByName.get(name);
      if (!tool) {
        audit.toolCall({
          tool: name,
          args: input,
          ok: false,
          durationMs: 0,
          errorCode: 'UNKNOWN_TOOL',
          ...auditIdentity(connection.info),
          connection: {
            status: connection.info.status,
            reconnectAttempt: connection.info.reconnectAttempt,
          },
        });
        throw new McpToolError('UNKNOWN_TOOL', `Unknown tool: ${name}`, {
          hint: 'Call tools/list to see the available tools.',
        });
      }

      const parsed = tool.inputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        audit.toolCall({
          tool: name,
          args: input,
          ok: false,
          durationMs: 0,
          errorCode: 'INVALID_ARGUMENT',
          ...auditIdentity(connection.info),
          connection: {
            status: connection.info.status,
            reconnectAttempt: connection.info.reconnectAttempt,
          },
        });
        throw new McpToolError('INVALID_ARGUMENT', `Invalid arguments for ${name}.`, {
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.map((segment) => String(segment)).join('.'),
            message: issue.message,
          })),
          hint: 'Compare the arguments with the inputSchema returned by tools/list.',
        });
      }

      const args = parsed.data;
      const startedAt = now();

      try {
        const result = options.plugin
          ? await tool.execute(args, createContext(undefined as unknown as MeshCentralClient))
          : await connection.withClient((client) => tool.execute(args, createContext(client)));
        const durationMs = now() - startedAt;
        const budget = fitToBudget(result.data, config.limits.maxResponseBytes);

        audit.toolCall({
          tool: name,
          args,
          ok: true,
          durationMs,
          resultBytes: byteSize(budget.value),
          ...auditIdentity(connection.info),
          targetDevices: targetDevices(name, args),
          connection: {
            status: connection.info.status,
            reconnectAttempt: connection.info.reconnectAttempt,
          },
        });

        return {
          data: budget.value,
          truncated: budget.truncated || result.truncated === true,
          ...(result.note === undefined ? {} : { note: result.note }),
          durationMs,
        };
      } catch (error) {
        const mapped = toMcpToolError(error);
        audit.toolCall({
          tool: name,
          args,
          ok: false,
          durationMs: now() - startedAt,
          errorCode: mapped.code,
          ...auditIdentity(connection.info),
          targetDevices: targetDevices(name, args),
          connection: {
            status: connection.info.status,
            reconnectAttempt: connection.info.reconnectAttempt,
          },
        });
        throw mapped;
      }
    },

    async close(): Promise<void> {
      if (connection instanceof ConnectionManager) {
        await connection.destroy();
      } else if (ownsAudit) {
        await audit.close();
      }
    },
  };
}

function auditIdentity(info: ClientProvider['info']): { user?: string } {
  return info.userName === undefined ? {} : { user: info.userName };
}

function targetDevices(name: string, input: unknown): readonly string[] | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const record = input as Record<string, unknown>;
  if (name !== 'devices_get' && name !== 'events_query') return undefined;
  return typeof record.deviceId === 'string' ? [record.deviceId] : undefined;
}

function byteSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
  } catch {
    return 0;
  }
}
