import { RelayAuthenticationError, RelayCancelledError } from './errors';
import { RelayConnection } from './RelayConnection';
import { buildAgentRelayPath } from './relayUrl';
import { RelaySession } from './RelaySession';
import type {
  CreateRelaySessionOptions,
  RelayAuthorization,
  RelayClientOptions,
  RelayConnectionState,
} from './types';

function defaultRelayId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAuthorization(value: unknown): RelayAuthorization {
  if (!isRecord(value)) throw new RelayAuthenticationError('Invalid relay authorization response.');
  const nested = [value.data, value.payload, value.message].find(isRecord);
  const response =
    typeof value.cookie === 'string' || typeof value.rcookie === 'string'
      ? value
      : (nested ?? value);
  if (typeof response.cookie !== 'string' || typeof response.rcookie !== 'string') {
    throw new RelayAuthenticationError('Relay authorization response omitted cookie or rcookie.');
  }
  return { cookie: response.cookie, rcookie: response.rcookie };
}

export class RelayClient {
  constructor(private readonly options: RelayClientOptions) {}

  async createSession(options: CreateRelaySessionOptions): Promise<RelaySession> {
    if (options.signal?.aborted) throw new RelayCancelledError();
    let state: RelayConnectionState = 'idle';
    const setState = (current: RelayConnectionState, error?: Error) => {
      if (current === state) return;
      const previous = state;
      state = current;
      options.onStateChange?.({ previous, current, error });
    };

    try {
      setState('authorizing');
      const authorizationResponse = await this.options.control.request(
        { action: 'authcookie' },
        options.authorizationTimeoutMs ?? this.options.authorizationTimeoutMs ?? 15_000,
      );
      if (options.signal?.aborted) throw new RelayCancelledError();
      const authorization = parseAuthorization(authorizationResponse);
      const relayId = options.relayId ?? this.options.createRelayId?.() ?? defaultRelayId();

      setState('notifying');
      this.options.control.send({
        action: 'msg',
        nodeid: options.deviceId,
        type: 'tunnel',
        usage: options.usage ?? options.protocol,
        value: buildAgentRelayPath(
          options.deviceId,
          options.protocol,
          relayId,
          authorization.rcookie,
        ),
        responseid: `relay-${relayId}`,
      });
      if (options.signal?.aborted) throw new RelayCancelledError();

      const connection = new RelayConnection({
        baseUrl: this.options.baseUrl,
        deviceId: options.deviceId,
        protocol: options.protocol,
        relayId,
        authCookie: authorization.cookie,
        webSocketFactory: this.options.webSocketFactory,
        connectionTimeoutMs: options.connectionTimeoutMs ?? this.options.connectionTimeoutMs,
        handshakeTimeoutMs: options.handshakeTimeoutMs ?? this.options.handshakeTimeoutMs,
        binaryType: 'arraybuffer',
        onRawMessage: options.onRawMessage,
      });
      connection.on('state', ({ current, error }) => setState(current, error));
      if (options.onError) connection.on('error', options.onError);
      if (options.onClose) connection.on('close', options.onClose);
      const session = new RelaySession({
        id: relayId,
        deviceId: options.deviceId,
        protocol: options.protocol,
        connection,
      });
      await connection.connect(options.signal);
      return session;
    } catch (error) {
      const relayError = error instanceof Error ? error : new Error('Unknown relay error.');
      setState('error', relayError);
      throw relayError;
    }
  }
}
