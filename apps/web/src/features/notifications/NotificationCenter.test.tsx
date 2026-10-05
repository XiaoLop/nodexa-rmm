/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMeshCentralControlStore } from '@meshcentral/shared-state';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { NotificationCenter } from './NotificationCenter';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => cleanup());

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCenter() {
  const store = createMeshCentralControlStore();
  store.getState().addNotification({
    id: 'security',
    source: 'security',
    titleId: 3,
    messageId: 12,
    args: [2],
    occurredAt: new Date().toISOString(),
    severity: 'warning',
    raw: {},
  });
  store.getState().addNotification({
    id: 'device',
    source: 'help-request',
    title: '<b>Need help</b>',
    message: '<img src=x onerror=alert(1)>',
    deviceId: 'node//one',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    severity: 'warning',
    raw: {},
  });
  const i18n = createTestI18n('en-US');
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <I18nextProvider i18n={i18n}>
        <NotificationCenter
          open
          onClose={vi.fn()}
          store={store}
          devices={[{ id: 'node//one', name: 'One', online: true }]}
        />
        <LocationProbe />
      </I18nextProvider>
    </MemoryRouter>,
  );
  return store;
}

describe('NotificationCenter', () => {
  it('filters unread notifications and supports read and delete actions', () => {
    const store = renderCenter();
    expect(screen.getByText('Security Warning')).toBeDefined();
    expect(screen.getByText('<b>Need help</b>')).toBeDefined();
    expect(document.querySelector('img')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark as read' })[0]!);
    expect(store.getState().unreadCount).toBe(1);
    fireEvent.click(screen.getByText('Unread (1)'));
    expect(screen.queryByText('Security Warning')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove notification' }));
    expect(store.getState().notifications).toHaveLength(1);
  });

  it('marks a notification read and navigates through its safe device route', () => {
    const store = renderCenter();
    fireEvent.click(screen.getByText('<b>Need help</b>'));
    expect(store.getState().notifications.find((item) => item.id === 'device')?.read).toBe(true);
    expect(screen.getByTestId('location').textContent).toBe(
      '/devices/node%2F%2Fone/workspace?tab=overview',
    );
  });

  it('marks all notifications read and clears the complete list', () => {
    const store = renderCenter();
    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }));
    expect(store.getState().unreadCount).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
    expect(store.getState().notifications).toHaveLength(0);
    expect(screen.getByText('No notifications')).toBeDefined();
  });
});
