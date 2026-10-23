import { createToolRuntime, loadMcpConfig } from '@meshcentral/mcp-core';

import { configOverridesFromArgs, flagBoolean, type ParsedArgs } from '../cli/args';
import { writeJson, writeLine, writeTable } from '../cli/output';

export async function runTools(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  const runtime = createToolRuntime({ config });
  const tools = runtime.listTools();

  try {
    if (flagBoolean(args, 'json')) {
      writeJson(
        tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          scope: tool.scope,
          description: tool.description,
        })),
      );
      return;
    }

    writeTable(
      ['NAME', 'SCOPE', 'TITLE'],
      tools.map((tool) => [tool.name, tool.scope, tool.title]),
    );
    writeLine('');
    writeLine(`${tools.length} read-only tools.`);
  } finally {
    await runtime.close();
  }
}
