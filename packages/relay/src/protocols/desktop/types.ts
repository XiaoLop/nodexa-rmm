import type { RelayInboundData } from '../../types';

export type DesktopSessionState = 'ready' | 'screen-known' | 'desktop-ready' | 'closed' | 'error';

export type DesktopImageFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

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

export type DesktopControlMessage = DesktopMetadataMessage;

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