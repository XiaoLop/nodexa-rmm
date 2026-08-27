import {
  RelayCancelledError,
  RelayConnectionError,
  RelayHandshakeError,
  RelayTimeoutError,
} from './errors';
import { buildRelayUrl } from './relayUrl';
import type {
  RelayConnectionEvents,
  RelayConnectionOptions,
  RelayConnectionState,
  RelayEventListener,
  RelayInboundData,
  RelayOutboundData,
  RelayWebSocketLike,
} from './types';

const OPEN = 1;
const CONNECTING = 0;
const NORMAL_CLOSE = 1000;
const CANCELLED_CLOSE = 4000;

function defaultWebSocketFactory(url: string): RelayWebSocketLike {
  return new WebSocket(url) as unknown as RelayWebSocketLike;
}

function isDefaultHandshakeMessage(data: RelayInboundData): boolean {
  return data === 'c' || data === 'cr';
}

export class RelayConnection {
  private socket?: RelayWebSocketLike;
  private stateValue: RelayConnectionState = 'idle';
  private connectPromise?: Promise<void>;
  private readonly listeners: {
    [K in keyof RelayConnectionEvents]: Set<RelayEventListener<RelayConnectionEvents[K]>>;
  } = {
    state: new Set(),
    message: new Set(),
    close: new Set(),
    error: new Set(),
  };

  constructor(private readonly options: RelayConnectionOptions) {}

  get state(): RelayConnectionState {
    return this.stateValue;
  }

  get url(): string {
    return buildRelayUrl(this.options);
  }

  on<K extends keyof RelayConnectionEvents>(
    event: K,
    listener: RelayEventListener<RelayConnectionEvents[K]>,
  ): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  connect(signal?: AbortSignal): Promise<void> {
    if (this.stateValue === 'ready') return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    if (signal?.aborted) return Promise.reject(new RelayCancelledError());

    this.setState('connecting');
    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let connectionTimer: ReturnType<typeof setTimeout> | undefined;
      let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
      const webSocketFactory = this.options.webSocketFactory ?? defaultWebSocketFactory;
      const socket = webSocketFactory(this.url);
      this.socket = socket;
      if (this.options.binaryType) socket.binaryType = this.options.binaryType;

      const clearTimers = () => {
        if (connectionTimer) clearTimeout(connectionTimer);
        if (handshakeTimer) clearTimeout(handshakeTimer);
        connectionTimer = undefined;
        handshakeTimer = undefined;
      };
      const removeAbortListener = () => signal?.removeEventListener('abort', handleAbort);
      const rejectConnection = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimers();
        removeAbortListener();
        this.setState('error', error);
        this.emit('error', error);
        reject(error);
      };
      const handleAbort = () => {
        const error = new RelayCancelledError();
        rejectConnection(error);
        socket.close(CANCELLED_CLOSE, error.message);
      };

      signal?.addEventListener('abort', handleAbort, { once: true });
      connectionTimer = setTimeout(() => {
        const error = new RelayTimeoutError('Timed out while connecting to the relay.');
        rejectConnection(error);
        socket.close(CANCELLED_CLOSE, error.message);
      }, this.options.connectionTimeoutMs ?? 15_000);

      socket.onopen = () => {
        if (settled) return;
        if (connectionTimer) clearTimeout(connectionTimer);
        connectionTimer = undefined;
        this.setState('handshaking');
        handshakeTimer = setTimeout(() => {
          const error = new RelayTimeoutError('Timed out while waiting for the relay handshake.');
          rejectConnection(error);
          socket.close(CANCELLED_CLOSE, error.message);
        }, this.options.handshakeTimeoutMs ?? 15_000);
      };
      socket.onmessage = (event) => {
        this.options.onRawMessage?.(event.data);
        if (!settled && this.stateValue === 'handshaking') {
          const isHandshake = this.options.isHandshakeMessage ?? isDefaultHandshakeMessage;
          if (!isHandshake(event.data)) {
            const error = new RelayHandshakeError('Received an invalid relay handshake message.');
            rejectConnection(error);
            socket.close(CANCELLED_CLOSE, error.message);
            return;
          }
          settled = true;
          clearTimers();
          removeAbortListener();
          socket.send(String(this.options.protocol));
          this.setState('ready');
          resolve();
          return;
        }
        if (this.stateValue === 'ready') this.emit('message', event.data);
      };
      socket.onerror = () => {
        const error = new RelayConnectionError('Relay WebSocket error.');
        if (!settled) rejectConnection(error);
        else {
          this.setState('error', error);
          this.emit('error', error);
        }
      };
      socket.onclose = (event) => {
        clearTimers();
        removeAbortListener();
        this.socket = undefined;
        this.connectPromise = undefined;
        if (!settled) {
          const error = new RelayConnectionError(
            event.reason || 'Relay closed before the handshake completed.',
          );
          rejectConnection(error);
        } else if (this.stateValue === 'closing') {
          this.setState('closed');
        } else if (this.stateValue !== 'error') {
          const error = new RelayConnectionError(event.reason || 'Relay connection was lost.');
          this.setState('error', error);
          this.emit('error', error);
        }
        this.emit('close', event);
      };
    }).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  send(data: RelayOutboundData): void {
    if (!this.socket || this.socket.readyState !== OPEN || this.stateValue !== 'ready') {
      throw new RelayConnectionError('Relay connection is not ready.');
    }
    this.socket.send(data);
  }

  sendText(text: string): void {
    this.send(text);
  }

  sendJson(payload: unknown): void {
    this.send(JSON.stringify(payload));
  }

  sendBinary(data: Exclude<RelayOutboundData, string>): void {
    this.send(data);
  }

  close(code = NORMAL_CLOSE, reason = 'Relay session closed.'): void {
    if (this.stateValue === 'closed' || this.stateValue === 'idle') {
      this.setState('closed');
      return;
    }
    this.setState('closing');
    if (this.socket?.readyState === OPEN || this.socket?.readyState === CONNECTING) {
      this.socket.close(code, reason);
    } else {
      this.socket = undefined;
      this.setState('closed');
    }
  }

  cancel(reason = 'Relay session was cancelled.'): void {
    this.close(CANCELLED_CLOSE, reason);
  }

  private setState(state: RelayConnectionState, error?: Error): void {
    if (state === this.stateValue) return;
    const previous = this.stateValue;
    this.stateValue = state;
    this.emit('state', { previous, current: state, error });
  }

  private emit<K extends keyof RelayConnectionEvents>(
    event: K,
    value: RelayConnectionEvents[K],
  ): void {
    for (const listener of this.listeners[event]) listener(value);
  }
}
