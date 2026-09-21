import { SiteRight } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import {
  SITE_RIGHT_ADMIN,
  composeEditableSiteRights,
  preserveLatestAccountLock,
  selectedSitePermissionFlags,
  summarizeSiteRights,
} from './sitePermissions';

describe('site permissions', () => {
  it('parses and composes editable permissions while preserving account lock', () => {
    const current = SiteRight.ManageUsers | SiteRight.Locked;
    expect(selectedSitePermissionFlags(current)).toEqual([SiteRight.ManageUsers]);
    expect(
      composeEditableSiteRights([SiteRight.ManageUserGroups, SiteRight.NoNewDevices], false, current),
    ).toBe(SiteRight.ManageUserGroups | SiteRight.NoNewDevices | SiteRight.Locked);
    expect(preserveLatestAccountLock(SiteRight.ManageUsers, current)).toBe(
      SiteRight.ManageUsers | SiteRight.Locked,
    );
    expect(preserveLatestAccountLock(SiteRight.ManageUsers | SiteRight.Locked, 0)).toBe(
      SiteRight.ManageUsers,
    );
  });

  it('uses the full administrator mask independently from individual flags', () => {
    expect(composeEditableSiteRights([], true, SiteRight.Locked)).toBe(SITE_RIGHT_ADMIN);
    expect(composeEditableSiteRights([SiteRight.ManageUsers], false, SITE_RIGHT_ADMIN)).toBe(
      SiteRight.ManageUsers,
    );
    expect(selectedSitePermissionFlags(SITE_RIGHT_ADMIN)).toEqual([]);
    expect(summarizeSiteRights(SITE_RIGHT_ADMIN)).toBe('全站管理员');
    expect(summarizeSiteRights(SITE_RIGHT_ADMIN, (key) => key)).toBe('permissions.summary.siteAdmin');
  });

  it('summarizes regular and restricted accounts', () => {
    expect(summarizeSiteRights(0)).toBe('无站点权限');
    expect(summarizeSiteRights(SiteRight.Locked)).toBe('已锁定，无站点权限');
    expect(summarizeSiteRights(SiteRight.ManageUsers | SiteRight.NoNewDevices)).toBe(
      '管理用户、禁止添加设备',
    );

    const mockT = (key: string, options?: Record<string, unknown>) => {
      if (key === 'permissions.summary.noSiteRights') return 'No site rights';
      if (key === 'permissions.summary.lockedNoSiteRights') return 'Locked, no site rights';
      if (key === 'permissions.summary.separator') return ', ';
      if (key === 'permissions.site.manageUsers.label') return 'Manage users';
      if (key === 'permissions.site.noNewDevices.label') return 'No adding devices';
      if (key === 'permissions.summary.itemsAndMore') {
        return `${options?.items} and ${Number(options?.count) - 2} more`;
      }
      return key;
    };

    expect(summarizeSiteRights(0, mockT)).toBe('No site rights');
    expect(summarizeSiteRights(SiteRight.Locked, mockT)).toBe('Locked, no site rights');
    expect(summarizeSiteRights(SiteRight.ManageUsers | SiteRight.NoNewDevices, mockT)).toBe(
      'Manage users, No adding devices',
    );
  });
});