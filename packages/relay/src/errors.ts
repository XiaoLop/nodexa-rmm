export class RelayError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RelayError';
  }
}

export class RelayAuthenticationError extends RelayError {
  constructor(message = 'Relay authorization failed.', options?: ErrorOptions) {
    super(message, 'RELAY_AUTHENTICATION_FAILED', options);
    this.name = 'RelayAuthenticationError';
  }
}

export class RelayConnectionError extends RelayError {
  constructor(message = 'Relay connection failed.', options?: ErrorOptions) {
    super(message, 'RELAY_CONNECTION_FAILED', options);
    this.name = 'RelayConnectionError';
  }
}

export class RelayAgentRouteError extends RelayError {
  constructor(message = 'The device Agent could not route the relay tunnel.', options?: ErrorOptions) {
    super(message, 'RELAY_AGENT_ROUTE_FAILED', options);
    this.name = 'RelayAgentRouteError';
  }
}

export class RelayHandshakeError extends RelayError {
  constructor(message = 'Relay handshake failed.', options?: ErrorOptions) {
    super(message, 'RELAY_HANDSHAKE_FAILED', options);
    this.name = 'RelayHandshakeError';
  }
}

export class RelayProtocolError extends RelayError {
  constructor(message = 'Relay protocol error.', options?: ErrorOptions) {
    super(message, 'RELAY_PROTOCOL_ERROR', options);
    this.name = 'RelayProtocolError';
  }
}

export class RelayTimeoutError extends RelayError {
  constructor(message = 'Relay operation timed out.', options?: ErrorOptions) {
    super(message, 'RELAY_TIMEOUT', options);
    this.name = 'RelayTimeoutError';
  }
}

export class RelayCancelledError extends RelayError {
  constructor(message = 'Relay operation was cancelled.', options?: ErrorOptions) {
    super(message, 'RELAY_CANCELLED', options);
    this.name = 'RelayCancelledError';
  }
}
