import type { ManagedUser, UserSessionCounts } from '../types';
import { isRecord, stringValue, timestampValue } from './normalizers';

export const SITE_RIGHT_LOCKED = 0x00000020;

export function normalizeSiteRights(value: number): number {
  return value >>> 0;
}

export function isUserLocked(value: number): boolean {
  const rights = normalizeSiteRights(value);
  return rights !== 0xffffffff && (rights & SITE_RIGHT_LOCKED) === SITE_RIGHT_LOCKED;
}

export function setUserLocked(value: number, locked: boolean): number {
  const rights = normalizeSiteRights(value);
  return locked ? (rights | SITE_RIGHT_LOCKED) >>> 0 : (rights & ~SITE_RIGHT_LOCKED) >>> 0;
}

export function isFullAdministrator(value: number): boolean {
  return normalizeSiteRights(value) === 0xffffffff;
}

function userNameFromId(id: string): string {
  return id.replace(/^user\/\/[^/]*\//, '').replace(/^user\/\//, '');
}

export function normalizeManagedUser(value: unknown, fallbackId?: string): ManagedUser | undefined {
  if (!isRecord(value)) return undefined;
  const id =
    stringValue(value._id) ?? stringValue(value.id) ?? stringValue(value.userid) ?? fallbackId;
  if (!id) return undefined;
  const siteRights = normalizeSiteRights(
    typeof value.siteadmin === 'number' && Number.isFinite(value.siteadmin) ? value.siteadmin : 0,
  );
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.username) ?? userNameFromId(id),
    realName: stringValue(value.realname),
    email: stringValue(value.email),
    phone: stringValue(value.phone),
    siteRights,
    locked: isUserLocked(siteRights),
    resetNextLogin: typeof value.resetNextLogin === 'boolean' ? value.resetNextLogin : undefined,
    createdAt: timestampValue(value.creation),
    lastLoginAt: timestampValue(value.login),
    previousLoginAt: timestampValue(value.pastlogin),
    lastAccessAt: timestampValue(value.access),
    passwordChangedAt: timestampValue(value.passchange),
    raw: value,
  };
}

export function normalizeManagedUsers(value: unknown): ManagedUser[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeManagedUser(item))
      .filter((item): item is ManagedUser => Boolean(item));
  }
  if (!isRecord(value)) return [];
  const nested = value.users ?? value.accounts;
  if (nested !== undefined && nested !== value) return normalizeManagedUsers(nested);
  return Object.entries(value)
    .map(([key, item]) => normalizeManagedUser(item, key))
    .filter((item): item is ManagedUser => Boolean(item));
}

export function normalizeUserSessionCounts(value: unknown): UserSessionCounts {
  if (!isRecord(value)) return {};
  const nested = value.wssessions ?? value.sessions;
  if (nested !== undefined && nested !== value) return normalizeUserSessionCounts(nested);
  const result: UserSessionCounts = {};
  for (const [userId, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0) result[userId] = count;
  }
  return result;
}
