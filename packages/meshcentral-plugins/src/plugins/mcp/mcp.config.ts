import type { McpOAuthConfig } from './mcp.types.js';

export const defaultMcpOAuthConfig: Required<
  Pick<
    McpOAuthConfig,
    | 'basePath'
    | 'accessTokenTtlSeconds'
    | 'refreshTokenTtlSeconds'
    | 'authorizationCodeTtlSeconds'
    | 'scopes'
    | 'clients'
  >
> = {
  basePath: '/plugin/mcp/v1',
  accessTokenTtlSeconds: 600,
  refreshTokenTtlSeconds: 2592000,
  authorizationCodeTtlSeconds: 300,
  scopes: ['mcp'],
  clients: [{ clientId: 'meshcentral-mcp-cli', redirectUris: ['http://127.0.0.1'] }],
};

export function resolveMcpOAuthConfig(config?: McpOAuthConfig): McpOAuthConfig {
  return {
    ...defaultMcpOAuthConfig,
    ...config,
    scopes: config?.scopes ?? defaultMcpOAuthConfig.scopes,
  };
}
