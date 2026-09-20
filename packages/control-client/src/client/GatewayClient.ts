import { EventDispatcher } from '../events/dispatcher';
import {
  GatewayAuthenticationError,
  GatewayClientDestroyedError,
  GatewayConnectionError,
  GatewayProtocolError,
} from '../errors';
import {
  createAuthenticationMessage,
  createHeartbeatMessage,
  decodePush,
  inspectConnectionMessage,
  requiredConnectionSignals,
} from '../protocol/codec';
import { DevicesResource } from '../resources/devices';
import { CommandsResource } from '../resources/commands';
import { EventsResource } from '../resources/events';
import { GroupsResource } from '../resources/groups';
import { UserGroupsResource } from '../resources/userGroups';
import { UsersResource } from '../resources/users';
import type {
  ConnectionStatus,
  GatewayClientEvents,
  GatewayClientOptions,
  GatewayEventChannel,
  GatewayListener,
  PowerAction,
  WebSocketLike,
} from '../types';
import { RequestManager } from './requestManager';

const OPEN = 1;
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

export class GatewayClient {
  readonly devices: DevicesResource;
  readonly commands: CommandsResource;
  readonly groups: GroupsResource;
  readonly events: EventsResource;
  readonly userGroups: UserGroupsResource;
  readonly users: UsersResource;
  private socket?: WebSocketLike;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private destroyed = false;
  private connectPromise?: Promise<void>;
  private status: ConnectionStatus = 'idle';
  private readonly dispatcher = new EventDispatcher();
  private readonly requestManager: RequestManager;
  private readonly webSocketFactory: NonNullable<GatewayClientOptions['webSocketFactory']>;
  private readonly heartbeatIntervalMs: number;
  private readonly connectionTimeoutMs: number;
  private readonly reconnectDelaysMs: number[];

  constructor(private readonly options: GatewayClientOptions) {
    this.webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 27_500;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 15_000;
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS;
    this.requestManager = new RequestManager(
      (payload) => this.send(payload),
      options.requestTimeoutMs ?? 15_000,
      (diagnostic) => this.dispatcher.emit('diagnostic', diagnostic),
    );
    this.devices = new DevicesResource(this);
    this.commands = new CommandsResource(this);
    this.groups = new GroupsResource(this);
    this.events = new EventsResource(this);
    this.userGroups = new UserGroupsResource(this);
    this.users = new UsersResource(this);
    if (options.onConnectionChange) this.on('connection', options.onConnectionChange);
    if (options.onEvent) this.on('event', options.onEvent);
    if (options.onError) this.on('error', options.onError);
    if (options.onDiagnostic) this.on('diagnostic', options.onDiagnostic);
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }
  get currentReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void {
    return this.dispatcher.on(channel, listener);
  }

  connect(): Promise<void> {
    if (this.destroyed)
      return Promise.reject(new GatewayClientDestroyedError('Gateway client has been destroyed.'));
    if (!this.options.url)
      return Promise.reject(new GatewayConnectionError('Gateway WebSocket URL is not configured.'));
    if (this.connectPromise) return this.connectPromise;
    if (this.socket?.readyState === OPEN && this.status === 'connected') return Promise.resolve();
    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    this.connectPromise = this.openSocket().finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.requestManager.rejectAll('Gateway client disconnected.');
    this.reconnectAttempt = 0;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close(1000, 'Client disconnected');
    if (!this.destroyed) this.setStatus('disconnected');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.disconnect();
    this.setStatus('destroyed');
    this.dispatcher.clear();
  }

  send(payload: unknown): void {
    if (this.destroyed) throw new GatewayClientDestroyedError('Gateway client has been destroyed.');
    if (!this.socket || this.socket.readyState !== OPEN)
      throw new GatewayConnectionError('Gateway WebSocket is not connected.', { retryable: true });
    this.socket.send(JSON.stringify(payload));
  }
  request<T = unknown>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    return this.requestManager.request<T>(payload, timeoutMs);
  }
  requestSystemInfo<T = unknown>(deviceId: string, timeoutMs?: number): Promise<T> {
    return this.devices.systemInfo<T>(deviceId, timeoutMs);
  }
  requestSnapshot(): void {
    void Promise.all([this.devices.list(), this.groups.list(), this.devices.lastConnects()]).catch(
      (error) => this.emitError(error),
    );
  }
  refreshDevices(): void {
    this.requestSnapshot();
  }
  updateDevice(
    deviceId: string,
    updates: { name?: string; desc?: string; groupId?: string },
  ): void {
    void this.devices.update(deviceId, updates).catch((error) => this.emitError(error));
  }
  sendPowerAction(deviceId: string, action: PowerAction): void {
    void this.devices.powerAction(deviceId, action).catch((error) => this.emitError(error));
  }

  private openSocket(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let authenticationRejected = false;
      const signals = new Set<string>();
      const socket = this.webSocketFactory(this.options.url);
      this.socket = socket;
      const timer = setTimeout(
        () =>
          fail(
            new GatewayConnectionError('Timed out while waiting for gateway authentication.', {
              retryable: true,
            }),
            4002,
            'Authentication timeout',
          ),
        this.connectionTimeoutMs,
      );
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        this.startHeartbeat();
        resolve();
      };
      const fail = (error: Error, code: number, reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.setStatus('error', error);
        this.emitError(error);
        reject(error);
        socket.close(code, reason);
      };
      socket.onopen = () => {
        this.setStatus('authenticating');
        void Promise.resolve(this.options.getAccessToken?.())
          .then((token) => {
            if (token) this.send(createAuthenticationMessage(token));
          })
          .catch((error) =>
            fail(
              error instanceof Error
                ? error
                : new GatewayConnectionError('Gateway initialization failed.'),
              4000,
              'Initialization failed',
            ),
          );
      };
      socket.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        } catch (error) {
          const protocolError = new GatewayProtocolError('Received an invalid gateway message.');
          this.dispatcher.emit('diagnostic', {
            type: 'invalid-message',
            message: protocolError.message,
            payload: event.data,
            error: error instanceof Error ? error : undefined,
          });
          this.emitError(protocolError);
          return;
        }
        this.dispatcher.emit('message', payload);
        const consumed = this.requestManager.consume(payload);
        const inspection = inspectConnectionMessage(payload);
        if (!settled) {
          if (inspection.status === 'rejected') {
            authenticationRejected = true;
            fail(new GatewayAuthenticationError(inspection.error), 4001, 'Authentication failed');
            return;
          }
          if (inspection.status === 'accepted') finish();
          else if (inspection.signal) {
            signals.add(inspection.signal);
            if (requiredConnectionSignals.every((signal) => signals.has(signal))) finish();
          }
        } else if (inspection.status === 'rejected') {
          authenticationRejected = true;
          const error = new GatewayAuthenticationError(inspection.error);
          this.setStatus('error', error);
          this.emitError(error);
          socket.close(4001, 'Authentication failed');
          return;
        }
        const decoded = decodePush(payload);
        if (decoded.serverInfo) this.dispatcher.emit('serverInfo', decoded.serverInfo);
        if (decoded.userInfo) this.dispatcher.emit('userInfo', decoded.userInfo);
        if (decoded.event) this.dispatcher.emit('event', decoded.event);
        if (!consumed && decoded.unknown && inspection.status === 'pending' && !inspection.signal)
          this.dispatcher.emit('diagnostic', {
            type: 'unknown-message',
            message: 'Received an unknown gateway message.',
            payload,
          });
      };
      socket.onerror = () => {
        const error = new GatewayConnectionError('WebSocket connection error.', {
          retryable: true,
        });
        this.setStatus('error', error);
        this.emitError(error);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      };
      socket.onclose = (event) => {
        clearTimeout(timer);
        this.stopHeartbeat();
        this.requestManager.rejectAll(event.reason || 'Gateway connection closed.');
        if (this.socket === socket) this.socket = undefined;
        if (!settled) {
          settled = true;
          reject(
            new GatewayConnectionError(event.reason || 'WebSocket closed before connecting.', {
              retryable: !authenticationRejected,
            }),
          );
        }
        if (this.manuallyClosed || this.destroyed) {
          if (!this.destroyed) this.setStatus('disconnected');
          return;
        }
        if (authenticationRejected) return;
        this.setStatus(
          'reconnecting',
          new GatewayConnectionError(event.reason || 'Connection lost.', { retryable: true }),
        );
        this.scheduleReconnect();
      };
    });
  }

  private setStatus(current: ConnectionStatus, error?: Error): void {
    if (this.status === current && !error) return;
    const previous = this.status;
    this.status = current;
    this.dispatcher.emit('connection', {
      previous,
      current,
      reconnectAttempt: this.reconnectAttempt,
      error,
    });
  }
  private emitError(error: unknown): void {
    this.dispatcher.emit('error', error instanceof Error ? error : new Error(String(error)));
  }
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.status === 'connected' && this.socket?.readyState === OPEN)
        this.send(createHeartbeatMessage());
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
