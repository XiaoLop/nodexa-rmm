import { loadMcpConfig, McpToolError, SessionManager, type LoginOutcome } from '@meshcentral/mcp-core';

import { flagBoolean, flagString, configOverridesFromArgs, type ParsedArgs } from '../cli/args';
import { promptLine, promptSecret } from '../cli/prompt';
import { writeLine } from '../cli/output';

export async function runLogin(args: ParsedArgs): Promise<void> {
  const config = loadMcpConfig(process.env, configOverridesFromArgs(args));
  if (config.auth.kind !== 'session') {
    throw new McpToolError(
      'INVALID_ARGUMENT',
      'MESHCENTRAL_AUTH=meshauth does not use a stored session.',
      { hint: 'Unset MESHCENTRAL_AUTH to store a MeshCentral session cookie.' },
    );
  }

  const session = new SessionManager({ config });
  const username =
    flagString(args, 'username') ??
    process.env.MESHCENTRAL_USERNAME?.trim() ??
    (await promptLine('MeshCentral username: '));

  if (!username) throw new McpToolError('INVALID_ARGUMENT', 'A username is required.');

  const password =
    flagString(args, 'password') ??
    process.env.MESHCENTRAL_PASSWORD ??
    (await promptSecret('MeshCentral password: '));

  if (!password) throw new McpToolError('INVALID_ARGUMENT', 'A password is required.');

  const rememberToken = flagBoolean(args, 'remember');

  let outcome: LoginOutcome = await session.login({ username, password, rememberToken });
  while (outcome.kind === 'two-factor-required') {
    const method = pickMethod(outcome.methods);
    writeLine(`Two-factor verification required (${outcome.methods.join(', ') || method}).`);
    const code = await promptSecret(`${method.toUpperCase()} code: `);
    outcome = await session.verifyTwoFactor({
      transactionId: outcome.transactionId,
      type: method,
      code,
      rememberToken,
    });
  }

  const stored = await session.peek();
  writeLine(`Signed in to ${config.serverUrl} as ${stored?.userName ?? username}.`);
  writeLine(`Session file: ${config.sessionFile}`);
}

function pickMethod(methods: readonly string[]): string {
  if (methods.includes('totp')) return 'totp';
  return methods[0] ?? 'totp';
}
