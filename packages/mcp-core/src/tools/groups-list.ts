import { z } from 'zod';

import { hasScope } from '../authz/scope';
import { paginate } from '../query/pagination';
import { projectGroup, type GroupSummary } from '../query/projection';
import {
  pluginGroupToGroup,
  pluginDeviceToDevice,
  READ_ONLY_ANNOTATIONS,
  type ToolDefinition,
  type ToolResult,
} from './tool-definition';

const inputSchema = z.object({
  nameContains: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe('Case-insensitive substring match applied locally to the group name.'),
  includeDeviceCount: z
    .boolean()
    .optional()
    .describe(
      'Include total and online device counts per group. Costs one extra device list read.',
    ),
  limit: z.number().int().min(1).max(200).optional().describe('Page size. Defaults to 50.'),
  cursor: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('Opaque cursor copied from a previous response nextCursor field.'),
});

export const groupsListTool: ToolDefinition = {
  name: 'groups_list',
  title: 'List MeshCentral device groups',
  description:
    'Lists device groups (MeshCentral "meshes") visible to the signed-in account. Fields are limited to id, name and description; device counts are opt-in because they require reading the full device list.',
  inputSchema,
  annotations: READ_ONLY_ANNOTATIONS,
  scope: 'groups:read',
  async execute(rawInput, context): Promise<ToolResult> {
    const input = inputSchema.parse(rawInput ?? {});
    const groups = context.plugin
      ? (await context.pluginGroups()).map(pluginGroupToGroup)
      : await context.groups.get(() => context.client.groups.list());

    const scoped =
      hasScope(context.config.scope) && context.config.scope.deviceGroups.length > 0
        ? groups.filter(
            (group) =>
              context.config.scope?.deviceGroups.includes(group.id) === true ||
              context.config.scope?.deviceGroups.includes(group.name) === true,
          )
        : groups;

    const needle = input.nameContains?.toLowerCase();
    const filtered =
      needle === undefined
        ? scoped
        : scoped.filter((group) => group.name.toLowerCase().includes(needle));

    const page = paginate(filtered, {
      limit: input.limit ?? context.config.limits.defaultPageSize,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      id: (group) => group.id,
    });

    const counts = input.includeDeviceCount === true ? await loadCounts(context) : undefined;
    const items: GroupSummary[] = page.items.map((group) =>
      projectGroup(group, counts?.get(group.id)),
    );

    return {
      data: {
        items,
        total: page.total,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      },
    };
  },
};

async function loadCounts(
  context: Parameters<ToolDefinition['execute']>[1],
): Promise<Map<string, { total: number; online: number }>> {
  const devices = context.plugin
    ? (await context.pluginDevices()).map(pluginDeviceToDevice)
    : await context.devices.get(() => context.client.devices.list());
  const counts = new Map<string, { total: number; online: number }>();
  for (const device of devices) {
    if (device.groupId === undefined) continue;
    const current = counts.get(device.groupId) ?? { total: 0, online: 0 };
    current.total += 1;
    if (device.online) current.online += 1;
    counts.set(device.groupId, current);
  }
  return counts;
}
