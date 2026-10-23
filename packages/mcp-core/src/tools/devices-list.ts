import { z } from 'zod';

import { filterDevices } from '../authz/scope';
import { paginate } from '../query/pagination';
import { projectDevice, type DeviceSummary } from '../query/projection';
import { READ_ONLY_ANNOTATIONS, type ToolDefinition, type ToolResult } from './tool-definition';

const inputSchema = z.object({
  groupId: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .describe('Only return devices that belong to this device group ID.'),
  online: z.boolean().optional().describe('When set, keep only online or only offline devices.'),
  nameContains: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe('Case-insensitive substring match applied locally to the device name.'),
  platform: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('Case-insensitive exact match on the reported platform, for example "windows".'),
  limit: z.number().int().min(1).max(200).optional().describe('Page size. Defaults to 50.'),
  cursor: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('Opaque cursor copied from a previous response nextCursor field.'),
});

type Input = z.infer<typeof inputSchema>;

export const devicesListTool: ToolDefinition = {
  name: 'devices_list',
  title: 'List MeshCentral devices',
  description:
    'Lists managed MeshCentral devices with lightweight fields only (id, name, group, online state, platform, agent version, last seen). Filtering by name and platform is performed locally on the full device list returned by MeshCentral; it is not a server-side search. Use devices_get to inspect one device in depth.',
  inputSchema,
  annotations: READ_ONLY_ANNOTATIONS,
  scope: 'devices:read',
  async execute(rawInput, context): Promise<ToolResult> {
    const input = inputSchema.parse(rawInput ?? {});
    const devices = await context.devices.get(() => context.client.devices.list());
    const scoped = filterDevices(devices, context.config.scope);
    const filtered = scoped.filter((device) => matches(device, input));
    const page = paginate(filtered, {
      limit: input.limit ?? context.config.limits.defaultPageSize,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      id: (device) => device.id,
    });

    const items: DeviceSummary[] = page.items.map(projectDevice);
    const onlineCount = scoped.filter((device) => device.online).length;

    return {
      data: {
        items,
        total: page.total,
        scopeTotal: scoped.length,
        onlineCount,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      },
      ...(input.nameContains === undefined && input.platform === undefined
        ? {}
        : {
            note: 'nameContains and platform are applied locally to the snapshot, not by the server.',
          }),
    };
  },
};

function matches(
  device: { name: string; online: boolean; platform?: string; groupId?: string },
  input: Input,
): boolean {
  if (input.groupId !== undefined && device.groupId !== input.groupId) return false;
  if (input.online !== undefined && device.online !== input.online) return false;
  if (input.nameContains !== undefined) {
    if (!device.name.toLowerCase().includes(input.nameContains.toLowerCase())) return false;
  }
  if (input.platform !== undefined) {
    if ((device.platform ?? '').toLowerCase() !== input.platform.toLowerCase()) return false;
  }
  return true;
}
