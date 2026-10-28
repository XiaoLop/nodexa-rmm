import type { McpConfig } from '../config/mcp-config';
import { McpToolError } from '../errors';
import { OAuthClient } from './oauth-client';
import {
  readStoredOAuthTokens,
  writeStoredOAuthTokens,
  removeStoredOAuthTokens,
} from './token-store';
import type { OAuthTokenSet, StoredOAuthTokens } from './oauth-types';

export class OAuthTokenManager {
  private cached?: OAuthTokenSet;
  private refreshPromise?: Promise<OAuthTokenSet>;
  constructor(
    private readonly config: McpConfig,
    private readonly client = new OAuthClient({ config }),
  ) {}

  async accessToken(): Promise<string> {
    const token = this.cached;
    if (token && token.expiresAt > Date.now() + 30_000) return token.accessToken;
    const stored = await readStoredOAuthTokens({ file: this.config.oauthTokenFile });
    if (!stored)
      throw new McpToolError(
        'SESSION_MISSING',
        'No OAuth authorization was found on this machine.',
        { hint: 'Run `meshcentral-mcp login` before starting the MCP server.' },
      );
    if (stored.serverUrl !== this.config.serverUrl)
      throw new McpToolError(
        'SESSION_SERVER_MISMATCH',
        'The stored OAuth authorization belongs to another server.',
        { hint: 'Run `meshcentral-mcp login` again.' },
      );
    const refreshed = await this.refreshOnce(stored.refreshToken);
    return refreshed.accessToken;
  }

  async save(token: OAuthTokenSet): Promise<void> {
    this.cached = token;
    await this.persist(token);
  }

  async refreshOnce(refreshToken?: string): Promise<OAuthTokenSet> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const stored = refreshToken
        ? undefined
        : await readStoredOAuthTokens({ file: this.config.oauthTokenFile });
      const value = await this.client.refresh(refreshToken ?? stored?.refreshToken ?? '');
      await this.persist(value);
      return value;
    })().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    const stored = await readStoredOAuthTokens({ file: this.config.oauthTokenFile });
    if (stored) await this.client.revoke(stored.refreshToken).catch(() => undefined);
    this.cached = undefined;
    await removeStoredOAuthTokens({ file: this.config.oauthTokenFile });
  }

  private async persist(token: OAuthTokenSet): Promise<void> {
    this.cached = token;
    const stored: StoredOAuthTokens = {
      version: 1,
      serverUrl: this.config.serverUrl,
      clientId: this.config.oauthClientId,
      refreshToken: token.refreshToken,
      scope: token.scope,
      issuedAt: new Date().toISOString(),
    };
    await writeStoredOAuthTokens({ file: this.config.oauthTokenFile }, stored);
  }
}
