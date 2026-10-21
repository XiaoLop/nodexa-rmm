import { describe, expect, it } from 'vitest';
import { appRoutes, resolvePageMeta } from './appRoutes';

const translate = (key: string) => key;

describe('app route metadata', () => {
  it('uses the same capability for protected routes and navigation entries', () => {
    expect(appRoutes.find((route) => route.path === '/files')).toMatchObject({
      capability: 'serverFiles',
      navigation: { labelKey: 'navigation.serverFiles' },
    });
    expect(appRoutes.find((route) => route.path === '/admin/users')).toMatchObject({
      capability: 'manageUsers',
      navigation: { labelKey: 'navigation.userManagement' },
    });
  });

  it('lazily registers all server admin pages with siteAdmin-gated navigation', () => {
    for (const name of ['console', 'trace', 'logs']) {
      const route = appRoutes.find(candidate => candidate.path === `/admin/server/${name}`);
      expect(route).toMatchObject({
        capability: 'siteAdmin',
        navigation: { labelKey: `serverAdmin.${name}`, group: 'navigation.administration' },
      });
      expect(route?.component.$$typeof).toBe(Symbol.for('react.lazy'));
      expect(resolvePageMeta(`/admin/server/${name}`, translate as never).title)
        .toBe(`navigation.administration / serverAdmin.${name}`);
    }
  });

  it('resolves dynamic route titles and their parent navigation selection', () => {
    expect(resolvePageMeta('/devices/node-1/workspace', translate as never)).toEqual({
      selectedKey: '/devices',
      title: 'navigation.deviceManagement / navigation.deviceWorkspace',
    });
    expect(resolvePageMeta('/admin/users/user-1', translate as never)).toEqual({
      selectedKey: '/admin/users',
      title: 'navigation.administration / navigation.userDetails',
    });
  });

  it('falls back to the console title for routes without metadata', () => {
    expect(resolvePageMeta('/unknown', translate as never)).toEqual({
      selectedKey: '/unknown',
      title: 'navigation.console',
    });
  });
});