import { createHash, randomBytes } from 'node:crypto';
import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import type {
  McpAccessToken,
  McpAuthorizationCode,
  McpOAuthConfig,
  McpOAuthDependencies,
  McpRefreshToken,
} from './mcp.types.js';
import { resolveMcpOAuthConfig } from './mcp.config.js';

export class McpOAuthService {
  readonly config: McpOAuthConfig;
  private readonly codes = new Map<string, McpAuthorizationCode>();
  private readonly accessTokens = new Map<string, McpAccessToken>();
  private readonly refreshTokens = new Map<string, McpRefreshToken>();
  constructor(
    config: McpOAuthConfig = {},
    private readonly dependencies: McpOAuthDependencies = {
      randomToken: () => randomBytes(32).toString('base64url'),
      now: () => Date.now(),
    },
  ) {
    this.config = resolveMcpOAuthConfig(config);
  }
  registerCode(value: Omit<McpAuthorizationCode, 'expiresAt'>): string {
    const code = this.dependencies.randomToken();
    this.codes.set(code, {
      ...value,
      expiresAt: this.dependencies.now() + (this.config.authorizationCodeTtlSeconds ?? 300) * 1000,
    });
    return code;
  }
  exchangeCode(
    code: string,
    clientId: string,
    redirectUri: string,
    verifier: string,
  ): {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
  } | null {
    const record = this.codes.get(code);
    this.codes.delete(code);
    if (
      !record ||
      record.expiresAt <= this.dependencies.now() ||
      record.clientId !== clientId ||
      record.redirectUri !== redirectUri ||
      !this.verifyPkce(verifier, record.codeChallenge)
    )
      return null;
    const access = this.issueAccess(record.clientId, record.userId, record.scope);
    return {
      access_token: access.token,
      token_type: 'Bearer',
      expires_in: Math.max(0, Math.floor((access.expiresAt - this.dependencies.now()) / 1000)),
      refresh_token: access.refreshToken!,
      scope: access.scope,
    };
  }
  issueAccess(clientId: string, userId: string, scope: string): McpAccessToken {
    const token = this.dependencies.randomToken();
    const refreshToken = this.dependencies.randomToken();
    const expiresAt = this.dependencies.now() + (this.config.accessTokenTtlSeconds ?? 3600) * 1000;
    this.accessTokens.set(token, { token, clientId, userId, scope, expiresAt, refreshToken });
    this.refreshTokens.set(refreshToken, {
      token: refreshToken,
      clientId,
      userId,
      scope,
      expiresAt: this.dependencies.now() + (this.config.refreshTokenTtlSeconds ?? 2592000) * 1000,
      family: refreshToken,
      used: false,
    });
    return this.accessTokens.get(token)!;
  }
  refresh(token: string): ReturnType<McpOAuthService['exchangeCode']> {
    const old = this.refreshTokens.get(token);
    if (!old || old.used || old.expiresAt <= this.dependencies.now()) return null;
    old.used = true;
    const access = this.issueAccess(old.clientId, old.userId, old.scope);
    return {
      access_token: access.token,
      token_type: 'Bearer',
      expires_in: Math.floor((access.expiresAt - this.dependencies.now()) / 1000),
      refresh_token: access.refreshToken!,
      scope: access.scope,
    };
  }
  revoke(token: string): void {
    this.accessTokens.delete(token);
    this.refreshTokens.delete(token);
  }
  authenticate(token: string): McpAccessToken | null {
    const value = this.accessTokens.get(token);
    return value && value.expiresAt > this.dependencies.now() ? value : null;
  }
  verifyPkce(verifier: string, challenge: string): boolean {
    return createHash('sha256').update(verifier).digest('base64url') === challenge;
  }
}

export function createMcpModule(
  pluginHandler: MeshCentralPluginHandler,
  config: McpOAuthConfig = {},
) {
  const service = new McpOAuthService(config);
  return { service, plugin: undefined, meshServer: pluginHandler.parent };
}
