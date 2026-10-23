import {
  MeshCentralAuthenticationError,
  MeshCentralClientDestroyedError,
  MeshCentralConnectionClosedError,
  MeshCentralConnectionError,
  MeshCentralError,
  MeshCentralProtocolError,
  MeshCentralRequestTimeoutError,
  MeshCentralServerError,
  MeshCentralValidationError,
} from '@meshcentral/control-client';

import { McpToolError, isMcpToolError } from '../errors';

const REAUTH_HINT = 'Run `meshcentral-mcp login` to authenticate again.';
const RESTART_HINT = 'Restart the MCP server process.';

export function toMcpToolError(error: unknown): McpToolError {
  if (isMcpToolError(error)) return error;

  if (error instanceof MeshCentralAuthenticationError) {
    return new McpToolError('SESSION_EXPIRED', 'MeshCentral rejected the session credentials.', {
      hint: REAUTH_HINT,
      cause: error,
    });
  }

  if (error instanceof MeshCentralRequestTimeoutError) {
    return new McpToolError('UPSTREAM_TIMEOUT', 'MeshCentral did not answer before the request timeout.', {
      retryable: true,
      hint: 'Retry the call, or raise MESHCENTRAL_MCP_REQUEST_TIMEOUT_MS.',
      cause: error,
    });
  }

  if (error instanceof MeshCentralConnectionClosedError) {
    return new McpToolError('NOT_CONNECTED', 'The MeshCentral control channel was closed.', {
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof MeshCentralConnectionError) {
    return new McpToolError('NOT_CONNECTED', 'The MeshCentral control channel is not available.', {
      retryable: error.context.retryable === true,
      hint: 'Check the server URL, TLS configuration and network reachability.',
      cause: error,
    });
  }

  if (error instanceof MeshCentralValidationError) {
    return new McpToolError('INVALID_ARGUMENT', error.message, { cause: error });
  }

  if (error instanceof MeshCentralClientDestroyedError) {
    return new McpToolError('INTERNAL', 'The MeshCentral client has been destroyed.', {
      hint: RESTART_HINT,
      cause: error,
    });
  }

  if (error instanceof MeshCentralProtocolError || error instanceof MeshCentralServerError) {
    return new McpToolError('INTERNAL', error.message, {
      retryable: error.context.retryable === true,
      cause: error,
    });
  }

  if (error instanceof MeshCentralError) {
    return new McpToolError('INTERNAL', error.message, {
      retryable: error.context.retryable === true,
      cause: error,
    });
  }

  if (isAbortError(error)) {
    return new McpToolError('UPSTREAM_TIMEOUT', 'The operation was aborted before it completed.', {
      retryable: true,
      cause: error,
    });
  }

  return new McpToolError('INTERNAL', describeUnknown(error), { cause: error });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function describeUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unexpected failure while talking to MeshCentral.';
}
