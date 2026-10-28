import { McpToolError } from '../errors';
import { defaultAuditFile, defaultOAuthTokenFile, defaultSessionFile } from './paths';

export interface McpLimits {
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly maxResponseBytes: number;
}

export interface McpScope {
  readonly deviceGroups: readonly string[];
  readonly devices: readonly string[];
}

export type McpAuthConfig =
  | { readonly kind: 'session' }
  | {
      readonly kind: 'meshauth';
      readonly username: string;
      readonly password: string;
      readonly token?: string;
    };

export interface McpConfig {
  /** Normalized value from the user, kept for diagnostics and session binding. */
  readonly serverUrl: string;
  /** Origin used for jsonauth HTTP calls such as `/auth/login`. */
  readonly httpBaseUrl: string;
  /** WebSocket endpoint used by `@meshcentral/control-client`. */
  readonly controlUrl: string;
  /** jsonauth base path, normally `/auth`. */
  readonly authPath: string;
  readonly allowInsecureTls: boolean;
  readonly tlsCaPath?: string;
  readonly sessionFile: string;
  readonly oauthTokenFile: string;
  readonly mcpPluginPath: string;
  readonly oauthClientId: string;
  readonly auditFile?: string;
  readonly connectTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly idleDisconnectMs: number;
  readonly keepAliveIntervalMs: number;
  readonly maxConcurrentCalls: number;
  readonly limits: McpLimits;
  readonly scope?: McpScope;
  readonly auth: McpAuthConfig;
}

export interface McpConfigOverrides {
  readonly serverUrl?: string;
  readonly authPath?: string;
  readonly sessionFile?: string;
  readonly oauthTokenFile?: string;
  readonly mcpPluginPath?: string;
  readonly oauthClientId?: string;
  readonly auditFile?: string;
  readonly allowInsecureTls?: boolean;
  readonly tlsCaPath?: string;
  readonly scope?: McpScope;
}

export type McpEnvironment = Readonly<Record<string, string | undefined>>;

const DEFAULT_AUTH_PATH = '/auth';
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_IDLE_DISCONNECT_MS = 600_000;
const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 25_000;
const DEFAULT_MAX_CONCURRENT_CALLS = 8;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_MAX_RESPONSE_BYTES = 256_000;

interface ParsedServerUrl {
  readonly httpBaseUrl: string;
  readonly explicitWebSocketUrl?: string;
}

export function parseServerUrl(raw: string): ParsedServerUrl {
  const value = raw.trim();
  if (!value) {
    throw new McpToolError('INVALID_ARGUMENT', 'MeshCentral server URL is required.', {
      hint: 'Set MESHCENTRAL_URL, for example https://mesh.example.com.',
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new McpToolError('INVALID_ARGUMENT', `Invalid MeshCentral server URL: ${value}`);
  }

  const webSocketProtocol = parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  if (!webSocketProtocol && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new McpToolError(
      'INVALID_ARGUMENT',
      'MeshCentral server URL must use http, https, ws or wss.',
    );
  }

  const secure = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
  const httpBaseUrl = `${secure ? 'https' : 'http'}://${parsed.host}`;
  const pathname = parsed.pathname.replace(/\/+$/, '');

  if (webSocketProtocol) {
    const target = pathname.length > 0 ? pathname : '/control.ashx';
    return { httpBaseUrl, explicitWebSocketUrl: `${parsed.protocol}//${parsed.host}${target}` };
  }

  if (pathname.endsWith('/control') || pathname.endsWith('/control.ashx')) {
    return {
      httpBaseUrl,
      explicitWebSocketUrl: `${secure ? 'wss' : 'ws'}://${parsed.host}${pathname}`,
    };
  }

  return { httpBaseUrl };
}

export function resolveControlUrl(serverUrl: string): string {
  const parsed = parseServerUrl(serverUrl);
  if (parsed.explicitWebSocketUrl) return parsed.explicitWebSocketUrl;

  const url = new URL(serverUrl.trim());
  const pathname = url.pathname.replace(/\/+$/, '');
  const secure = url.protocol === 'https:';
  const wsBase = `${secure ? 'wss' : 'ws'}://${url.host}`;
  return `${wsBase}${pathname}/control.ashx`;
}

export function loadMcpConfig(
  env: McpEnvironment = process.env,
  overrides: McpConfigOverrides = {},
): McpConfig {
  const serverUrl = (overrides.serverUrl ?? env.MESHCENTRAL_URL ?? '').trim();
  if (!serverUrl) {
    throw new McpToolError('INVALID_ARGUMENT', 'MESHCENTRAL_URL is not configured.', {
      hint: 'Set MESHCENTRAL_URL to the MeshCentral base URL, for example https://mesh.example.com.',
    });
  }

  const parsed = parseServerUrl(serverUrl);
  const authPath = normalizeAuthPath(
    overrides.authPath ?? env.MESHCENTRAL_AUTH_PATH ?? DEFAULT_AUTH_PATH,
  );
  const limits: McpLimits = {
    defaultPageSize: readInteger(
      env.MESHCENTRAL_MCP_PAGE_SIZE,
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    ),
    maxPageSize: MAX_PAGE_SIZE,
    maxResponseBytes: readInteger(
      env.MESHCENTRAL_MCP_MAX_RESPONSE_BYTES,
      DEFAULT_MAX_RESPONSE_BYTES,
      4_096,
      8_000_000,
    ),
  };

  const tlsCaPath = overrides.tlsCaPath ?? env.MESHCENTRAL_MCP_CA;
  const auditFile = overrides.auditFile ?? env.MESHCENTRAL_MCP_AUDIT_FILE ?? defaultAuditFile();
  const oauthTokenFile =
    overrides.oauthTokenFile ?? env.MESHCENTRAL_MCP_TOKEN_FILE ?? defaultOAuthTokenFile();
  const mcpPluginPath = normalizePluginPath(env.MESHCENTRAL_MCP_PLUGIN_PATH ?? '/plugin/mcp/v1');
  const oauthClientId = (env.MESHCENTRAL_MCP_CLIENT_ID ?? 'meshcentral-mcp-cli').trim();

  const config: McpConfig = {
    serverUrl,
    httpBaseUrl: parsed.httpBaseUrl,
    controlUrl: resolveControlUrl(serverUrl),
    authPath,
    allowInsecureTls:
      overrides.allowInsecureTls ?? readBoolean(env.MESHCENTRAL_MCP_ALLOW_INSECURE_TLS),
    ...(tlsCaPath ? { tlsCaPath } : {}),
    sessionFile: overrides.sessionFile ?? env.MESHCENTRAL_MCP_SESSION_FILE ?? defaultSessionFile(),
    oauthTokenFile,
    mcpPluginPath,
    oauthClientId,
    ...(auditFile ? { auditFile } : {}),
    connectTimeoutMs: readInteger(
      env.MESHCENTRAL_MCP_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECT_TIMEOUT_MS,
      1_000,
      120_000,
    ),
    requestTimeoutMs: readInteger(
      env.MESHCENTRAL_MCP_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      500,
      120_000,
    ),
    idleDisconnectMs: readInteger(
      env.MESHCENTRAL_MCP_IDLE_DISCONNECT_MS,
      DEFAULT_IDLE_DISCONNECT_MS,
      1_000,
      86_400_000,
    ),
    keepAliveIntervalMs: readInteger(
      env.MESHCENTRAL_MCP_KEEPALIVE_MS,
      DEFAULT_KEEP_ALIVE_INTERVAL_MS,
      0,
      600_000,
    ),
    maxConcurrentCalls: readInteger(
      env.MESHCENTRAL_MCP_MAX_CONCURRENT_CALLS,
      DEFAULT_MAX_CONCURRENT_CALLS,
      1,
      64,
    ),
    limits,
    ...buildScope(env, overrides.scope),
    auth: resolveAuth(env),
  };

  return config;
}

function resolveAuth(env: McpEnvironment): McpAuthConfig {
  const requested = (env.MESHCENTRAL_AUTH ?? 'session').trim().toLowerCase();
  if (requested === 'session' || requested === '') return { kind: 'session' };
  if (requested !== 'meshauth') {
    throw new McpToolError('INVALID_ARGUMENT', `Unsupported MESHCENTRAL_AUTH value: ${requested}`, {
      hint: 'Use "session" (recommended) or "meshauth".',
    });
  }

  const username = (env.MESHCENTRAL_USERNAME ?? '').trim();
  const password = env.MESHCENTRAL_PASSWORD ?? '';
  if (!username || !password) {
    throw new McpToolError(
      'INVALID_ARGUMENT',
      'MESHCENTRAL_AUTH=meshauth requires MESHCENTRAL_USERNAME and MESHCENTRAL_PASSWORD.',
    );
  }
  const token = (env.MESHCENTRAL_TOKEN ?? '').trim();
  return { kind: 'meshauth', username, password, ...(token ? { token } : {}) };
}

function buildScope(env: McpEnvironment, override: McpScope | undefined): { scope?: McpScope } {
  if (override) return { scope: override };
  const deviceGroups = splitList(env.MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS);
  const devices = splitList(env.MESHCENTRAL_MCP_SCOPE_DEVICES);
  if (deviceGroups.length === 0 && devices.length === 0) return {};
  return { scope: { deviceGroups, devices } };
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizePluginPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/plugin/mcp/v1';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeAuthPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_AUTH_PATH;
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

function readInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function readBoolean(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
