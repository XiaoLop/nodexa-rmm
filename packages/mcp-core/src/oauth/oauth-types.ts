export interface OAuthTokenSet {
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly scope: readonly string[];
}

export interface StoredOAuthTokens {
  readonly version: 1;
  readonly serverUrl: string;
  readonly clientId: string;
  readonly refreshToken: string;
  readonly scope: readonly string[];
  readonly issuedAt: string;
}

export interface OAuthMetadata {
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly revocationEndpoint?: string;
  readonly codeChallengeMethodsSupported: readonly string[];
}
