import type { ManagedUser, UserLink, UserLinkType, UserSessionCounts } from '../types';
import { isRecord, stringValue, timestampValue } from './normalizers';

import {
  SiteRight,
  isSiteAccountLocked,
  isSiteAdministrator,
  setSiteAccountLocked,
} from '../permissions/siteRights';
import { normalizeRights } from '../permissions/bitmask';
export const SITE_RIGHT_LOCKED = SiteRight.Locked;

export function normalizeSiteRights(value: number): number {
  return normalizeRights(value);
}

export function isUserLocked(value: number): boolean {
  return isSiteAccountLocked(value);
}

export function setUserLocked(value: number, locked: boolean): number {
  return setSiteAccountLocked(value, locked);
}

export function isFullAdministrator(value: number): boolean {
  return isSiteAdministrator(value);
}

function userNameFromId(id: string): string {
  return id.replace(/^user\/\/[^/]*\//, '').replace(/^user\/\//, '');
}

function userLinkType(id: string): UserLinkType {
  if (id.startsWith('mesh//')) return 'device-group';
  if (id.startsWith('ugrp//')) return 'user-group';
  if (id.startsWith('node//')) return 'device';
  return 'unknown';
}

function normalizeUserLinks(value: unknown): UserLink[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([id, link]) => {
    if (!isRecord(link) || typeof link.rights !== 'number' || !Number.isFinite(link.rights)) {
      return [];
    }
    return [{ id, type: userLinkType(id), rights: normalizeSiteRights(link.rights) }];
  });
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
    links: normalizeUserLinks(value.links),
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
