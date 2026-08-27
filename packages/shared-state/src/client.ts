import { meshCentralGatewayAdapter } from './protocol';
import type { GatewayStore } from './store';
import type { GatewayProtocolAdapter, WebSocketFactory, WebSocketLike } from './types';

const OPEN = 1;
const CLOSE_INITIALIZATION_FAILED = 4000;
const CLOSE_AUTHENTICATION_FAILED = 4001;
const CLOSE_AUTHENTICATION_TIMEOUT = 4002;
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  action?: string;
  deviceId?: string;
}

export class GatewayAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayAuthenticationError';
  }
}

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
  private readonly pendingRequests = new Map<string, PendingRequest>();

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
            new GatewayAuthenticationError(connectionResult.error),
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
        this.rejectPendingRequests(new Error(event.reason || 'Gateway connection closed.'));
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
    this.rejectPendingRequests(new Error('Gateway client disconnected.'));
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

  request<T = unknown>(payload: Record<string, unknown>, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
    const responseId =
      typeof payload.responseid === 'string' && payload.responseid
        ? payload.responseid
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(responseId);
        reject(new Error(`Gateway request timed out: ${String(payload.action ?? responseId)}`));
      }, timeoutMs);

      this.pendingRequests.set(responseId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
        action: typeof payload.action === 'string' ? payload.action : undefined,
        deviceId: typeof payload.nodeid === 'string' ? payload.nodeid : undefined,
      });

      try {
        this.send({ ...payload, responseid: responseId });
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(responseId);
        reject(error instanceof Error ? error : new Error('Gateway request failed.'));
      }
    });
  }

  requestSystemInfo<T = unknown>(deviceId: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
    const responseId = `req-sysinfo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const request = this.protocol.createSystemInfoRequest?.(deviceId, responseId) ?? {
      action: 'getsysinfo',
      nodeid: deviceId,
      nodeinfo: true,
      responseid: responseId,
    };
    if (typeof request !== 'object' || request === null || Array.isArray(request)) {
      return Promise.reject(new Error('Gateway protocol returned an invalid system information request.'));
    }
    return this.request<T>(request as Record<string, unknown>, timeoutMs);
  }

  // 请求快照
  requestSnapshot(): void {
    const req = this.protocol.createSnapshotRequest();
    if (Array.isArray(req)) {
      for (const item of req) {
        this.send(item);
      }
    } else {
      this.send(req);
    }
  }

  // 刷新设备与分组
  refreshDevices(): void {
    this.requestSnapshot();
  }

  // 更新设备属性
  updateDevice(
    deviceId: string,
    updates: { name?: string; desc?: string; groupId?: string },
  ): void {
    const req = this.protocol.createChangeDeviceRequest?.(deviceId, updates);
    if (req) {
      this.send(req);
    }
  }

  // 发送设备电源指令
  sendPowerAction(
    deviceId: string,
    action: 'wake' | 'reset' | 'poweroff' | 'sleep',
  ): void {
    const req = this.protocol.createPowerActionRequest?.(deviceId, action);
    if (req) {
      this.send(req);
    }
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
      this.resolvePendingRequest(payload);
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

  private resolvePendingRequest(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return;
    const outerRecord = payload as Record<string, unknown>;
    const nestedRecord = [outerRecord.data, outerRecord.payload, outerRecord.message].find(
      (value): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value),
    );
    const record =
      typeof outerRecord.action === 'string' || typeof outerRecord.responseid === 'string'
        ? outerRecord
        : nestedRecord ?? outerRecord;
    const responseId =
      typeof record.responseid === 'string'
        ? record.responseid
        : typeof record.tag === 'string'
          ? record.tag
          : undefined;
    let matchedResponseId = responseId;
    let pending = responseId ? this.pendingRequests.get(responseId) : undefined;

    // MeshCentral 的部分信息响应（包括某些版本的 getsysinfo）不会回传 responseid。
    // 此时按 action 和 nodeid 匹配；只有候选唯一时才消费请求，避免并发串包。
    if (!pending && typeof record.action === 'string') {
      const nodeRecord =
        typeof record.node === 'object' && record.node !== null && !Array.isArray(record.node)
          ? record.node as Record<string, unknown>
          : undefined;
      const responseDeviceId =
        typeof record.nodeid === 'string'
          ? record.nodeid
          : typeof nodeRecord?._id === 'string'
            ? nodeRecord._id
            : undefined;
      const matches = [...this.pendingRequests.entries()].filter(([, candidate]) =>
        candidate.action === record.action &&
        (!responseDeviceId || !candidate.deviceId || candidate.deviceId === responseDeviceId),
      );
      if (matches.length === 1) {
        const match = matches[0];
        if (match) [matchedResponseId, pending] = match;
      }
    }

    if (!pending) return;
    clearTimeout(pending.timer);
    if (matchedResponseId) this.pendingRequests.delete(matchedResponseId);
    const error = record.error ?? record.err;
    if (typeof error === 'string' && error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(payload);
    }
  }

  private rejectPendingRequests(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
