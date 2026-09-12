import type { TerminalControlMessage, TerminalSize } from './types';

export const TERMINAL_CONTROL_CHANNEL = '102938';

const CONFIRMED_INBOUND_CONTROL_MESSAGE_TYPES = new Set(['rtt']);

export function parseTerminalControlMessage(text: string): TerminalControlMessage | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const message = value as Record<string, unknown>;
  if (String(message.ctrlChannel) !== TERMINAL_CONTROL_CHANNEL) return undefined;
  if (
    typeof message.type !== 'string' ||
    !CONFIRMED_INBOUND_CONTROL_MESSAGE_TYPES.has(message.type)
  ) {
    return undefined;
  }
  return message as TerminalControlMessage;
}

export function createTerminalOptionsMessage(shellProtocol: number, size: TerminalSize): string {
  return JSON.stringify({
    type: 'options',
    protocol: shellProtocol,
    cols: size.cols,
    rows: size.rows,
  });
}

export function createTerminalResizeMessage(size: TerminalSize): Record<string, unknown> {
  return {
    ctrlChannel: TERMINAL_CONTROL_CHANNEL,
    type: 'termsize',
    cols: size.cols,
    rows: size.rows,
  };
}

export function createTerminalRttMessage(time: number): Record<string, unknown> {
  return { ctrlChannel: TERMINAL_CONTROL_CHANNEL, type: 'rtt', time };
}