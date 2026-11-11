import type { RelayInboundData } from '../../types';

export type DesktopSessionState = 'ready' | 'screen-known' | 'desktop-ready' | 'closed' | 'error';

export type DesktopImageFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

export interface DesktopCompressionOptions {
  imageFormat?: Exclude<DesktopImageFormat, 'unknown'>;
  quality: number;
  scaling?: number;
  frameTimer?: number;
}

export interface DesktopProtocolCommand {
  command: number;
  size: number;
  bytes: Uint8Array;
  jumbo: boolean;
  outerBytes?: Uint8Array;
}

export interface DesktopScreenSize {
  width: number;
  height: number;
}

export interface DesktopTile {
  x: number;
  y: number;
  image: Uint8Array;
  imageFormat: DesktopImageFormat;
}

export interface DesktopDisplayGeometry {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: Uint8Array;
}

export interface DesktopMetadataMessage extends Record<string, unknown> {
  ctrlChannel: string | number;
  type: 'metadata';
}

export interface DesktopRttMessage extends Record<string, unknown> {
  ctrlChannel: string | number;
  type: 'rtt';
  time: number;
}

export interface DesktopWebRtcAnswerMessage extends Record<string, unknown> {
  type: 'answer';
  sdp: string;
}

export interface DesktopWebRtcSwitchMessage extends Record<string, unknown> {
  ctrlChannel?: string | number;
  type: 'webrtc0' | 'webrtc1' | 'webrtc2';
}

export type DesktopControlMessage =
  | DesktopMetadataMessage
  | DesktopRttMessage
  | DesktopWebRtcAnswerMessage
  | DesktopWebRtcSwitchMessage;

export type DesktopTransportType = 'websocket' | 'webrtc';

export type DesktopWebRtcState =
  | 'idle'
  | 'offering'
  | 'connecting'
  | 'switching'
  | 'connected'
  | 'failed'
  | 'closed';

export interface DesktopWebRtcOptions {
  enabled?: boolean;
  rtcConfig?: RTCConfiguration;
  /** 可用于依赖注入测试的 RTCPeerConnection 构造器 */
  peerConnectionFactory?: (config?: RTCConfiguration) => RTCPeerConnection;
}

export type DesktopSessionErrorCode =
  | 'protocol'
  | 'connection-lost'
  | 'invalid-command-size'
  | 'command-too-large'
  | 'output-overflow'
  | 'unsupported-image'
  | 'invalid-screen-size'
  | 'input-not-allowed';

export class DesktopSessionError extends Error {
  constructor(message: string, readonly code: DesktopSessionErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DesktopSessionError';
  }
}

export interface DesktopSessionOptions {
  inputAllowed?: boolean;
  maxPendingProtocolBytes?: number;
  maxCommandBytes?: number;
  maxJumboBytes?: number;
  rttIntervalMs?: number;
  rttTimeoutMs?: number;
  now?: () => number;
  webrtc?: DesktopWebRtcOptions;
  onControlMessage?: (message: DesktopControlMessage) => void;
  onUnknownCommand?: (command: DesktopProtocolCommand) => void;
  onUnhandledMessage?: (message: RelayInboundData) => void;
}

export interface DesktopPoint {
  x: number;
  y: number;
}

export type DesktopMouseButton = 'left' | 'right' | 'middle';
export type DesktopKeyPhase = 'down' | 'up';

/** Cumulative application-message counters, excluding wire overhead. */
export interface DesktopSessionStats {
  readonly receivedBytes: number;
  readonly receivedTiles: number;
  readonly pendingProtocolBytes: number;
}
