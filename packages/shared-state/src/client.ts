import { meshCentralGatewayAdapter } from './protocol';
import type { GatewayStore } from './store';
import type { GatewayProtocolAdapter, WebSocketFactory, WebSocketLike } from './types';

const OPEN = 1;
const CLOSE_INITIALIZATION_FAILED = 4000;
const CLOSE_AUTHENTICATION_FAILED = 4001;
const CLOSE_AUTHENTICATION_TIMEOUT = 4002;
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

export interface GatewayClientOptions {
  url: string;
  store: GatewayStore;
  webSocketFactory?: WebSocketFactory;
  protocol?: GatewayProtocolAdapter;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  heartbeatIntervalMs?: number;
  connectionTimeoutMs?: number;
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
  private readonly connectionTimeoutMs: number;
  private readonly reconnectDelaysMs: number[];

  constructor(private readonly options: GatewayClientOptions) {
    this.protocol = options.protocol ?? meshCentralGatewayAdapter;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 27_500;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 15_000;
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS;
    this.webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
  }

  // 连接
  connect(): Promise<void> {
    // 销毁
    if (this.destroyed) return Promise.reject(new Error('Gateway client has been destroyed.'));
    if (!this.options.url)
      return Promise.reject(new Error('Gateway WebSocket URL is not configured.'));
    if (this.connectPromise) return this.connectPromise; // 避免重复连接
    if (this.socket?.readyState === OPEN) return Promise.resolve(); // 已经连接

    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.options.store
      .getState()
      .setConnectionStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let connectionRejected = false;
      let connectionTimer: ReturnType<typeof setTimeout> | undefined;
      const receivedConnectionSignals = new Set<string>();
      const socket = this.webSocketFactory(this.options.url);
      this.socket = socket;

      const clearConnectionTimer = () => {
        if (connectionTimer) clearTimeout(connectionTimer);
        connectionTimer = undefined;
      };

      const rejectConnection = (error: Error, closeCode: number, closeReason: string) => {
        if (settled) return;
        settled = true;
        clearConnectionTimer();
        this.options.store.getState().setConnectionStatus('error', error.message);
        reject(error);
        socket.close(closeCode, closeReason);
      };

      const acceptConnection = () => {
        if (settled) return;
        settled = true;
        clearConnectionTimer();
        this.finishInitialization();
        resolve();
      };

      socket.onopen = () => {
        void this.handleOpen()
          .then(() => {
            if (settled) return;
            connectionTimer = setTimeout(() => {
              rejectConnection(
                new Error('Timed out while waiting for gateway authentication.'),
                CLOSE_AUTHENTICATION_TIMEOUT,
                'Authentication timeout',
              );
            }, this.connectionTimeoutMs);
          })
          .catch((error: unknown) => {
            rejectConnection(
              error instanceof Error ? error : new Error('Gateway initialization failed.'),
              CLOSE_INITIALIZATION_FAILED,
              'Initialization failed',
            );
          });
      };
      socket.onmessage = (event) => {
        const connectionResult = this.handleMessage(event.data);
        if (settled || !connectionResult) return;

        if (connectionResult.status === 'rejected') {
          connectionRejected = true;
          rejectConnection(
            new Error(connectionResult.error),
            CLOSE_AUTHENTICATION_FAILED,
            'Authentication failed',
          );
          return;
        }
        if (connectionResult.status === 'accepted') {
          acceptConnection();
          return;
        }
        if (connectionResult.signal) receivedConnectionSignals.add(connectionResult.signal);
        const requiredSignals = this.protocol.requiredConnectionSignals;
        if (
          requiredSignals?.length &&
          requiredSignals.every((signal) => receivedConnectionSignals.has(signal))
        ) {
          acceptConnection();
        }
      };
      socket.onerror = () => {
        this.options.store.getState().setConnectionStatus('error', 'WebSocket connection error.');
        if (!settled) {
          settled = true;
          clearConnectionTimer();
          reject(new Error('WebSocket connection error.'));
        }
      };
      socket.onclose = (event) => {
        clearConnectionTimer();
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
        if (connectionRejected) return;
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

  // 断开连接
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

  // 销毁客户端
  destroy(): void {
    this.destroyed = true;
    this.disconnect();
  }

  // 发送消息
  send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== OPEN) {
      throw new Error('Gateway WebSocket is not connected.');
    }
    this.socket.send(JSON.stringify(payload));
  }

  // 请求快照
  requestSnapshot(): void {
    this.send(this.protocol.createSnapshotRequest());
  }

  private async handleOpen(): Promise<void> {
    const token = await this.options.getAccessToken?.();
    if (token) this.send(this.protocol.createAuthenticationMessage(token));
  }

  private finishInitialization(): void {
    this.reconnectAttempt = 0;
    this.options.store.getState().setConnectionStatus('connected');
    this.requestSnapshot();
    this.startHeartbeat();
  }

  private handleMessage(data: unknown) {
    try {
      const text = typeof data === 'string' ? data : String(data);
      const payload: unknown = JSON.parse(text);
      const state = this.options.store.getState();
      state.touchMessage();
      for (const mutation of this.protocol.decode(payload)) state.applyMutation(mutation);
      return this.protocol.inspectConnectionMessage?.(payload) ?? { status: 'accepted' as const };
    } catch {
      this.options.store.getState().setError('Received an invalid gateway message.');
      return undefined;
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
