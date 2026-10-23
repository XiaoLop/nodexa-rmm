import { devicesGetTool, devicesListTool } from '@meshcentral/mcp-core';
import { describe, expect, it } from 'vitest';

import { toMcpTool } from './tool-adapter';

describe('toMcpTool', () => {
  it('converts the zod schema to JSON Schema', () => {
    const descriptor = toMcpTool(devicesListTool);

    expect(descriptor.name).toBe('devices_list');
    expect(descriptor.inputSchema).toMatchObject({ type: 'object' });
    expect(descriptor.inputSchema).not.toHaveProperty('$schema');
    expect((descriptor.inputSchema.properties as Record<string, unknown>).limit).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 200,
    });
  });

  it('marks every tool as read only', () => {
    const descriptor = toMcpTool(devicesGetTool);
    expect(descriptor.annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('describes required arguments', () => {
    const descriptor = toMcpTool(devicesGetTool);
    expect(descriptor.inputSchema.required).toEqual(['deviceId']);
  });
});
