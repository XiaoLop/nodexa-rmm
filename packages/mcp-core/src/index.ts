export {
  McpToolError,
  isMcpToolError,
  type McpErrorCode,
  type McpToolErrorOptions,
} from './errors';

export {
  loadMcpConfig,
  parseServerUrl,
  resolveControlUrl,
  type McpAuthConfig,
  type McpConfig,
  type McpConfigOverrides,
  type McpEnvironment,
  type McpLimits,
  type McpScope,
} from './config/mcp-config';
export {
  defaultAuditFile,
  defaultConfigDirectory,
  defaultSessionFile,
  defaultOAuthTokenFile,
  type PathEnvironment,
} from './config/paths';

export {
  LoginClient,
  collectCookieHeader,
  type LoginClientOptions,
  type LoginOutcome,
  type PasswordCredentials,
  type TwoFactorVerification,
} from './session/login-client';
export { SessionManager, type ResolvedCredentials } from './session/session-manager';
export { createCodeChallenge, createCodeVerifier, createOAuthState } from './oauth/pkce';
export {
  readStoredOAuthTokens,
  writeStoredOAuthTokens,
  removeStoredOAuthTokens,
  type OAuthTokenStoreOptions,
} from './oauth/token-store';
export type { OAuthMetadata, OAuthTokenSet, StoredOAuthTokens } from './oauth/oauth-types';
export { OAuthClient, type OAuthClientOptions } from './oauth/oauth-client';
export { OAuthTokenManager } from './oauth/token-manager';
export {
  McpPluginTransport,
  type McpPluginClient,
  type PluginCapabilities,
  type PluginDevice,
  type PluginEvent,
  type PluginEventsQuery,
  type PluginFetchOptions,
  type PluginGroup,
  type PluginHealth,
  type PluginServerStatus,
} from './plugin/plugin-client';
export {
  readStoredSession,
  removeStoredSession,
  writeStoredSession,
  type StoredSession,
  type SessionStoreOptions,
} from './session/session-store';

export {
  appendMeshAuthQuery,
  createNodeSocketFactory,
  type NodeSocketOptions,
} from './connection/socket-factory';
export {
  ConnectionManager,
  type ClientProvider,
  type ConnectionInfo,
  type ConnectionManagerOptions,
  type CreateClientInput,
} from './connection/connection-manager';
export { toMcpToolError } from './connection/error-mapper';

export {
  fitToBudget,
  pickFields,
  projectDevice,
  projectEvent,
  projectGroup,
  stripRaw,
  type BudgetResult,
  type DeviceSummary,
  type EventSummary,
  type GroupSummary,
} from './query/projection';
export {
  decodeCursor,
  encodeCursor,
  paginate,
  type Page,
  type PageOptions,
} from './query/pagination';
export { SnapshotCache, type SnapshotCacheOptions } from './query/snapshot-cache';

export {
  assertDeviceAllowed,
  assertGroupAllowed,
  filterDevices,
  hasScope,
  isDeviceAllowed,
} from './authz/scope';

export {
  createAuditWriter,
  type AuditEvent,
  type AuditWriter,
  type ToolCallAudit,
} from './audit/audit-log';
export { redactSensitive } from './audit/redact';

export {
  READ_ONLY_ANNOTATIONS,
  READ_ONLY_TOOLS,
  devicesGetTool,
  devicesListTool,
  eventsQueryTool,
  groupsListTool,
  serverStatusTool,
  type ToolAnnotations,
  type ToolContext,
  type ToolDefinition,
  type ToolResult,
  type ToolScope,
} from './tools';

export {
  createToolRuntime,
  type CallToolResult,
  type CreateToolRuntimeOptions,
  type ToolRuntime,
} from './runtime';
