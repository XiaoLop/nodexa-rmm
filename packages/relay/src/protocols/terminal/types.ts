import type { RelayInboundData } from '../../types';

export type TerminalSessionState = 'ready' | 'closed' | 'error';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export type TerminalControlMessageType = 'rtt';

export interface TerminalControlMessage extends Record<string, unknown> {
  ctrlChannel: string | number;
  type: TerminalControlMessageType;
}

export type TerminalSessionErrorCode =
  | 'protocol'
  | 'connection-lost'
  | 'cancelled'
  | 'invalid-size'
  | 'output-overflow'
  | 'unsupported-message';

export class TerminalSessionError extends Error {
  constructor(
    message: string,
    readonly code: TerminalSessionErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'TerminalSessionError';
  }
}

export interface TerminalSessionOptions {
  initialSize: TerminalSize;
  recorded?: boolean;
  maxPendingOutputBytes?: number;
  rttIntervalMs?: number;
  rttTimeoutMs?: number;
  now?: () => number;
  onControlMessage?: (message: TerminalControlMessage) => void;
  onUnhandledMessage?: (message: RelayInboundData) => void;
}