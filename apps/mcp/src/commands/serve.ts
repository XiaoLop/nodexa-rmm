import { createToolRuntime, loadMcpConfig } from '@meshcentral/mcp-core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { configOverridesFromArgs, type ParsedArgs } from '../cli/args';
import { createMcpServer } from '../mcp/server';

export async function runServe(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  const runtime = createToolRuntime({ config });
  const server = createMcpServer(runtime);
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await server.close();
    } catch {
      // The transport may already be closed by the client.
    }
    await runtime.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  process.stdin.once('end', () => void shutdown());

  await server.connect(transport);
  process.stderr.write(`[meshcentral-mcp] listening on stdio for ${config.controlUrl}\n`);
}
