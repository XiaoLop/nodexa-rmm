import { McpToolError } from '../errors';

export interface LoginClientOptions {
  readonly httpBaseUrl: string;
  readonly authPath?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

export interface PasswordCredentials {
  readonly username: string;
  readonly password: string;
  readonly rememberToken?: boolean;
}

export interface TwoFactorVerification {
  readonly transactionId: string;
  readonly type: string;
  readonly code: string;
  readonly rememberToken?: boolean;
}

export type LoginOutcome =
  | {
      readonly kind: 'success';
      readonly cookieHeader: string;
      readonly userId?: string;
      readonly userName?: string;
      readonly siteAdmin?: boolean;
    }
  | {
      readonly kind: 'two-factor-required';
      readonly transactionId: string;
      readonly methods: readonly string[];
      readonly expiresIn?: number;
    };

interface JsonAuthResponse {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
  readonly data?: unknown;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const PRESERVED_COOKIE_PREFIXES = ['xid'];
const DROPPED_COOKIE_PREFIXES = ['twofactor'];

export class LoginClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: LoginClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get loginUrl(): string {
    return `${this.options.httpBaseUrl}${this.authPath}/login`;
  }

  get verifyUrl(): string {
    return `${this.options.httpBaseUrl}${this.authPath}/login/verify-2fa`;
  }

  get logoutUrl(): string {
    return `${this.options.httpBaseUrl}${this.authPath}/logout`;
  }

  private get authPath(): string {
    const value = this.options.authPath?.trim();
    if (!value) return '/auth';
    const withLeading = value.startsWith('/') ? value : `/${value}`;
    return withLeading.replace(/\/+$/, '');
  }

  async login(credentials: PasswordCredentials): Promise<LoginOutcome> {
    return this.post(this.loginUrl, {
      username: credentials.username,
      password: credentials.password,
      ...(credentials.rememberToken === undefined
        ? {}
        : { rememberToken: credentials.rememberToken }),
    });
  }

  async verifyTwoFactor(verification: TwoFactorVerification): Promise<LoginOutcome> {
    return this.post(this.verifyUrl, {
      transactionId: verification.transactionId,
      type: verification.type,
      code: verification.code,
      ...(verification.rememberToken === undefined
        ? {}
        : { rememberToken: verification.rememberToken }),
    });
  }

  async logout(cookieHeader: string): Promise<void> {
    try {
      await this.request(this.logoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: '{}',
      });
    } catch {
      // Logging out locally is enough; the server session expires on its own.
    }
  }

  private async post(url: string, body: Record<string, unknown>): Promise<LoginOutcome> {
    const response = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let payload: JsonAuthResponse;
    try {
      payload = JSON.parse(responseText) as JsonAuthResponse;
    } catch {
      throw new McpToolError('LOGIN_FAILED', 'MeshCentral returned a response that is not valid JSON.', {
        details: {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type') ?? undefined,
          body: summarizeResponseBody(responseText),
        },
      });
    }

    const status = typeof payload.status === 'string' ? payload.status : '';
    const message = typeof payload.message === 'string' ? payload.message : '';

    if (status === 'SUCCESS') {
      const cookieHeader = collectCookieHeader(response);
      if (!cookieHeader) {
        throw new McpToolError(
          'LOGIN_FAILED',
          'MeshCentral accepted the credentials but returned no session cookie.',
          {
            hint: 'Make sure the jsonauth plugin is enabled and the URL points at the MeshCentral server.',
          },
        );
      }
      const data = asRecord(payload.data);
      return {
        kind: 'success',
        cookieHeader,
        ...(typeof data.userid === 'string' ? { userId: data.userid } : {}),
        ...(typeof data.username === 'string' ? { userName: data.username } : {}),
        ...(typeof data.siteadmin === 'boolean' ? { siteAdmin: data.siteadmin } : {}),
      };
    }

    if (status === 'REQUIRE_2FA') {
      const data = asRecord(payload.data);
      const transactionId = typeof data.transactionId === 'string' ? data.transactionId : undefined;
      if (!transactionId) {
        throw new McpToolError('LOGIN_FAILED', 'MeshCentral requested two-factor verification without a transaction ID.');
      }
      return {
        kind: 'two-factor-required',
        transactionId,
        methods: readMethods(data.methods),
        ...(typeof data.expiresIn === 'number' ? { expiresIn: data.expiresIn } : {}),
      };
    }

    throw new McpToolError(
      'LOGIN_FAILED',
      message || `MeshCentral rejected the login attempt (${status || response.status}).`,
      {
        details: { status: status || undefined, httpStatus: response.status },
        hint: status === 'ACCOUNT_LOCKED' ? 'Wait for the lockout window to expire.' : undefined,
      },
    );
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new McpToolError('NOT_CONNECTED', `Unable to reach MeshCentral at ${this.options.httpBaseUrl}.`, {
        retryable: true,
        cause: error,
      });
    }

    return response;
  }
}

function readMethods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const methods: string[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record.supported === false) continue;
    if (typeof record.type === 'string' && record.type.length > 0) methods.push(record.type);
  }
  return methods;
}

export function collectCookieHeader(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const lines =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : splitCombinedCookieHeader(response.headers.get('set-cookie'));

  const pairs: string[] = [];
  for (const line of lines) {
    const pair = line.split(';')[0]?.trim();
    if (!pair) continue;
    const name = pair.slice(0, Math.max(0, pair.indexOf('='))).trim().toLowerCase();
    if (!name) continue;
    if (DROPPED_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    pairs.push(pair);
  }

  if (pairs.length === 0) return undefined;
  const hasSessionCookie = pairs.some((pair) =>
    PRESERVED_COOKIE_PREFIXES.some((prefix) => pair.toLowerCase().startsWith(`${prefix}=`)),
  );
  return hasSessionCookie ? pairs.join('; ') : undefined;
}

function splitCombinedCookieHeader(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=)/);
}

function summarizeResponseBody(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/g, ' ').trim();
  const limit = 1_000;
  return normalized.length > limit ? `${normalized.slice(0, limit)}…[truncated]` : normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
