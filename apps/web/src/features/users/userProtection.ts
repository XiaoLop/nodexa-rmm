import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';

export function isCurrentUser(target: ManagedUser, currentUserId?: string): boolean {
  return Boolean(currentUserId && target.id === currentUserId);
}

export function isLastActiveAdministrator(target: ManagedUser, users: ManagedUser[]): boolean {
  if (!isFullAdministrator(target.siteRights)) return false;
  const otherActiveAdministrators = users.filter(
    (user) => user.id !== target.id && isFullAdministrator(user.siteRights) && !user.locked,
  );
  return otherActiveAdministrators.length === 0;
}

export function canChangeSiteRights(
  target: ManagedUser,
  users: ManagedUser[],
  currentUserId: string | undefined,
  nextSiteRights: number,
): boolean {
  if (isCurrentUser(target, currentUserId)) return false;
  if (isFullAdministrator(target.siteRights) && !isFullAdministrator(nextSiteRights)) {
    return !isLastActiveAdministrator(target, users);
  }
  return true;
}
