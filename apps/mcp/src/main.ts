#!/usr/bin/env node
import { isMcpToolError } from '@meshcentral/mcp-core';

import { runCli } from './cli/run';

void runCli(process.argv.slice(2)).catch((error: unknown) => {
  if (isMcpToolError(error)) {
    process.stderr.write(`error [${error.code}]: ${error.message}\n`);
    if (error.hint) process.stderr.write(`hint: ${error.hint}\n`);
    if (error.details !== undefined) {
      process.stderr.write(`details: ${formatDetails(error.details)}\n`);
    }
  } else if (error instanceof Error) {
    process.stderr.write(`error: ${error.message}\n`);
  } else {
    process.stderr.write(`error: ${String(error)}\n`);
  }
  process.exit(1);
});

function formatDetails(details: unknown): string {
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
