import type { CallToolResult, ToolRuntime } from '@meshcentral/mcp-core';
import { toMcpToolError } from '@meshcentral/mcp-core';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { toMcpTool } from './tool-adapter';

export const SERVER_NAME = 'meshcentral-mcp';
export const SERVER_VERSION = '0.1.0';

export function createMcpServer(runtime: ToolRuntime): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: runtime.listTools().map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};

    try {
      const result = await runtime.callTool(name, args);
      return {
        content: [{ type: 'text' as const, text: renderResult(result) }],
        isError: false,
      };
    } catch (error) {
      const mapped = toMcpToolError(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: mapped.toJSON() }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function renderResult(result: CallToolResult): string {
  return JSON.stringify(
    {
      ...(result.truncated ? { truncated: true } : {}),
      ...(result.note === undefined ? {} : { note: result.note }),
      data: result.data,
    },
    null,
    2,
  );
}
