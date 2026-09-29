export interface MeshCentralErrorContext {
  action?: string;
  requestId?: string;
  deviceId?: string;
  retryable?: boolean;
  response?: unknown;
}

export class MeshCentralError extends Error {
  constructor(
    message: string,
    readonly context: MeshCentralErrorContext = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class MeshCentralAuthenticationError extends MeshCentralError {}
export class MeshCentralConnectionError extends MeshCentralError {}
export class MeshCentralConnectionClosedError extends MeshCentralError {}
export class MeshCentralRequestTimeoutError extends MeshCentralError {}
export class MeshCentralProtocolError extends MeshCentralError {}
export class MeshCentralServerError extends MeshCentralError {}
export class MeshCentralValidationError extends MeshCentralError {}
export class MeshCentralClientDestroyedError extends MeshCentralError {}
