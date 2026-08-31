export interface GatewayErrorContext {
  action?: string;
  requestId?: string;
  deviceId?: string;
  retryable?: boolean;
  response?: unknown;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly context: GatewayErrorContext = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GatewayAuthenticationError extends GatewayError {}
export class GatewayConnectionError extends GatewayError {}
export class GatewayConnectionClosedError extends GatewayError {}
export class GatewayRequestTimeoutError extends GatewayError {}
export class GatewayProtocolError extends GatewayError {}
export class GatewayServerError extends GatewayError {}
export class GatewayValidationError extends GatewayError {}
export class GatewayClientDestroyedError extends GatewayError {}
