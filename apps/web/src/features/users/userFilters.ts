import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';
import { createCollator } from '../../i18n';
import type { AppLanguage } from '../../i18n/language';

export type UserFilter = 'all' | 'active' | 'locked' | 'administrator' | 'reset-required';

export function filterManagedUsers(
  users: ManagedUser[],
  query: string,
  filter: UserFilter,
  lang?: AppLanguage,
): ManagedUser[] {
  const collator = createCollator(lang, { numeric: true, sensitivity: 'base' });
  const normalizedQuery = query.trim().toLowerCase();
  return users
    .filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [user.name, user.realName, user.email].some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      if (!matchesQuery) return false;
      if (filter === 'active') return !user.locked;
      if (filter === 'locked') return user.locked;
      if (filter === 'administrator') return isFullAdministrator(user.siteRights);
      if (filter === 'reset-required') return user.resetNextLogin === true;
      return true;
    })
    .sort((left, right) => collator.compare(left.name, right.name));
}
