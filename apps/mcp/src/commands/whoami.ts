import { loadMcpConfig, readStoredOAuthTokens, SessionManager } from '@meshcentral/mcp-core';

import { configOverridesFromArgs, flagBoolean, type ParsedArgs } from '../cli/args';
import { writeJson, writeLine } from '../cli/output';

export async function runWhoami(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  const session = new SessionManager({ config });
  const stored = await session.peek();
  const oauthTokens = await readStoredOAuthTokens({ file: config.oauthTokenFile });

  if (!stored && !oauthTokens) {
    writeLine('No stored MeshCentral session.');
    writeLine(`Expected session file: ${config.sessionFile}`);
    writeLine('Run `meshcentral-mcp login` to create one.');
    process.exitCode = 1;
    return;
  }

  const report = {
    serverUrl: stored?.serverUrl ?? oauthTokens?.serverUrl ?? config.serverUrl,
    controlUrl: config.controlUrl,
    authMode: oauthTokens ? 'oauth' : config.auth.kind,
    userId: stored?.userId,
    userName: stored?.userName,
    siteAdmin: stored?.siteAdmin,
    issuedAt: stored?.issuedAt ?? oauthTokens?.issuedAt,
    sessionFile: config.sessionFile,
    tokenFile: config.oauthTokenFile,
    matchesConfiguredServer: (stored?.serverUrl ?? oauthTokens?.serverUrl) === config.serverUrl,
    scope: oauthTokens?.scope ?? config.scope,
  };

  if (flagBoolean(args, 'json')) {
    writeJson(report);
    return;
  }

  writeLine(`Server:      ${report.serverUrl}`);
  writeLine(`Control URL: ${report.controlUrl}`);
  writeLine(`Auth mode:   ${report.authMode}`);
  writeLine(`User:        ${report.userName ?? '(unknown)'}`);
  writeLine(`User ID:     ${report.userId ?? '(unknown)'}`);
  writeLine(`Issued at:   ${report.issuedAt}`);
  writeLine(`Session:     ${report.sessionFile}`);
  if (report.tokenFile) writeLine(`Token file:   ${report.tokenFile}`);
  if (!report.matchesConfiguredServer) {
    writeLine('Warning: the stored session belongs to a different server URL.');
    process.exitCode = 1;
  }
}
