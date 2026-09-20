import type { GatewayEvent, ServerInfo, UserInfo } from '../types';
import {
  isRecord,
  normalizeEvent,
  normalizeServerInfo,
  normalizeUserInfo,
  stringValue,
} from './normalizers';

export type ConnectionInspection =
  | { status: 'pending'; signal?: string }
  | { status: 'accepted' }
  | { status: 'rejected'; error: string };

export interface DecodedPush {
  event?: GatewayEvent;
  userInfo?: UserInfo;
  serverInfo?: ServerInfo;
  unknown?: boolean;
}

export const requiredConnectionSignals = [
  'serverinfo',
  'userinfo',
] as const;

export function inspectConnectionMessage(payload: unknown): ConnectionInspection {
  if (!isRecord(payload)) return { status: 'pending' };
  const action = stringValue(payload.action);
  const type = stringValue(payload.type);
  if (action === 'close' || type === 'authenticationFailed' || type === 'authError') {
    return {
      status: 'rejected',
      error: stringValue(payload.msg) ?? stringValue(payload.message) ?? 'Authentication failed.',
    };
  }
  if (type === 'authenticated' || action === 'authenticated') return { status: 'accepted' };
  if (requiredConnectionSignals.includes(action as (typeof requiredConnectionSignals)[number]))
    return { status: 'pending', signal: action };
  return { status: 'pending' };
}

export function decodePush(payload: unknown): DecodedPush {
  if (!isRecord(payload)) return { unknown: true };
  if (payload.action === 'serverinfo' || isRecord(payload.serverinfo))
    return { serverInfo: normalizeServerInfo(payload) };
  if (payload.action === 'userinfo' || isRecord(payload.userinfo))
    return { userInfo: normalizeUserInfo(payload) };
  const raw = isRecord(payload.event) ? payload.event : payload;
  if (raw.action === 'ifchange' || raw.etype === 'ifchange') return {};
  const event = normalizeEvent(payload);
  if (event && event.type !== 'unknown') return { event };
  return { unknown: true };
}

export const createAuthenticationMessage = (token: string) => ({ type: 'authenticate', token });
export const createHeartbeatMessage = () => ({ type: 'ping' });
