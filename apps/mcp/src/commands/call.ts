import { readFile } from 'node:fs/promises';

import { createToolRuntime, loadMcpConfig, McpToolError } from '@meshcentral/mcp-core';

import { configOverridesFromArgs, flagString, type ParsedArgs } from '../cli/args';
import { writeJson } from '../cli/output';
import { readStdin } from '../cli/prompt';

export async function runCall(args: ParsedArgs): Promise<void> {
  const toolName = args.positionals[1] ?? flagString(args, 'tool');
  if (!toolName) {
    throw new McpToolError('INVALID_ARGUMENT', 'A tool name is required.', {
      hint: 'Usage: meshcentral-mcp call <tool> [--input <json>] [--input-file <path>]',
    });
  }

  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  const runtime = createToolRuntime({ config });

  try {
    const input = await readInput(args);
    const result = await runtime.callTool(toolName, input);
    writeJson({
      ...(result.truncated ? { truncated: true } : {}),
      ...(result.note === undefined ? {} : { note: result.note }),
      durationMs: result.durationMs,
      data: result.data,
    });
  } catch (error) {
    if (error instanceof McpToolError) {
      writeJson({ error: error.toJSON() });
      process.exitCode = 2;
      return;
    }
    throw error;
  } finally {
    await runtime.close();
  }
}

async function readInput(args: ParsedArgs): Promise<unknown> {
  const inline = flagString(args, 'input');
  if (inline !== undefined) return parseJson(inline, '--input');

  const file = flagString(args, 'input-file');
  if (file !== undefined) return parseJson(await readFile(file, 'utf8'), file);

  if (process.stdin.isTTY) return {};
  const piped = (await readStdin()).trim();
  if (!piped) return {};
  return parseJson(piped, 'stdin');
}

function parseJson(value: string, source: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new McpToolError('INVALID_ARGUMENT', `The JSON supplied by ${source} is invalid.`);
  }
}

export function describeCallUsage(): string {
  return [
    'meshcentral-mcp call <tool> [--input <json>] [--input-file <path>]',
    '',
    'Examples:',
    '  meshcentral-mcp call devices_list --input \'{"limit":10}\'',
    '  echo \'{"deviceId":"node//abc"}\' | meshcentral-mcp call devices_get',
  ].join('\n');
}
