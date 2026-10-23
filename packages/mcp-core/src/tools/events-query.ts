import { z } from 'zod';

import { McpToolError } from '../errors';
import { projectEvent, type EventSummary } from '../query/projection';
import { READ_ONLY_ANNOTATIONS, type ToolDefinition, type ToolResult } from './tool-definition';

const EVENT_FILTERS = [
  'agentlog',
  'relaylog',
  'manual',
  'runcommands',
  'batchupload',
  'changenode',
  'removenode',
] as const;

const inputSchema = z.object({
  scope: z
    .enum(['all', 'device', 'user'])
    .optional()
    .describe('Event scope. "device" requires deviceId, "user" requires userId. Defaults to "all".'),
  deviceId: z.string().min(1).max(256).optional().describe('Device ID when scope is "device".'),
  userId: z.string().min(1).max(256).optional().describe('User ID when scope is "user".'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Maximum events requested from MeshCentral (1-200). Defaults to 50.'),
  filter: z.enum(EVENT_FILTERS).optional().describe('MeshCentral historical event filter.'),
  since: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('ISO-8601 timestamp. Events older than this are dropped locally.'),
});

export const eventsQueryTool: ToolDefinition = {
  name: 'events_query',
  title: 'Query MeshCentral events',
  description:
    'Returns recent MeshCentral audit events, optionally scoped to one device or one user. MeshCentral has no time-range parameter for this action: the server returns the most recent N events (N <= 200) and any "since" filter is applied locally afterwards. When a since filter is used the result may be incomplete.',
  inputSchema,
  annotations: READ_ONLY_ANNOTATIONS,
  scope: 'events:read',
  async execute(rawInput, context): Promise<ToolResult> {
    const input = inputSchema.parse(rawInput ?? {});
    const scope = input.scope ?? 'all';
    const limit = input.limit ?? context.config.limits.defaultPageSize;

    if (scope === 'device' && input.deviceId === undefined) {
      throw new McpToolError('INVALID_ARGUMENT', 'deviceId is required when scope is "device".');
    }
    if (scope === 'user' && input.userId === undefined) {
      throw new McpToolError('INVALID_ARGUMENT', 'userId is required when scope is "user".');
    }

    const options = {
      limit,
      ...(input.filter === undefined ? {} : { filter: input.filter }),
    };

    const events =
      scope === 'device'
        ? await context.client.events.listByDevice(input.deviceId as string, options)
        : scope === 'user'
          ? await context.client.events.listByUser(input.userId as string, options)
          : await context.client.events.list(options);

    const since = input.since === undefined ? undefined : Date.parse(input.since);
    if (input.since !== undefined && Number.isNaN(since)) {
      throw new McpToolError('INVALID_ARGUMENT', `Invalid since timestamp: ${input.since}`, {
        hint: 'Use an ISO-8601 value such as 2026-01-01T00:00:00Z.',
      });
    }

    const filtered =
      since === undefined
        ? events
        : events.filter((event) => {
            const occurredAt = Date.parse(event.occurredAt);
            return Number.isFinite(occurredAt) && occurredAt >= since;
          });

    const items: EventSummary[] = filtered.map(projectEvent);

    return {
      data: {
        items,
        returned: items.length,
        requested: limit,
      },
      ...(input.since === undefined
        ? {}
        : {
            truncated: filtered.length < events.length,
            note: 'The since filter is applied locally because MeshCentral cannot filter this action by time; the server may have already truncated older events.',
          }),
    };
  },
};
