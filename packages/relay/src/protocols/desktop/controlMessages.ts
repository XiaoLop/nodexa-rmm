import type { DesktopControlMessage } from './types';

export const DESKTOP_CONTROL_CHANNEL = '102938';

export function parseDesktopControlMessage(data: string): DesktopControlMessage | undefined {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;

    // WebRTC Answer 消息可能没有 ctrlChannel，但具有 type === 'answer' 与 sdp 字符串
    if (record.type === 'answer' && typeof record.sdp === 'string') {
      return record as DesktopControlMessage;
    }

    if (String(record.ctrlChannel) !== DESKTOP_CONTROL_CHANNEL) return undefined;
    if (record.type === 'metadata') return record as DesktopControlMessage;
    if (record.type === 'rtt' && typeof record.time === 'number') return record as DesktopControlMessage;
    if (record.type === 'webrtc0' || record.type === 'webrtc1' || record.type === 'webrtc2') {
      return record as DesktopControlMessage;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function createDesktopRttMessage(time: number): Record<string, unknown> {
  return { ctrlChannel: DESKTOP_CONTROL_CHANNEL, type: 'rtt', time };
}

export function createWebRtcSwitchMessage(type: 'webrtc0' | 'webrtc1' | 'webrtc2'): Record<string, unknown> {
  return { ctrlChannel: DESKTOP_CONTROL_CHANNEL, type };
}