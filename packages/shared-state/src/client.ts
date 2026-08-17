import { meshCentralGatewayAdapter } from './protocol';
import type { GatewayStore } from './store';
import type { GatewayProtocolAdapter, WebSocketFactory, WebSocketLike } from './types';

const OPEN = 1;
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

export interface GatewayClientOptions {
  url: string;
  store: GatewayStore;
  webSocketFactory?: WebSocketFactory;
  protocol?: GatewayProtocolAdapter;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  heartbeatIntervalMs?: number;
  reconnectDelaysMs?: number[];
}

export class GatewayClient {
  private socket?: WebSocketLike;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private destroyed = false;
  private connectPromise?: Promise<void>;
  private readonly protocol: GatewayProtocolAdapter;
  private readonly webSocketFactory: WebSocketFactory;
  private readonly heartbeatIntervalMs: number;
  private readonly reconnectDelaysMs: number[];

  constructor(private readonly options: GatewayClientOptions) {
    this.protocol = options.protocol ?? meshCentralGatewayAdapter;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 27_500;
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS;
    this.webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
  }

  connect(): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Gateway client has been destroyed.'));
    if (!this.options.url)
      return Promise.reject(new Error('Gateway WebSocket URL is not configured.'));
    if (this.socket?.readyState === OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.options.store
      .getState()
      .setConnectionStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = this.webSocketFactory(this.options.url);
      this.socket = socket;

      socket.onopen = () => {
        void this.handleOpen()
          .then(() => {
            settled = true;
            resolve();
          })
          .catch((error: unknown) => {
            settled = true;
            reject(error);
            socket.close(1011, 'Initialization failed');
          });
      };
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => {
        this.options.store.getState().setConnectionStatus('error', 'WebSocket connection error.');
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket connection error.'));
        }
      };
      socket.onclose = (event) => {
        this.stopHeartbeat();
        this.socket = undefined;
        this.connectPromise = undefined;
        if (!settled) {
          settled = true;
          reject(new Error(event.reason || 'WebSocket closed before connecting.'));
        }
        if (this.manuallyClosed || this.destroyed) {
          this.options.store.getState().setConnectionStatus('disconnected');
          return;
        }
        this.options.store
          .getState()
          .setConnectionStatus('reconnecting', event.reason || 'Connection lost.');
        this.scheduleReconnect();
      };
    }).finally(() => {
      this.connectPromise = undefined;
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.reconnectAttempt = 0;
    this.options.store.getState().setReconnectAttempt(0);
    this.socket?.close(1000, 'Client disconnected');
    this.socket = undefined;
    this.options.store.getState().setConnectionStatus('disconnected');
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
  }

  send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== OPEN) {
      throw new Error('Gateway WebSocket is not connected.');
    }
    this.socket.send(JSON.stringify(payload));
  }

  requestSnapshot(): void {
    this.send(this.protocol.createSnapshotRequest());
  }

  private async handleOpen(): Promise<void> {
    this.reconnectAttempt = 0;
    const token = await this.options.getAccessToken?.();
    if (token) this.send(this.protocol.createAuthenticationMessage(token));
    this.options.store.getState().setConnectionStatus('connected');
    this.requestSnapshot();
    this.startHeartbeat();
  }

  private handleMessage(data: unknown): void {
    try {
      const text = typeof data === 'string' ? data : String(data);
      const payload: unknown = JSON.parse(text);
      const state = this.options.store.getState();
      state.touchMessage();
      for (const mutation of this.protocol.decode(payload)) state.applyMutation(mutation);
    } catch {
      this.options.store.getState().setError('Received an invalid gateway message.');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === OPEN) {
        this.send(this.protocol.createHeartbeatMessage());
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.manuallyClosed || this.destroyed) return;
    const delay =
      this.reconnectDelaysMs[Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)] ??
      60_000;
    this.reconnectAttempt += 1;
    this.options.store.getState().setReconnectAttempt(this.reconnectAttempt);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => undefined);
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }
}
