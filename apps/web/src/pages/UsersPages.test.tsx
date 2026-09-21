// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../i18n/testI18n';
import { UsersPage } from './UsersPage';
import { UserGroupsPage } from './UserGroupsPage';

beforeAll(() => {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

vi.mock('../features/gateway/useGatewayData', () => ({
  useGatewayData: () => ({
    client: {
      users: {
        list: vi.fn().mockResolvedValue([]),
        listSessionCounts: vi.fn().mockResolvedValue({}),
      },
      userGroups: {
        list: vi.fn().mockResolvedValue([]),
      },
    },
    status: 'connected',
    userInfo: { id: 'user//admin', siteadmin: 0xffffffff },
  }),
}));

describe('Users and UserGroups Page i18n', () => {
  it('renders UsersPage in en-US', () => {
    const i18n = createTestI18n('en-US');
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'User management' })).toBeDefined();
    expect(screen.getByText('Create user')).toBeDefined();
    expect(screen.getByPlaceholderText('Search username, real name or email')).toBeDefined();
  });

  it('renders UserGroupsPage in en-US', () => {
    const i18n = createTestI18n('en-US');
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <UserGroupsPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'User groups' })).toBeDefined();
    expect(screen.getByText('New user group')).toBeDefined();
    expect(screen.getByPlaceholderText('Search user group name, description or ID...')).toBeDefined();
  });
});
