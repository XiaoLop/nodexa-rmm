import { z } from 'zod';

import { READ_ONLY_ANNOTATIONS, type ToolDefinition, type ToolResult } from './tool-definition';

const inputSchema = z.object({
  includeDeviceCounts: z
    .boolean()
    .optional()
    .describe('Include total and online device counts. Defaults to true.'),
});

export const serverStatusTool: ToolDefinition = {
  name: 'server_status',
  title: 'Inspect the MCP connection',
  description:
    'Reports the state of the MCP process itself: control channel status, the signed-in MeshCentral account, cached server capability flags, and optional device counts. Use it to diagnose authentication or connectivity problems before running other tools.',
  inputSchema,
  annotations: READ_ONLY_ANNOTATIONS,
  scope: 'server:read',
  async execute(rawInput, context): Promise<ToolResult> {
    const input = inputSchema.parse(rawInput ?? {});
    const connection = context.connection;

    let counts: { total: number; online: number } | undefined;
    if (input.includeDeviceCounts !== false) {
      try {
        const devices = await context.devices.get(() => context.client.devices.list());
        counts = {
          total: devices.length,
          online: devices.filter((device) => device.online).length,
        };
      } catch {
        counts = undefined;
      }
    }

    return {
      data: {
        connection: {
          status: connection.status,
          reconnectAttempt: connection.reconnectAttempt,
          ...(connection.connectedAt === undefined ? {} : { connectedAt: connection.connectedAt }),
        },
        account: {
          ...(connection.userId === undefined ? {} : { userId: connection.userId }),
          ...(connection.userName === undefined ? {} : { userName: connection.userName }),
          ...(connection.siteAdmin === undefined ? {} : { siteAdmin: connection.siteAdmin }),
        },
        server: {
          ...(connection.features === undefined ? {} : { features: connection.features }),
        },
        ...(counts === undefined ? {} : { devices: counts }),
        serverUrl: context.config.serverUrl,
        authMode: context.config.auth.kind,
        ...(context.config.scope === undefined ? {} : { scope: context.config.scope }),
      },
    };
  },
};
