import {
  MeshCentralClient,
  isFullAdministrator,
  type ConnectionStatus,
  type ServerInfo,
  type UserInfo,
  type WebSocketFactory,
} from '@meshcentral/control-client';

import type { AuditWriter } from '../audit/audit-log';
import type { McpConfig } from '../config/mcp-config';
import { McpToolError } from '../errors';
import type { ResolvedCredentials, SessionManager } from '../session/session-manager';
import { toMcpToolError } from './error-mapper';
import { createNodeSocketFactory } from './socket-factory';

export interface ConnectionInfo {
  readonly status: ConnectionStatus;
  readonly reconnectAttempt: number;
  readonly userId?: string;
  readonly userName?: string;
  readonly siteAdmin?: boolean;
  readonly connectedAt?: string;
  readonly features?: number;
}

export interface ClientProvider {
  readonly info: ConnectionInfo;
  withClient<T>(action: (client: MeshCentralClient) => Promise<T>): Promise<T>;
}

export interface CreateClientInput {
  readonly credentials: ResolvedCredentials;
  readonly socketFactory: WebSocketFactory;
  readonly config: McpConfig;
}

export interface ConnectionManagerOptions {
  readonly config: McpConfig;
  readonly session: SessionManager;
  readonly audit?: AuditWriter;
  readonly createClient?: (input: CreateClientInput) => MeshCentralClient;
  readonly now?: () => Date;
}

export class ConnectionManager implements ClientProvider {
  private readonly config: McpConfig;
  private readonly session: SessionManager;
  private readonly audit?: AuditWriter;
  private readonly createClient: (input: CreateClientInput) => MeshCentralClient;
  private readonly now: () => Date;

  private client?: MeshCentralClient;
  private clientKey?: string;
  private connectPromise?: Promise<MeshCentralClient>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private keepAliveTimer?: ReturnType<typeof setInterval>;
  private inflight = 0;
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private destroyed = false;

  private userInfo?: UserInfo;
  private serverInfo?: ServerInfo;
  private connectedAt?: string;

  constructor(options: ConnectionManagerOptions) {
    this.config = options.config;
    this.session = options.session;
    this.audit = options.audit;
    this.createClient = options.createClient ?? defaultCreateClient;
    this.now = options.now ?? (() => new Date());
  }

  get info(): ConnectionInfo {
    const client = this.client;
    return {
      status: client?.connectionStatus ?? 'idle',
      reconnectAttempt: client?.currentReconnectAttempt ?? 0,
      ...(this.userInfo?.id ? { userId: this.userInfo.id } : {}),
      ...(this.userInfo?.name ? { userName: this.userInfo.name } : {}),
      ...(this.userInfo ? { siteAdmin: isFullAdministrator(this.userInfo.siteadmin ?? 0) } : {}),
      ...(this.connectedAt ? { connectedAt: this.connectedAt } : {}),
      ...(this.serverInfo?.features === undefined ? {} : { features: this.serverInfo.features }),
    };
  }

  async withClient<T>(action: (client: MeshCentralClient) => Promise<T>): Promise<T> {
    await this.acquire();
    this.inflight += 1;
    this.clearIdleTimer();
    try {
      const client = await this.connect();
      return await action(client);
    } finally {
      this.inflight -= 1;
      this.release();
      this.scheduleIdleDisconnect();
    }
  }

  async connect(): Promise<MeshCentralClient> {
    if (this.destroyed) {
      throw new McpToolError('INTERNAL', 'The MCP runtime has been shut down.', {
        hint: 'Restart the MCP server process.',
      });
    }

    const credentials = await this.session.resolve();

    if (this.client && this.clientKey === credentials.key) {
      const status = this.client.connectionStatus;
      if (status === 'connected') return this.client;
      if (status !== 'connecting' && status !== 'reconnecting' && status !== 'authenticating') {
        await this.openExisting(this.client);
        return this.client;
      }
    }

    if (this.connectPromise) return this.connectPromise;

    const promise = this.open(credentials).finally(() => {
      if (this.connectPromise === promise) this.connectPromise = undefined;
    });
    this.connectPromise = promise;
    return promise;
  }

  disconnect(): void {
    this.clearIdleTimer();
    this.stopKeepAlive();
    this.client?.disconnect();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.stopKeepAlive();
    const client = this.client;
    this.client = undefined;
    this.clientKey = undefined;
    this.connectPromise = undefined;
    client?.destroy();
    this.drainQueue();
    await this.audit?.close();
  }

  private async openExisting(client: MeshCentralClient): Promise<void> {
    try {
      await client.connect();
      this.connectedAt = this.now().toISOString();
      this.startKeepAlive(client);
    } catch (error) {
      const mapped = await this.handleConnectError(error);
      throw mapped;
    }
  }

  /**
   * `control-client` sends its own heartbeat, but MeshCentral natively expects
   * `{ action: 'ping' }`. Sending the native form keeps proxies and the server
   * session from idling out during long MCP sessions.
   */
  private startKeepAlive(client: MeshCentralClient): void {
    this.stopKeepAlive();
    const interval = this.config.keepAliveIntervalMs;
    if (interval <= 0) return;

    this.keepAliveTimer = setInterval(() => {
      if (client.connectionStatus !== 'connected') return;
      try {
        client.send({ action: 'ping' });
      } catch {
        // A closed socket is handled by the connection state machine.
      }
    }, interval);
    this.keepAliveTimer.unref?.();
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  private async open(credentials: ResolvedCredentials): Promise<MeshCentralClient> {
    if (this.client && this.clientKey !== credentials.key) {
      this.stopKeepAlive();
      this.client.destroy();
      this.client = undefined;
      this.userInfo = undefined;
      this.serverInfo = undefined;
      this.connectedAt = undefined;
    }

    const socketFactory = createNodeSocketFactory({
      ...(credentials.cookieHeader === undefined ? {} : { cookieHeader: credentials.cookieHeader }),
      ...(credentials.meshAuthHeader === undefined
        ? {}
        : { meshAuthHeader: credentials.meshAuthHeader }),
      ...(this.config.tlsCaPath === undefined ? {} : { tlsCaPath: this.config.tlsCaPath }),
      allowInsecureTls: this.config.allowInsecureTls,
      userAgent: 'meshcentral-mcp/0.1.0',
    });

    const client = this.createClient({ credentials, socketFactory, config: this.config });
    this.client = client;
    this.clientKey = credentials.key;

    client.on('userInfo', (info) => {
      this.userInfo = info;
    });
    client.on('serverInfo', (info) => {
      this.serverInfo = info;
    });
    client.on('connection', (change) => {
      this.audit?.connection(change.current, change.reconnectAttempt);
    });

    try {
      await client.connect();
      this.connectedAt = this.now().toISOString();
      this.startKeepAlive(client);
      return client;
    } catch (error) {
      const mapped = await this.handleConnectError(error);
      client.destroy();
      if (this.client === client) {
        this.client = undefined;
        this.clientKey = undefined;
      }
      throw mapped;
    }
  }

  private async handleConnectError(error: unknown): Promise<McpToolError> {
    const mapped = toMcpToolError(error);
    if (mapped.code === 'SESSION_EXPIRED') {
      await this.session.invalidate();
      this.clientKey = undefined;
    }
    return mapped;
  }

  private scheduleIdleDisconnect(): void {
    const idleMs = this.config.idleDisconnectMs;
    if (idleMs <= 0) return;
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      if (this.inflight !== 0) return;
      this.stopKeepAlive();
      this.client?.disconnect();
    }, idleMs);
    this.idleTimer.unref?.();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrentCalls) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      this.active += 1;
      next();
    }
  }

  private drainQueue(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

function defaultCreateClient(input: CreateClientInput): MeshCentralClient {
  return new MeshCentralClient({
    url: input.config.controlUrl,
    webSocketFactory: input.socketFactory,
    connectionTimeoutMs: input.config.connectTimeoutMs,
    requestTimeoutMs: input.config.requestTimeoutMs,
  });
}
