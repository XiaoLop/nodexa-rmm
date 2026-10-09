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