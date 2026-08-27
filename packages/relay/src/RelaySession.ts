import type { RelayConnection } from './RelayConnection';
import type {
  RelayCloseEventLike,
  RelayConnectionState,
  RelayEventListener,
  RelayInboundData,
  RelayOutboundData,
  RelayStateChangeEvent,
} from './types';

export interface RelaySessionOptions {
  id: string;
  deviceId: string;
  protocol: number;
  connection: RelayConnection;
}

export class RelaySession {
  readonly id: string;
  readonly deviceId: string;
  readonly protocol: number;
  readonly connection: RelayConnection;

  constructor(options: RelaySessionOptions) {
    this.id = options.id;
    this.deviceId = options.deviceId;
    this.protocol = options.protocol;
    this.connection = options.connection;
  }

  get state(): RelayConnectionState {
    return this.connection.state;
  }

  onStateChange(listener: RelayEventListener<RelayStateChangeEvent>): () => void {
    return this.connection.on('state', listener);
  }

  onMessage(listener: RelayEventListener<RelayInboundData>): () => void {
    return this.connection.on('message', listener);
  }

  onError(listener: RelayEventListener<Error>): () => void {
    return this.connection.on('error', listener);
  }

  onClose(listener: RelayEventListener<RelayCloseEventLike>): () => void {
    return this.connection.on('close', listener);
  }

  send(data: RelayOutboundData): void {
    this.connection.send(data);
  }

  sendText(text: string): void {
    this.connection.sendText(text);
  }

  sendJson(payload: unknown): void {
    this.connection.sendJson(payload);
  }

  sendBinary(data: Exclude<RelayOutboundData, string>): void {
    this.connection.sendBinary(data);
  }

  close(code?: number, reason?: string): void {
    this.connection.close(code, reason);
  }

  cancel(reason?: string): void {
    this.connection.cancel(reason);
  }
}
