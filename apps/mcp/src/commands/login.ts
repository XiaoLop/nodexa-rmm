import {
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  loadMcpConfig,
  McpToolError,
  OAuthClient,
  OAuthTokenManager,
} from '@meshcentral/mcp-core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { flagBoolean, configOverridesFromArgs, type ParsedArgs } from '../cli/args';
import { writeLine } from '../cli/output';
import { waitForOAuthCallback } from '../oauth/callback-server';

const execFileAsync = promisify(execFile);

export async function runLogin(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  if (config.auth.kind === 'meshauth')
    throw new McpToolError('INVALID_ARGUMENT', 'OAuth login requires MESHCENTRAL_AUTH=session.');
  const oauth = new OAuthClient({ config });
  const metadata = await oauth.metadata();
  const verifier = createCodeVerifier();
  const state = createOAuthState();
  const callback = await waitForOAuthCallback(state);
  const authorize = new URL(metadata.authorizationEndpoint);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.oauthClientId,
    redirect_uri: callback.redirectUri,
    code_challenge: createCodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    scope: 'mcp',
  }).toString();
  const url = authorize.toString();
  if (flagBoolean(args, 'no-browser')) writeLine(`Open this URL in your browser:\n${url}`);
  else {
    try {
      await execFileAsync(
        process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open',
        process.platform === 'win32' ? ['/c', 'start', '', url] : [url],
      );
    } catch {
      writeLine(`Open this URL in your browser:\n${url}`);
    }
  }
  const result = await callback.callback;
  const tokens = await oauth.exchangeCode({
    code: result.code,
    codeVerifier: verifier,
    redirectUri: callback.redirectUri,
  });
  await new OAuthTokenManager(config).save(tokens);
  writeLine(`OAuth authorization saved: ${config.oauthTokenFile}`);
}
