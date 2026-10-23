import { Buffer } from 'node:buffer';

import type { McpConfig } from '../config/mcp-config';
import { McpToolError } from '../errors';
import {
  LoginClient,
  type LoginOutcome,
  type PasswordCredentials,
  type TwoFactorVerification,
} from './login-client';
import {
  readStoredSession,
  removeStoredSession,
  writeStoredSession,
  type StoredSession,
} from './session-store';

export interface ResolvedCredentials {
  /** Changes whenever the underlying credential changes, so callers can rebuild clients. */
  readonly key: string;
  readonly cookieHeader?: string;
  readonly meshAuthHeader?: string;
}

export interface SessionManagerOptions {
  readonly config: McpConfig;
  readonly loginClient?: LoginClient;
  readonly now?: () => Date;
}

export class SessionManager {
  private readonly loginClient: LoginClient;
  private readonly now: () => Date;
  private cached?: { readonly key: string; readonly credentials: ResolvedCredentials };

  constructor(private readonly options: SessionManagerOptions) {
    this.loginClient =
      options.loginClient ??
      new LoginClient({
        httpBaseUrl: options.config.httpBaseUrl,
        authPath: options.config.authPath,
      });
    this.now = options.now ?? (() => new Date());
  }

  async resolve(): Promise<ResolvedCredentials> {
    const auth = this.options.config.auth;
    if (auth.kind === 'meshauth') {
      const parts = [encodeBase64(auth.username), encodeBase64(auth.password)];
      if (auth.token) parts.push(encodeBase64(auth.token));
      const header = parts.join(',');
      const key = `meshauth:${auth.username}:${header.length}`;
      if (this.cached?.key !== key) this.cached = { key, credentials: { key, meshAuthHeader: header } };
      return this.cached.credentials;
    }

    const stored = await this.readSession();
    if (!stored) {
      throw new McpToolError('SESSION_MISSING', 'No MeshCentral session was found on this machine.', {
        hint: 'Run `meshcentral-mcp login` before starting the MCP server.',
      });
    }
    if (stored.serverUrl !== this.options.config.serverUrl) {
      throw new McpToolError(
        'SESSION_SERVER_MISMATCH',
        `The stored session belongs to ${stored.serverUrl}, not ${this.options.config.serverUrl}.`,
        { hint: 'Run `meshcentral-mcp login` again for the configured server.' },
      );
    }

    const key = `cookie:${stored.issuedAt}:${stored.cookieHeader.length}`;
    if (this.cached?.key !== key) {
      this.cached = {
        key,
        credentials: { key, cookieHeader: stored.cookieHeader },
      };
    }
    return this.cached.credentials;
  }

  async login(credentials: PasswordCredentials): Promise<LoginOutcome> {
    const outcome = await this.loginClient.login(credentials);
    if (outcome.kind === 'success') await this.persist(outcome);
    return outcome;
  }

  async verifyTwoFactor(verification: TwoFactorVerification): Promise<LoginOutcome> {
    const outcome = await this.loginClient.verifyTwoFactor(verification);
    if (outcome.kind === 'success') await this.persist(outcome);
    return outcome;
  }

  async logout(): Promise<void> {
    const stored = await readStoredSession({ file: this.options.config.sessionFile });
    if (stored) await this.loginClient.logout(stored.cookieHeader);
    await removeStoredSession({ file: this.options.config.sessionFile });
    this.cached = undefined;
  }

  /** Drops the cached session after MeshCentral rejects it. */
  async invalidate(): Promise<void> {
    this.cached = undefined;
    if (this.options.config.auth.kind !== 'session') return;
    try {
      await removeStoredSession({ file: this.options.config.sessionFile });
    } catch {
      // Removing a stale file is best effort.
    }
  }

  async peek(): Promise<StoredSession | undefined> {
    return readStoredSession({ file: this.options.config.sessionFile });
  }

  private async readSession(): Promise<StoredSession | undefined> {
    return readStoredSession({ file: this.options.config.sessionFile });
  }

  private async persist(outcome: Extract<LoginOutcome, { kind: 'success' }>): Promise<void> {
    const session: StoredSession = {
      version: 1,
      serverUrl: this.options.config.serverUrl,
      cookieHeader: outcome.cookieHeader,
      issuedAt: this.now().toISOString(),
      ...(outcome.userId === undefined ? {} : { userId: outcome.userId }),
      ...(outcome.userName === undefined ? {} : { userName: outcome.userName }),
      ...(outcome.siteAdmin === undefined ? {} : { siteAdmin: outcome.siteAdmin }),
    };
    await writeStoredSession({ file: this.options.config.sessionFile }, session);
    this.cached = undefined;
  }
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}
