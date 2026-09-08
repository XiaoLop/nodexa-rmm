import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';

export type UserFilter = 'all' | 'active' | 'locked' | 'administrator' | 'reset-required';

const userNameCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

export function filterManagedUsers(
  users: ManagedUser[],
  query: string,
  filter: UserFilter,
): ManagedUser[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  return users
    .filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [user.name, user.realName, user.email].some((value) =>
          value?.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
        );
      if (!matchesQuery) return false;
      if (filter === 'active') return !user.locked;
      if (filter === 'locked') return user.locked;
      if (filter === 'administrator') return isFullAdministrator(user.siteRights);
      if (filter === 'reset-required') return user.resetNextLogin === true;
      return true;
    })
    .sort((left, right) => userNameCollator.compare(left.name, right.name));
}
