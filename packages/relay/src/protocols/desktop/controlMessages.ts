import type { DesktopControlMessage } from './types';

export function parseDesktopControlMessage(data: string): DesktopControlMessage | undefined {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (record.type !== 'metadata' || (typeof record.ctrlChannel !== 'string' && typeof record.ctrlChannel !== 'number')) return undefined;
    return record as DesktopControlMessage;
  } catch {
    return undefined;
  }
}