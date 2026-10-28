import { z } from 'zod';

import { assertDeviceAllowed, hasScope } from '../authz/scope';
import { McpToolError } from '../errors';
import { pickFields, projectDevice } from '../query/projection';
import {
  pluginDeviceToDevice,
  READ_ONLY_ANNOTATIONS,
  type ToolDefinition,
  type ToolResult,
} from './tool-definition';

const SYSTEM_FIELDS = [
  'hostname',
  'osdesc',
  'osname',
  'cpu',
  'cpucount',
  'totalmemory',
  'virtual',
  'hypervisor',
  'manufacturer',
  'product',
  'bios',
  'agentversion',
  'agentid',
  'disks',
  'volumes',
] as const;

const NETWORK_FIELDS = [
  'addresses',
  'dns',
  'gateway',
  'hostname',
  'netmask',
  'mac',
  'routing',
] as const;
const LAST_CONNECT_FIELDS = ['time', 'addr', 'connectTime', 'event', 'os'] as const;

const inputSchema = z.object({
  deviceId: z
    .string()
    .min(1)
    .max(256)
    .describe('MeshCentral device identifier as returned by devices_list.'),
  include: z
    .array(z.enum(['system', 'network', 'lastConnect']))
    .min(1)
    .max(3)
    .optional()
    .describe('Sections to include. Defaults to all three.'),
});

export const devicesGetTool: ToolDefinition = {
  name: 'devices_get',
  title: 'Get one MeshCentral device',
  description:
    'Returns the inventory summary of a single device plus optional system, network and last-connection sections. Raw MeshCentral payloads are never returned, and large sections are field-filtered. Use this before any operation that needs to confirm a device is online.',
  inputSchema,
  annotations: READ_ONLY_ANNOTATIONS,
  scope: 'devices:read',
  async execute(rawInput, context): Promise<ToolResult> {
    const input = inputSchema.parse(rawInput ?? {});
    if (context.plugin) {
      const details = await context.plugin.devicesGet(input.deviceId);
      const device = pluginDeviceToDevice(details.device);
      assertDeviceAllowed(device, context.config.scope);
      return { data: { device: projectDevice(device) } };
    }

    const details = await context.client.devices.details(input.deviceId);

    if (details.device) {
      assertDeviceAllowed(details.device, context.config.scope);
    } else if (hasScope(context.config.scope)) {
      const cached = await context.devices.get(() => context.client.devices.list());
      const known = cached.find((device) => device.id === input.deviceId);
      if (!known) {
        throw new McpToolError(
          'FORBIDDEN',
          `Device ${input.deviceId} is outside the configured MCP scope.`,
          { hint: 'Adjust MESHCENTRAL_MCP_SCOPE_DEVICES or MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS.' },
        );
      }
      assertDeviceAllowed(known, context.config.scope);
    }

    const include = new Set(input.include ?? ['system', 'network', 'lastConnect']);
    const system = include.has('system')
      ? pickFields(details.systemInfo, SYSTEM_FIELDS)
      : undefined;
    const network = include.has('network')
      ? pickFields(details.networkInfo, NETWORK_FIELDS)
      : undefined;
    const lastConnect = include.has('lastConnect')
      ? pickFields(details.lastConnect, LAST_CONNECT_FIELDS)
      : undefined;

    return {
      data: {
        device: details.device ? projectDevice(details.device) : { id: input.deviceId },
        ...(system === undefined ? {} : { system }),
        ...(network === undefined ? {} : { network }),
        ...(lastConnect === undefined ? {} : { lastConnect }),
        ...(system === undefined && network === undefined && lastConnect === undefined
          ? { note: 'MeshCentral returned no detail sections for this device.' }
          : {}),
      },
    };
  },
};
