import { loadMcpConfig, SessionManager } from '@meshcentral/mcp-core';

import { configOverridesFromArgs, type ParsedArgs } from '../cli/args';
import { writeLine } from '../cli/output';

export async function runLogout(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  const session = new SessionManager({ config });
  await session.logout();
  writeLine(`Signed out. Removed ${config.sessionFile}.`);
}
