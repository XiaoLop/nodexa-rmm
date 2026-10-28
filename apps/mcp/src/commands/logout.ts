import { loadMcpConfig, OAuthTokenManager, SessionManager } from '@meshcentral/mcp-core';

import { configOverridesFromArgs, type ParsedArgs } from '../cli/args';
import { writeLine } from '../cli/output';

export async function runLogout(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  if (config.auth.kind === 'session') await new SessionManager({ config }).logout();
  await new OAuthTokenManager(config).logout();
  writeLine(`Signed out. Removed ${config.oauthTokenFile}.`);
}
