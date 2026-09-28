export type LoginStatus =
  | 'SUCCESS'
  | 'BAD_PASSWORD'
  | 'ACCOUNT_LOCKED'
  | 'REQUIRE_2FA'
  | 'INVALID_2FA_TOKEN'
  | 'INVALID_AUTH_TRANSACTION'
  | 'AUTH_TRANSACTION_EXPIRED'
  | 'UNSUPPORTED_2FA_METHOD'
  | 'EMAIL_NOT_VERIFIED'
  | 'PASSWORD_EXPIRED'
  | 'PARAM_ERROR'
  | 'ACCESS_DENIED'
  | 'MAINTENANCE_MODE'
  | 'SERVER_UNAVAILABLE';

export interface LoginBody {
  username: string;
  password: string;
  rememberToken?: boolean;
}

export type SupportedTwoFactorMethod = 'totp' | 'backup';

export interface VerifyTwoFactorBody {
  transactionId: string;
  type: string;
  code?: string;
  rememberToken?: boolean;
}

export interface PendingAuthentication {
  id: string;
  userId: string;
  domainId: string;
  clientIp?: string;
  userAgent?: string;
  allowedMethods: string[];
  issuedAt: number;
  expiresAt: number;
  attempts: number;
}

export interface TwoFactorMethodDescription {
  type: string;
  supported: boolean;
}

export interface HandlerDependencies {
  delay(callback: () => void, milliseconds: number): void;
  randomDelay(): number;
  randomToken(): string;
  now(): number;
}