// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../i18n/testI18n';
import { DevicesPage } from './DevicesPage';
import { DeviceGroupsPage } from './DeviceGroupsPage';

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

vi.mock('../features/gateway/GatewayProvider', () => {
  const listeners = new Set<() => void>();
  const state = {
    devices: [],
    groups: [],
    userInfo: undefined,
    serverInfo: undefined,
    status: 'connected',
  };
  const store = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    useGateway: () => ({
      store,
      client: undefined,
      configured: true,
      authenticated: true,
      initializing: false,
      refreshSnapshot: vi.fn(),
    }),
  };
});

vi.mock('../features/gateway/useGatewayData', () => ({
  useGatewayData: () => ({
    groups: [],
    devices: [],
    client: undefined,
    status: 'connected',
    refreshSnapshot: vi.fn(),
  }),
}));

describe('Devices and Groups Page i18n', () => {
  it('renders DevicesPage in en-US', () => {
    const i18n = createTestI18n('en-US');
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <DevicesPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'All devices' })).toBeDefined();
    expect(screen.getByPlaceholderText('Search name, ID, IP, platform...')).toBeDefined();
    expect(screen.getByText('Add device')).toBeDefined();
  });

  it('renders DeviceGroupsPage in en-US', () => {
    const i18n = createTestI18n('en-US');
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <DeviceGroupsPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Device groups' })).toBeDefined();
    expect(screen.getByText('New group')).toBeDefined();
    expect(screen.getByPlaceholderText('Search group name, description...')).toBeDefined();
  });
});
