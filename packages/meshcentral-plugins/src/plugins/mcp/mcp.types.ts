import type { MeshCentralUser } from '../../types/meshcentral.types.js';

export interface McpOAuthClient {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
}
export interface McpOAuthConfig {
  enabled?: boolean;
  basePath?: string;
  issuer?: string;
  clients?: McpOAuthClient[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  authorizationCodeTtlSeconds?: number;
  scopes?: string[];
}
export interface McpOAuthDependencies {
  randomToken(): string;
  now(): number;
}
export interface McpAuthorizationCode {
  clientId: string;
  redirectUri: string;
  userId: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
}
export interface McpAccessToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;
  refreshToken?: string;
}
export interface McpRefreshToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;
  family: string;
  used: boolean;
}
export interface McpAuthenticatedRequestUser {
  user: MeshCentralUser;
  userId: string;
  clientId: string;
  scope: string;
}
