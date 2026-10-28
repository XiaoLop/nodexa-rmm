import type { McpConfig } from '../config/mcp-config';
import { McpToolError } from '../errors';
import type { OAuthTokenManager } from '../oauth/token-manager';
import { createTlsDispatcher } from '../oauth/oauth-client';

export interface PluginHealth {
  readonly ok: boolean;
}

export interface PluginCapabilities {
  readonly readOnly: boolean;
  readonly resources: readonly string[];
}

export interface PluginDevice {
  readonly id: string;
  readonly name: string | null;
  readonly groupId: string | null;
  readonly state: string | null;
  readonly connected: boolean | null;
  readonly [key: string]: unknown;
}

export interface PluginGroup {
  readonly id: string;
  readonly name: string | null;
  readonly deviceCount: number | null;
  readonly [key: string]: unknown;
}

export interface PluginEvent {
  readonly id: string | null;
  readonly type: string | null;
  readonly timestamp: string | null;
  readonly deviceId: string | null;
  readonly message: string | null;
  readonly [key: string]: unknown;
}

export interface PluginServerStatus {
  readonly status: string;
  readonly version: string | null;
  readonly domainCount: number;
  readonly uptimeSeconds: number | null;
  readonly [key: string]: unknown;
}

export interface PluginFetchOptions {
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface PluginEventsQuery {
  readonly type?: string;
  readonly deviceId?: string;
  readonly userId?: string;
  readonly limit?: number;
}

/** Authenticated HTTP transport for the MeshCentral MCP plugin business API. */
export class McpPluginTransport {
  private readonly requestFetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly dispatcher;

  constructor(
    private readonly config: McpConfig,
    private readonly tokenManager: OAuthTokenManager,
    options: PluginFetchOptions = {},
  ) {
    this.requestFetch = options.fetch ?? fetch;
    this.dispatcher = createTlsDispatcher(config);
    this.timeoutMs = options.timeoutMs ?? config.requestTimeoutMs;
    this.baseUrl = `${config.httpBaseUrl.replace(/\/$/, '')}${config.mcpPluginPath}`.replace(
      /\/$/,
      '',
    );
  }

  health(): Promise<PluginHealth> {
    return this.get('/health');
  }

  capabilities(): Promise<PluginCapabilities> {
    return this.get('/capabilities');
  }

  async devicesList(): Promise<readonly PluginDevice[]> {
    const response = await this.get<{ devices: PluginDevice[] }>('/devices');
    return response.devices;
  }

  async devicesGet(deviceId: string): Promise<{ readonly device: PluginDevice }> {
    return this.get(`/devices/${encodeURIComponent(deviceId)}`);
  }

  async groupsList(): Promise<readonly PluginGroup[]> {
    const response = await this.get<{ groups: PluginGroup[] }>('/groups');
    return response.groups;
  }

  async eventsQuery(query: PluginEventsQuery = {}): Promise<readonly PluginEvent[]> {
    const params = new URLSearchParams();
    if (query.type !== undefined) params.set('type', query.type);
    if (query.deviceId !== undefined) params.set('deviceId', query.deviceId);
    if (query.userId !== undefined) params.set('userId', query.userId);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await this.get<{ events: PluginEvent[] }>(`/events${suffix}`);
    return response.events;
  }

  serverStatus(): Promise<PluginServerStatus> {
    return this.get('/server/status');
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.tokenManager.accessToken();
    const first = await this.request(path, token);
    if (first.status !== 401) return this.decode<T>(first);

    const refreshed = await this.tokenManager.refreshOnce();
    const second = await this.request(path, refreshed.accessToken);
    if (second.status === 401) {
      throw new McpToolError(
        'SESSION_EXPIRED',
        'The MCP plugin access token was rejected after refresh.',
        {
          retryable: false,
        },
      );
    }
    return this.decode<T>(second);
  }

  private async request(path: string, token: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.requestFetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        ...(this.dispatcher === undefined ? {} : { dispatcher: this.dispatcher }),
        signal: controller.signal,
      } as RequestInit);
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new McpToolError('UPSTREAM_TIMEOUT', 'The MCP plugin request timed out.', {
          retryable: true,
          cause,
        });
      }
      throw new McpToolError('PLUGIN_UNAVAILABLE', 'The MCP plugin request failed.', {
        retryable: true,
        cause,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async decode<T>(response: Response): Promise<T> {
    let value: unknown;
    try {
      value = await response.json();
    } catch (cause) {
      throw new McpToolError('PLUGIN_PROTOCOL_ERROR', 'The MCP plugin returned invalid JSON.', {
        cause,
      });
    }
    if (!response.ok) {
      const error =
        value && typeof value === 'object' && 'error' in value
          ? String(value.error)
          : response.statusText;
      throw new McpToolError(
        'PLUGIN_UNAVAILABLE',
        `The MCP plugin returned HTTP ${response.status}: ${error}`,
        {
          retryable: response.status >= 500,
          details: value,
        },
      );
    }
    return value as T;
  }
}

export type McpPluginClient = McpPluginTransport;
