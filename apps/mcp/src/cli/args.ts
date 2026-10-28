import type { McpConfigOverrides } from '@meshcentral/mcp-core';

export type FlagValue = string | true;

export interface ParsedArgs {
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, FlagValue>>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, FlagValue> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    const equalsAt = body.indexOf('=');
    if (equalsAt > 0) {
      flags[body.slice(0, equalsAt)] = body.slice(equalsAt + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[body] = next;
      index += 1;
      continue;
    }

    flags[body] = true;
  }

  return { positionals, flags };
}

export function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function flagBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags[name] !== undefined;
}

export function configOverridesFromArgs(args: ParsedArgs): McpConfigOverrides {
  const serverUrl = flagString(args, 'url');
  const authPath = flagString(args, 'auth-path');
  const tlsCaPath = flagString(args, 'ca');
  const sessionFile = flagString(args, 'session-file');
  const oauthTokenFile = flagString(args, 'token-file');
  const auditFile = flagString(args, 'audit-file');

  return {
    ...(serverUrl === undefined ? {} : { serverUrl }),
    ...(authPath === undefined ? {} : { authPath }),
    ...(tlsCaPath === undefined ? {} : { tlsCaPath }),
    ...(sessionFile === undefined ? {} : { sessionFile }),
    ...(oauthTokenFile === undefined ? {} : { oauthTokenFile }),
    ...(auditFile === undefined ? {} : { auditFile }),
    ...(flagBoolean(args, 'insecure-tls') ? { allowInsecureTls: true } : {}),
  };
}
