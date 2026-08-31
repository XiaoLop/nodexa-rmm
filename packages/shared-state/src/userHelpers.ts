import type { UserInfo } from './types';

export function getGreetingTime(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return '早上好';
  if (hour >= 11 && hour < 13) return '中午好';
  if (hour >= 13 && hour < 19) return '下午好';
  return '晚上好';
}

export function getUserDisplayName(userInfo?: UserInfo, username?: string): string {
  if (userInfo?.name && userInfo.name.trim()) return userInfo.name.trim();
  if (userInfo?.id) {
    const cleaned = userInfo.id.replace(/^user\/([^/]+\/)?/, '').replace(/^user\/\//, '');
    if (cleaned.trim()) return cleaned.trim();
  }
  if (username && username.trim()) return username.trim();
  return '林默';
}
