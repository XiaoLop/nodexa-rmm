import { McpToolError } from '@meshcentral/mcp-core';

import { runCall } from '../commands/call';
import { runLogin } from '../commands/login';
import { runLogout } from '../commands/logout';
import { runServe } from '../commands/serve';
import { runTools } from '../commands/tools';
import { runWhoami } from '../commands/whoami';
import { parseArgs, type ParsedArgs } from './args';
import { writeLine } from './output';

export const USAGE = `meshcentral-mcp <command> [options]

Commands:
  serve                 Run the MCP server over stdio (default)
  login                 Store a MeshCentral session for later use
  logout                Remove the stored session
  whoami                Show the stored session and target server
  tools                 List the available read-only tools
  call <tool>           Invoke one tool from the command line

Common options:
  --url <url>           MeshCentral base URL (or MESHCENTRAL_URL)
  --auth-path <path>    jsonauth base path, defaults to /auth
  --ca <path>           Extra CA bundle for TLS verification
  --insecure-tls        Disable TLS verification (development only)
  --session-file <path> Override the session file location
  --audit-file <path>   Override the audit log location
  --json                Machine-readable output where supported
  -h, --help            Show this help

Environment:
  MESHCENTRAL_URL, MESHCENTRAL_AUTH_PATH, MESHCENTRAL_MCP_CA,
  MESHCENTRAL_MCP_ALLOW_INSECURE_TLS, MESHCENTRAL_MCP_SESSION_FILE,
  MESHCENTRAL_MCP_AUDIT_FILE, MESHCENTRAL_MCP_PAGE_SIZE,
  MESHCENTRAL_MCP_MAX_RESPONSE_BYTES, MESHCENTRAL_MCP_CONNECT_TIMEOUT_MS,
  MESHCENTRAL_MCP_REQUEST_TIMEOUT_MS, MESHCENTRAL_MCP_IDLE_DISCONNECT_MS,
  MESHCENTRAL_MCP_KEEPALIVE_MS, MESHCENTRAL_MCP_MAX_CONCURRENT_CALLS,
  MESHCENTRAL_MCP_SCOPE_DEVICES, MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS,
  MESHCENTRAL_AUTH (session|meshauth), MESHCENTRAL_USERNAME,
  MESHCENTRAL_PASSWORD, MESHCENTRAL_TOKEN`;

export async function runCli(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv);
  const command = args.positionals[0] ?? 'serve';

  if (command === '--help' || command === '-h' || args.flags.help !== undefined) {
    writeLine(USAGE);
    return;
  }

  switch (command) {
    case 'serve':
      await runServe(args);
      return;
    case 'login':
      await runLogin(args);
      return;
    case 'logout':
      await runLogout(args);
      return;
    case 'whoami':
      await runWhoami(args);
      return;
    case 'tools':
      await runTools(args);
      return;
    case 'call':
      await runCall(args);
      return;
    default:
      throw new McpToolError('INVALID_ARGUMENT', `Unknown command: ${command}`, {
        hint: 'Run `meshcentral-mcp --help` to list the available commands.',
      });
  }
}

export type { ParsedArgs };
