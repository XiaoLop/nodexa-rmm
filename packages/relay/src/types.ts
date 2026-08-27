export type RelayConnectionState =
  | 'idle'
  | 'authorizing'
  | 'notifying'
  | 'connecting'
  | 'handshaking'
  | 'ready'
  | 'closing'
  | 'closed'
  | 'error';

export type RelayProtocol = number;
export type RelayBinaryData = ArrayBuffer | ArrayBufferView | Blob;
export type RelayOutboundData = string | RelayBinaryData;
export type RelayInboundData = string | ArrayBuffer | ArrayBufferView | Blob;

export interface RelayAuthorization {
  cookie: string;
  rcookie: string;
}

export interface RelayControlChannel {
  request<T = unknown>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  send(payload: unknown): void;
}

export interface RelayMessageEventLike {
  data: RelayInboundData;
}

export interface RelayCloseEventLike {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface RelayWebSocketLike {
  readonly readyState: number;
  binaryType?: string;
  onopen: (() => void) | null;
  onmessage: ((event: RelayMessageEventLike) => void) | null;
  onerror: ((error: unknown) => void) | null;
  onclose: ((event: RelayCloseEventLike) => void) | null;
  send(data: RelayOutboundData): void;
  close(code?: number, reason?: string): void;
}

export type RelayWebSocketFactory = (url: string) => RelayWebSocketLike;

export interface RelayStateChangeEvent {
  previous: RelayConnectionState;
  current: RelayConnectionState;
  error?: Error;
}

export interface RelayConnectionEvents {
  state: RelayStateChangeEvent;
  message: RelayInboundData;
  close: RelayCloseEventLike;
  error: Error;
}

export type RelayEventListener<T> = (event: T) => void;

export interface RelayUrlOptions {
  baseUrl: string;
  deviceId: string;
  protocol: RelayProtocol;
  relayId: string;
  authCookie: string;
}

export interface RelayConnectionOptions extends RelayUrlOptions {
  webSocketFactory?: RelayWebSocketFactory;
  connectionTimeoutMs?: number;
  handshakeTimeoutMs?: number;
  binaryType?: string;
  isHandshakeMessage?: (data: RelayInboundData) => boolean;
  onRawMessage?: (data: RelayInboundData) => void;
}

export interface CreateRelaySessionOptions {
  deviceId: string;
  protocol: RelayProtocol;
  usage?: number;
  relayId?: string;
  authorizationTimeoutMs?: number;
  connectionTimeoutMs?: number;
  handshakeTimeoutMs?: number;
  signal?: AbortSignal;
  onStateChange?: (event: RelayStateChangeEvent) => void;
  onRawMessage?: (data: RelayInboundData) => void;
  onError?: (error: Error) => void;
  onClose?: (event: RelayCloseEventLike) => void;
}

export interface RelayClientOptions {
  baseUrl: string;
  control: RelayControlChannel;
  webSocketFactory?: RelayWebSocketFactory;
  createRelayId?: () => string;
  authorizationTimeoutMs?: number;
  connectionTimeoutMs?: number;
  handshakeTimeoutMs?: number;
}
