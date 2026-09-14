import type { ManagedUser } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import { filterManagedUsers } from './userFilters';
import { canChangeSiteRights, isCurrentUser, isLastActiveAdministrator } from './userProtection';

const user = (overrides: Partial<ManagedUser>): ManagedUser => ({
  id: 'user//one',
  name: 'one',
  siteRights: 0,
  locked: false,
  raw: {},
  ...overrides,
});

describe('user management helpers', () => {
  it('searches, filters, and sorts managed users locally', () => {
    const users = [
      user({ id: 'user//zeta', name: 'zeta', locked: true }),
      user({ id: 'user//alice', name: 'alice', realName: 'Alice Zhang' }),
      user({ id: 'user//admin', name: 'admin', siteRights: 0xffffffff }),
    ];
    expect(filterManagedUsers(users, 'ZHANG', 'all').map((item) => item.name)).toEqual(['alice']);
    expect(filterManagedUsers(users, '', 'locked').map((item) => item.name)).toEqual(['zeta']);
    expect(filterManagedUsers(users, '', 'administrator').map((item) => item.name)).toEqual([
      'admin',
    ]);
  });

  it('protects the current user and last active administrator', () => {
    const admin = user({ id: 'user//admin', name: 'admin', siteRights: 0xffffffff, locked: false });
    expect(isCurrentUser(admin, 'user//admin')).toBe(true);
    expect(isLastActiveAdministrator(admin, [admin, user({})])).toBe(true);
    expect(
      isLastActiveAdministrator(admin, [
        admin,
        user({ id: 'user//other', name: 'other', siteRights: 0xffffffff, locked: false }),
      ]),
    ).toBe(false);
    expect(
      isLastActiveAdministrator({ ...admin, locked: true }, [{ ...admin, locked: true }]),
    ).toBe(true);
  });

  it('blocks self permission changes and protects the last active administrator', () => {
    const admin = user({ id: 'user//admin', name: 'admin', siteRights: 0xffffffff });
    const regular = user({ id: 'user//regular', name: 'regular' });

    expect(canChangeSiteRights(admin, [admin, regular], admin.id, 0)).toBe(false);
    expect(canChangeSiteRights(admin, [admin, regular], regular.id, 0)).toBe(false);
    expect(canChangeSiteRights(regular, [admin, regular], admin.id, 2)).toBe(true);
    expect(
      canChangeSiteRights(
        admin,
        [admin, user({ id: 'user//other', siteRights: 0xffffffff })],
        regular.id,
        0,
      ),
    ).toBe(true);
  });
});
