/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

afterEach(() => cleanup());

describe('NotificationBell', () => {
  it('hides a zero badge and exposes the unread count accessibly', () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <NotificationBell
        unreadCount={0}
        label="Notifications"
        unreadLabel="0 unread notifications"
        onOpen={onOpen}
      />,
    );
    expect(document.querySelector('.ant-badge-count')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onOpen).toHaveBeenCalledOnce();

    rerender(
      <NotificationBell
        unreadCount={3}
        label="Notifications"
        unreadLabel="3 unread notifications"
        onOpen={onOpen}
      />,
    );
    expect(document.querySelector('.ant-badge-count')?.textContent).toBe('3');
    expect(
      screen.getByRole('button', { name: 'Notifications, 3 unread notifications' }),
    ).toBeDefined();
  });
});
