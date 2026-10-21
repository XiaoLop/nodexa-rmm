import type { UserInfo } from './types';

/** Language-neutral time-of-day bucket used to greet the signed-in user. */
export type GreetingPeriod = 'morning' | 'noon' | 'afternoon' | 'evening';

/** Neutral placeholder when no display name can be resolved. */
export const UNKNOWN_DISPLAY_NAME = '—';

/**
 * Classifies the local time into a greeting period.
 *
 * Presentation layers map the period to their own wording, so this package stays
 * free of locale-specific text.
 */
export function getGreetingPeriod(date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 19) return 'afternoon';
  return 'evening';
}

/**
 * @deprecated Use {@link getGreetingPeriod} and translate the period in the app.
 * Kept for backwards compatibility with existing consumers; returns an English
 * fallback instead of Chinese wording.
 */
export function getGreetingTime(date = new Date()): string {
  switch (getGreetingPeriod(date)) {
    case 'morning':
      return 'Good morning';
    case 'noon':
      return 'Good afternoon';
    case 'afternoon':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

export function getUserDisplayName(userInfo?: UserInfo, username?: string): string {
  if (userInfo?.name && userInfo.name.trim()) return userInfo.name.trim();
  if (userInfo?.id) {
    const cleaned = userInfo.id.replace(/^user\/([^/]+\/)?/, '').replace(/^user\/\//, '');
    if (cleaned.trim()) return cleaned.trim();
  }
  if (username && username.trim()) return username.trim();
  return UNKNOWN_DISPLAY_NAME;
}
