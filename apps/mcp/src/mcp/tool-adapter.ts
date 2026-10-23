import type { ToolDefinition } from '@meshcentral/mcp-core';
import { z } from 'zod';

export interface McpToolDescriptor {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: {
    readonly readOnlyHint: true;
    readonly idempotentHint: true;
    readonly openWorldHint: false;
  };
}

export function toMcpTool(tool: ToolDefinition): McpToolDescriptor {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toJsonSchema(tool.inputSchema),
    annotations: tool.annotations,
  };
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: 'input', target: 'draft-7' }) as Record<string, unknown>;
  delete json.$schema;

  if (json.type !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: false };
  }
  return json;
}
