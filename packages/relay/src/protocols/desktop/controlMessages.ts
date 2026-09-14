import type { DesktopControlMessage } from './types';

export const DESKTOP_CONTROL_CHANNEL = '102938';

export function parseDesktopControlMessage(data: string): DesktopControlMessage | undefined {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (String(record.ctrlChannel) !== DESKTOP_CONTROL_CHANNEL) return undefined;
    if (record.type === 'metadata') return record as DesktopControlMessage;
    if (record.type !== 'rtt' || typeof record.time !== 'number') return undefined;
    return record as DesktopControlMessage;
  } catch {
    return undefined;
  }
}

export function createDesktopRttMessage(time: number): Record<string, unknown> {
  return { ctrlChannel: DESKTOP_CONTROL_CHANNEL, type: 'rtt', time };
}