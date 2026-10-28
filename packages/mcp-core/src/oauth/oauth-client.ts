import { readFileSync } from 'node:fs';
import { Agent } from 'undici';

import { McpToolError } from '../errors';
import type { McpConfig } from '../config/mcp-config';
import type { OAuthMetadata, OAuthTokenSet } from './oauth-types';

export interface OAuthClientOptions {
  readonly config: McpConfig;
  readonly fetchImpl?: typeof fetch;
}

export class OAuthClient {
  private readonly fetchImpl: typeof fetch;
  private readonly dispatcher?: Agent;
  private metadataCache?: OAuthMetadata;

  constructor(private readonly options: OAuthClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.dispatcher = createTlsDispatcher(options.config);
  }

  async metadata(): Promise<OAuthMetadata> {
    if (this.metadataCache !== undefined) return this.metadataCache;
    const value = await this.request(`${this.baseUrl()}/.well-known/oauth-authorization-server`, {
      method: 'GET',
    });
    const metadataBase = `${this.baseUrl()}/`;
    const metadata: OAuthMetadata = {
      issuer: resolveEndpoint(requiredString(value, 'issuer'), metadataBase),
      authorizationEndpoint: resolveEndpoint(
        requiredString(value, 'authorization_endpoint'),
        metadataBase,
      ),
      tokenEndpoint: resolveEndpoint(requiredString(value, 'token_endpoint'), metadataBase),
      ...(typeof value.revocation_endpoint === 'string'
        ? { revocationEndpoint: resolveEndpoint(value.revocation_endpoint, metadataBase) }
        : {}),
      codeChallengeMethodsSupported: arrayOfStrings(value.code_challenge_methods_supported),
    };
    this.metadataCache = metadata;
    return metadata;
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OAuthTokenSet> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: this.options.config.oauthClientId,
      redirect_uri: input.redirectUri,
    });
  }

  async refresh(refreshToken: string): Promise<OAuthTokenSet> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.options.config.oauthClientId,
    });
  }

  async revoke(refreshToken: string): Promise<void> {
    const metadata = await this.metadata();
    if (!metadata.revocationEndpoint) return;
    await this.request(metadata.revocationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: 'refresh_token',
        client_id: this.options.config.oauthClientId,
      }),
    });
  }

  private async tokenRequest(body: Record<string, string>): Promise<OAuthTokenSet> {
    const metadata = await this.metadata();
    const value = await this.request(metadata.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    const expiresIn = typeof value.expires_in === 'number' ? value.expires_in : 600;
    return {
      tokenType: 'Bearer',
      accessToken: requiredString(value, 'access_token'),
      refreshToken: requiredString(value, 'refresh_token'),
      expiresAt: Date.now() + expiresIn * 1000,
      scope: parseScope(value.scope),
    };
  }

  private baseUrl(): string {
    return `${this.options.config.httpBaseUrl}${this.options.config.mcpPluginPath}`;
  }

  private async request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        ...(this.dispatcher === undefined ? {} : { dispatcher: this.dispatcher }),
        signal: AbortSignal.timeout(this.options.config.requestTimeoutMs),
      } as RequestInit);
    } catch (error) {
      throw new McpToolError('PLUGIN_UNAVAILABLE', `MCP plugin request failed: ${url}`, {
        retryable: true,
        cause: error,
      });
    }
    const value = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new McpToolError(
        response.status === 401 ? 'SESSION_EXPIRED' : 'PLUGIN_PROTOCOL_ERROR',
        `MCP plugin returned HTTP ${response.status}.`,
        { details: value, retryable: response.status >= 500 },
      );
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new McpToolError(
        'PLUGIN_PROTOCOL_ERROR',
        'MCP plugin returned an invalid JSON object.',
      );
    return value as Record<string, unknown>;
  }
}

export function createTlsDispatcher(config: McpConfig): Agent | undefined {
  const ca = config.tlsCaPath === undefined ? undefined : readFileSync(config.tlsCaPath);
  if (ca === undefined && !config.allowInsecureTls) return undefined;
  return new Agent({
    connect: {
      ...(ca === undefined ? {} : { ca }),
      ...(config.allowInsecureTls ? { rejectUnauthorized: false } : {}),
    },
  });
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== 'string' || result.length === 0)
    throw new McpToolError('PLUGIN_PROTOCOL_ERROR', `MCP plugin response is missing ${key}.`);
  return result;
}
function arrayOfStrings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function resolveEndpoint(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch (error) {
    throw new McpToolError(
      'PLUGIN_PROTOCOL_ERROR',
      `MCP plugin returned an invalid URL: ${value}`,
      {
        cause: error,
      },
    );
  }
}

function parseScope(value: unknown): readonly string[] {
  if (typeof value === 'string') return value.split(' ').filter((item) => item.length > 0);
  return arrayOfStrings(value);
}
