export type McpErrorCode =
  | 'SESSION_MISSING'
  | 'SESSION_EXPIRED'
  | 'SESSION_SERVER_MISMATCH'
  | 'INSECURE_SESSION_FILE'
  | 'TWO_FACTOR_REQUIRED'
  | 'LOGIN_FAILED'
  | 'NOT_CONNECTED'
  | 'UPSTREAM_TIMEOUT'
  | 'FORBIDDEN'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN_TOOL'
  | 'INTERNAL';

export interface McpToolErrorOptions {
  hint?: string;
  retryable?: boolean;
  details?: unknown;
  cause?: unknown;
}

export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly hint?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: McpErrorCode, message: string, options: McpToolErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'McpToolError';
    this.code = code;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.hint === undefined ? {} : { hint: this.hint }),
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function isMcpToolError(value: unknown): value is McpToolError {
  return value instanceof McpToolError;
}
