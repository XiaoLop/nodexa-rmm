export const GATEWAY_CONFIG = Symbol('GATEWAY_CONFIG');

export interface GatewayConfig {
  port: number;
  publicOrigin: URL;
  upstreamBaseUrl: URL;
  domainPath: string;
  trustProxy: boolean | number;
  upstreamTimeoutMs: number;
  loginValidationTimeoutMs: number;
  wsIdleTimeoutMs: number;
  tlsRejectUnauthorized: boolean;
  allowMissingOrigin: boolean;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected a boolean, received "${value}"`);
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  const parsed = value === undefined ? defaultValue : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseOrigin(name: string, value: string): URL {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${name} must be an origin without credentials, path, query, or fragment`);
  }
  return url;
}

function normalizeDomainPath(value: string | undefined): string {
  const trimmed = (value ?? '/').trim();
  const segments = trimmed.split('/').filter(Boolean);
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (value === undefined || value === '0' || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1)
    throw new Error('GATEWAY_TRUST_PROXY must be true, false, or a positive integer');
  return hops;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const production = env.NODE_ENV === 'production';
  const upstreamValue = env.MESH_CENTRAL_BASE_URL;
  const publicOriginValue = env.GATEWAY_PUBLIC_ORIGIN;

  if (!upstreamValue) throw new Error('MESH_CENTRAL_BASE_URL is required');
  if (!publicOriginValue && production)
    throw new Error('GATEWAY_PUBLIC_ORIGIN is required in production');

  const upstreamBaseUrl = parseOrigin('MESH_CENTRAL_BASE_URL', upstreamValue);
  if (upstreamBaseUrl.protocol !== 'https:' && production) {
    throw new Error('MESH_CENTRAL_BASE_URL must use HTTPS in production');
  }
  if (upstreamBaseUrl.protocol !== 'https:' && upstreamBaseUrl.protocol !== 'http:') {
    throw new Error('MESH_CENTRAL_BASE_URL must use HTTP or HTTPS');
  }

  const publicOrigin = parseOrigin(
    'GATEWAY_PUBLIC_ORIGIN',
    publicOriginValue ?? 'http://localhost:5173',
  );
  const tlsRejectUnauthorized = parseBoolean(env.GATEWAY_TLS_REJECT_UNAUTHORIZED, true);
  if (production && !tlsRejectUnauthorized) {
    throw new Error('TLS certificate verification cannot be disabled in production');
  }

  return {
    port: parsePositiveInteger('PORT', env.PORT, 3000),
    publicOrigin,
    upstreamBaseUrl,
    domainPath: normalizeDomainPath(env.MESH_CENTRAL_DOMAIN_PATH),
    trustProxy: parseTrustProxy(env.GATEWAY_TRUST_PROXY),
    upstreamTimeoutMs: parsePositiveInteger(
      'GATEWAY_UPSTREAM_TIMEOUT_MS',
      env.GATEWAY_UPSTREAM_TIMEOUT_MS,
      10_000,
    ),
    loginValidationTimeoutMs: parsePositiveInteger(
      'GATEWAY_LOGIN_VALIDATION_TIMEOUT_MS',
      env.GATEWAY_LOGIN_VALIDATION_TIMEOUT_MS,
      5_000,
    ),
    wsIdleTimeoutMs: parsePositiveInteger(
      'GATEWAY_WS_IDLE_TIMEOUT_MS',
      env.GATEWAY_WS_IDLE_TIMEOUT_MS,
      0,
    ),
    tlsRejectUnauthorized,
    allowMissingOrigin: parseBoolean(env.GATEWAY_ALLOW_MISSING_ORIGIN, !production),
  };
}

export function buildUpstreamUrl(config: GatewayConfig, path: string): URL {
  const relativePath = path.replace(/^\/+/, '');
  return new URL(`${config.domainPath}${relativePath}`, config.upstreamBaseUrl);
}
